import "dotenv/config";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { connectToDatabase } from "../config/database.js";
import Product from "../models/Product.js";

const SOURCE_LABEL = "Haldirams Product Catalogue workbook";
const BRAND = "Haldiram's";
const DEFAULT_PATH = path.join(homedir(), "Downloads", "Haldirams_Product_Catalogue.xlsx");
const CATALOGUE_PATH = path.resolve(process.argv[2] ?? process.env.HALDIRAMS_CATALOG_PATH ?? DEFAULT_PATH);
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false, removeNSPrefix: true });
const decoder = new TextDecoder();

type XmlValue = Record<string, unknown> | string | number | undefined;
type CatalogueRow = {
  id: string;
  category: string;
  productName: string;
  packSize: string;
  mrp: number;
  tradeDiscount: number;
  wholesale: number;
  officialUrl: string;
  priceStatus: string;
};

function asArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function textContent(value: XmlValue): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "object") return String(value);
  if ("#text" in value) return String(value["#text"] ?? "");
  const direct = value.t as XmlValue;
  if (direct !== undefined) return textContent(direct);
  return asArray(value.r as Record<string, unknown> | Record<string, unknown>[] | undefined)
    .map((run) => textContent(run.t as XmlValue))
    .join("");
}

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function workbookRows(buffer: Buffer): CatalogueRow[] {
  const archive = unzipSync(new Uint8Array(buffer));
  const readXml = (name: string) => {
    const entry = archive[name];
    if (!entry) throw new Error(`Workbook entry is missing: ${name}`);
    return parser.parse(decoder.decode(entry)) as Record<string, unknown>;
  };

  const sharedXml = archive["xl/sharedStrings.xml"] ? readXml("xl/sharedStrings.xml") : undefined;
  const sharedStrings = asArray((sharedXml?.sst as Record<string, unknown> | undefined)?.si as XmlValue | XmlValue[] | undefined)
    .map((item) => textContent(item));
  const workbook = readXml("xl/workbook.xml");
  const relationships = readXml("xl/_rels/workbook.xml.rels");
  const relationshipMap = new Map(
    asArray((relationships.Relationships as Record<string, unknown>).Relationship as Record<string, unknown> | Record<string, unknown>[])
      .map((relationship) => [String(relationship["@_Id"]), String(relationship["@_Target"])]),
  );
  const sheets = asArray(((workbook.workbook as Record<string, unknown>).sheets as Record<string, unknown>).sheet as Record<string, unknown> | Record<string, unknown>[]);
  const catalogueSheet = sheets.find((sheet) => String(sheet["@_name"]) === "Product Catalogue");
  if (!catalogueSheet) throw new Error('The workbook does not contain a "Product Catalogue" sheet.');
  const target = relationshipMap.get(String(catalogueSheet["@_id"]));
  if (!target) throw new Error("The Product Catalogue sheet relationship is missing.");
  const sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const sheet = readXml(sheetPath);
  const rows = asArray((((sheet.worksheet as Record<string, unknown>).sheetData as Record<string, unknown>).row) as Record<string, unknown> | Record<string, unknown>[]);

  const cellValue = (cell: Record<string, unknown>) => {
    if (String(cell["@_t"] ?? "") === "inlineStr") return textContent(cell.is as XmlValue);
    const raw = textContent(cell.v as XmlValue);
    return String(cell["@_t"] ?? "") === "s" ? sharedStrings[Number(raw)] ?? "" : raw;
  };

  return rows.flatMap((row) => {
    if (Number(row["@_r"]) < 5) return [];
    const cells = new Map(asArray(row.c as Record<string, unknown> | Record<string, unknown>[]).map((cell) => [String(cell["@_r"]).replace(/\d+/g, ""), cellValue(cell)]));
    const id = cells.get("A")?.trim() ?? "";
    const productName = cells.get("C")?.trim() ?? "";
    const mrp = Number(cells.get("E") ?? 0);
    const wholesale = Number(cells.get("G") ?? 0);
    if (!id || !productName || mrp <= 0 || wholesale <= 0) return [];
    return [{
      id,
      category: cells.get("B")?.trim() || "Packaged Food",
      productName,
      packSize: cells.get("D")?.trim() || "1 pack",
      mrp,
      tradeDiscount: Number(cells.get("F") ?? 0),
      wholesale,
      officialUrl: cells.get("I")?.trim() ?? "",
      priceStatus: cells.get("J")?.trim() || "Estimated",
    }];
  });
}

function decodeHtml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&#38;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}

function metaImage(html: string, pageUrl: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const property = tag.match(/(?:property|name)=["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (property !== "og:image" && property !== "twitter:image" && property !== "twitter:image:src") continue;
    const content = tag.match(/content=["']([^"']+)["']/i)?.[1];
    if (content) return new URL(decodeHtml(content), pageUrl).toString();
  }
  return "";
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await mapper(items[index]!);
    }
  }));
  return output;
}

async function officialImages(urls: string[]) {
  const pairs = await mapWithConcurrency([...new Set(urls.filter((url) => /^https:\/\//i.test(url)))], 6, async (url) => {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "DhanovaCatalog/1.0 (+https://dhanova.local)" },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return [url, ""] as const;
      return [url, metaImage(await response.text(), response.url)] as const;
    } catch {
      return [url, ""] as const;
    }
  });
  return new Map(pairs);
}

const sourceStat = await stat(CATALOGUE_PATH);
const rows = workbookRows(await readFile(CATALOGUE_PATH));
if (!rows.length) throw new Error("No valid product rows were found in the workbook.");
const imageBySource = await officialImages(rows.map((row) => row.officialUrl));
const capturedOn = sourceStat.mtime.toISOString().slice(0, 10);

const products = rows.map((row) => {
  const image = imageBySource.get(row.officialUrl) ?? "";
  const discountPercent = Math.round(row.tradeDiscount * 100);
  const name = `${BRAND} ${row.productName} — ${row.packSize}`;
  return {
    name,
    slug: `haldirams-catalogue-${row.id}-${slugify(row.productName)}-${slugify(row.packSize)}`,
    description: `${BRAND} ${row.productName} in a ${row.packSize} pack. The displayed selling price is the catalogue's estimated wholesale value; confirm live stock, tax, schemes, and invoice pricing before commercial fulfilment.`,
    brand: BRAND,
    category: "Snacks",
    subcategory: row.category,
    price: row.wholesale,
    wholesalePrice: row.wholesale,
    compareAtPrice: row.mrp > row.wholesale ? row.mrp : undefined,
    stock: 25,
    quantity: row.packSize,
    images: image ? [image] : [],
    specifications: new Map([
      ["company", BRAND],
      ["packQuantity", row.packSize],
      ["catalogueCategory", row.category],
      ["indicativeMRP", `₹${row.mrp}`],
      ["tradeDiscount", `${discountPercent}%`],
      ["estimatedWholesale", `₹${row.wholesale}`],
      ["priceStatus", row.priceStatus],
      ["officialProductUrl", row.officialUrl],
      ["imageSource", image ? "Official Haldiram's product page" : "No direct official image found"],
      ["source", SOURCE_LABEL],
      ["sourceWorkbook", path.basename(CATALOGUE_PATH)],
      ["catalogueEntryId", row.id],
      ["catalogueCapturedOn", capturedOn],
      ["inventoryStatus", "Catalogue default stock; not supplier verified"],
    ]),
    tags: ["haldiram's", "haldirams", row.category, row.productName, row.packSize, "wholesale"],
    isActive: true,
  };
});

await connectToDatabase();
try {
  const activeSlugs = products.map((product) => product.slug);
  await Product.updateMany(
    { "specifications.source": SOURCE_LABEL, slug: { $nin: activeSlugs } },
    { $set: { isActive: false } },
  );
  const result = await Product.bulkWrite(products.map((product) => ({
    updateOne: { filter: { slug: product.slug }, update: { $set: product }, upsert: true },
  })), { ordered: false });
  const [activeCount, withImages, totalActive] = await Promise.all([
    Product.countDocuments({ "specifications.source": SOURCE_LABEL, isActive: true }),
    Product.countDocuments({ "specifications.source": SOURCE_LABEL, isActive: true, "images.0": { $exists: true } }),
    Product.countDocuments({ isActive: true }),
  ]);
  console.log(`Haldiram's catalogue import: ${result.upsertedCount} inserted, ${result.modifiedCount} updated.`);
  console.log(`${activeCount} catalogue products active; ${withImages} have official product images; ${totalActive} active products total.`);
} finally {
  await mongoose.disconnect();
}
