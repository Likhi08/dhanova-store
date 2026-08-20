import "dotenv/config";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database.js";
import { readXlsxSheet } from "../lib/xlsx-reader.js";
import Product from "../models/Product.js";

const SOURCE_LABEL = "Biscuits Ice Creams Cool Drinks Catalogue workbook";
const DEFAULT_PATH = path.join(homedir(), "Downloads", "Biscuits_IceCreams_CoolDrinks_Catalogue_300.xlsx");
const cataloguePath = path.resolve(process.argv[2] ?? process.env.BISCUITS_ICECREAM_DRINKS_CATALOG_PATH ?? DEFAULT_PATH);
const categoryMap: Record<string, string> = {
  Biscuits: "Snacks",
  "Ice Cream": "Dairy & Breakfast",
  "Cool Drinks": "Beverages",
};

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const [rows, sourceStat] = await Promise.all([
  readXlsxSheet(cataloguePath, "Combined Catalogue"),
  stat(cataloguePath),
]);
const capturedOn = sourceStat.mtime.toISOString().slice(0, 10);
const products = rows.slice(3).flatMap((row) => {
  const get = (column: string) => row.get(column)?.trim() ?? "";
  const id = get("A");
  const catalogueCategory = get("B");
  const brand = get("D");
  const productName = get("E");
  const pack = get("F") || "1 pack";
  const mrp = Number(get("G"));
  const wholesale = Number(get("I"));
  if (!id || !catalogueCategory || !brand || !productName || mrp <= 0 || wholesale <= 0) return [];
  const subcategory = get("C") || catalogueCategory;
  const discount = Math.round(Number(get("H")) * 100);
  const displayName = productName.toLowerCase().startsWith(brand.toLowerCase()) ? productName : `${brand} ${productName}`;
  return [{
    name: `${displayName} — ${pack}`,
    slug: `bicd-catalogue-${id}-${slugify(brand)}-${slugify(productName)}-${slugify(pack)}`,
    description: `${displayName} in a ${pack} pack. Selling price is the workbook's estimated wholesale value; verify current packaging, MRP, tax, stock, cold-chain requirements, and distributor invoice before commercial fulfilment.`,
    brand,
    category: categoryMap[catalogueCategory] ?? "Snacks",
    subcategory,
    price: wholesale,
    wholesalePrice: wholesale,
    compareAtPrice: mrp > wholesale ? mrp : undefined,
    stock: 25,
    quantity: pack,
    images: [],
    specifications: new Map([
      ["company", brand], ["packQuantity", pack], ["catalogueCategory", catalogueCategory], ["catalogueType", subcategory],
      ["indicativeMRP", `₹${mrp}`], ["tradeDiscount", `${discount}%`], ["estimatedWholesale", `₹${wholesale}`],
      ["priceStatus", get("L") || "Indicative"], ["retailSearchUrl", get("K")],
      ["imageStatus", "Workbook contains a search link; direct authorized image not supplied"], ["source", SOURCE_LABEL],
      ["sourceWorkbook", path.basename(cataloguePath)], ["catalogueEntryId", id], ["catalogueCapturedOn", capturedOn],
      ["inventoryStatus", "Catalogue default stock; not supplier verified"],
    ]),
    tags: [brand, catalogueCategory, subcategory, productName, pack, "wholesale"],
    isActive: true,
  }];
});

if (products.length !== 300) throw new Error(`Expected 300 catalogue products but parsed ${products.length}.`);

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
  const counts = await Product.aggregate<{ _id: string; count: number }>([
    { $match: { isActive: true, "specifications.source": SOURCE_LABEL } },
    { $group: { _id: "$specifications.catalogueCategory", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log(`Biscuits/Ice Cream/Cool Drinks import: ${result.upsertedCount} inserted, ${result.modifiedCount} updated.`);
  console.log(counts.map((item) => `${item._id}: ${item.count}`).join("; "));
} finally {
  await mongoose.disconnect();
}
