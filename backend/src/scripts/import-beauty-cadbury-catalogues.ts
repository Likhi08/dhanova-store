import "dotenv/config";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database.js";
import { readXlsxSheet, type XlsxRow } from "../lib/xlsx-reader.js";
import Product from "../models/Product.js";

const BEAUTY_SOURCE = "Beauty Products Catalogue workbook";
const CADBURY_SOURCE = "Cadbury Product Catalogue workbook";
const downloads = path.join(homedir(), "Downloads");
const beautyPath = path.resolve(process.argv[2] ?? process.env.BEAUTY_CATALOG_PATH ?? path.join(downloads, "Beauty_Products_Catalogue_300 (1).xlsx"));
const cadburyPath = path.resolve(process.argv[3] ?? process.env.CADBURY_CATALOG_PATH ?? path.join(downloads, "Cadbury_Product_Catalogue.xlsx"));

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function value(row: XlsxRow, column: string) {
  return row.get(column)?.trim() ?? "";
}

const [beautyRows, cadburyRows, beautyStat, cadburyStat] = await Promise.all([
  readXlsxSheet(beautyPath, "Beauty Catalogue"),
  readXlsxSheet(cadburyPath, "Product Catalogue"),
  stat(beautyPath),
  stat(cadburyPath),
]);

const beautyCapturedOn = beautyStat.mtime.toISOString().slice(0, 10);
const beautyProducts = beautyRows.slice(3).flatMap((row) => {
  const id = value(row, "A");
  const brand = value(row, "D");
  const productName = value(row, "E");
  const pack = value(row, "F") || "1 pack";
  const mrp = Number(value(row, "G"));
  const wholesale = Number(value(row, "I"));
  if (!id || !brand || !productName || mrp <= 0 || wholesale <= 0) return [];
  const category = value(row, "B") || "Beauty & Personal Care";
  const subcategory = value(row, "C") || category;
  const discount = Math.round(Number(value(row, "H")) * 100);
  const retailSource = value(row, "K");
  return [{
    name: `${brand} ${productName} — ${pack}`,
    slug: `beauty-catalogue-${id}-${slugify(brand)}-${slugify(productName)}-${slugify(pack)}`,
    description: `${brand} ${productName} in a ${pack} variant. Selling price is the workbook's estimated wholesale value; verify the current pack, shade, MRP, tax, stock, and distributor invoice before commercial fulfilment.`,
    brand,
    category: "Personal Care",
    subcategory,
    price: wholesale,
    wholesalePrice: wholesale,
    compareAtPrice: mrp > wholesale ? mrp : undefined,
    stock: 25,
    quantity: pack,
    images: [],
    specifications: new Map([
      ["company", brand], ["packQuantity", pack], ["catalogueCategory", category], ["catalogueSubcategory", subcategory],
      ["indicativeMRP", `₹${mrp}`], ["tradeDiscount", `${discount}%`], ["estimatedWholesale", `₹${wholesale}`],
      ["priceStatus", value(row, "L") || "Indicative"], ["retailSearchUrl", retailSource],
      ["imageStatus", "Workbook contains a search link; direct authorized image not supplied"], ["source", BEAUTY_SOURCE],
      ["sourceWorkbook", path.basename(beautyPath)], ["catalogueEntryId", id], ["catalogueCapturedOn", beautyCapturedOn],
      ["inventoryStatus", "Catalogue default stock; not supplier verified"],
    ]),
    tags: [brand, category, subcategory, productName, pack, "beauty", "wholesale"],
    isActive: true,
  }];
});

const cadburyCapturedOn = cadburyStat.mtime.toISOString().slice(0, 10);
const cadburyProducts = cadburyRows.slice(3).flatMap((row) => {
  const id = value(row, "A");
  const productName = value(row, "C");
  const pack = value(row, "D") || "1 pack";
  const mrp = Number(value(row, "E"));
  const wholesale = Number(value(row, "G"));
  if (!id || !productName || mrp <= 0 || wholesale <= 0) return [];
  const subcategory = value(row, "B") || "Chocolate";
  const discount = Math.round(Number(value(row, "F")) * 100);
  const displayName = /^cadbury\b/i.test(productName) ? productName : `Cadbury ${productName}`;
  return [{
    name: `${displayName} — ${pack}`,
    slug: `cadbury-catalogue-${id}-${slugify(productName)}-${slugify(pack)}`,
    description: `${displayName} in a ${pack} pack. Selling price is the workbook's estimated wholesale value; verify current packaging, MRP, tax, stock, and distributor invoice before commercial fulfilment.`,
    brand: "Cadbury",
    category: "Snacks",
    subcategory,
    price: wholesale,
    wholesalePrice: wholesale,
    compareAtPrice: mrp > wholesale ? mrp : undefined,
    stock: 25,
    quantity: pack,
    images: [],
    specifications: new Map([
      ["company", "Cadbury / Mondelez"], ["packQuantity", pack], ["catalogueCategory", subcategory],
      ["indicativeMRP", `₹${mrp}`], ["tradeDiscount", `${discount}%`], ["estimatedWholesale", `₹${wholesale}`],
      ["priceStatus", value(row, "J") || "Estimated"], ["retailSearchUrl", value(row, "I")],
      ["imageStatus", "Workbook contains a search link; direct authorized image not supplied"], ["source", CADBURY_SOURCE],
      ["sourceWorkbook", path.basename(cadburyPath)], ["catalogueEntryId", id], ["catalogueCapturedOn", cadburyCapturedOn],
      ["inventoryStatus", "Catalogue default stock; not supplier verified"],
    ]),
    tags: ["Cadbury", "Mondelez", subcategory, productName, pack, "chocolate", "wholesale"],
    isActive: true,
  }];
});

await connectToDatabase();
try {
  const products = [...beautyProducts, ...cadburyProducts];
  const slugsBySource = new Map([
    [BEAUTY_SOURCE, beautyProducts.map((product) => product.slug)],
    [CADBURY_SOURCE, cadburyProducts.map((product) => product.slug)],
  ]);
  await Promise.all([...slugsBySource].map(([source, slugs]) => Product.updateMany(
    { "specifications.source": source, slug: { $nin: slugs } }, { $set: { isActive: false } },
  )));
  const result = await Product.bulkWrite(products.map((product) => ({
    updateOne: { filter: { slug: product.slug }, update: { $set: product }, upsert: true },
  })), { ordered: false });
  const [beautyCount, cadburyCount] = await Promise.all([
    Product.countDocuments({ isActive: true, "specifications.source": BEAUTY_SOURCE }),
    Product.countDocuments({ isActive: true, "specifications.source": CADBURY_SOURCE }),
  ]);
  console.log(`Beauty/Cadbury import: ${result.upsertedCount} inserted, ${result.modifiedCount} updated.`);
  console.log(`${beautyCount} Beauty variants and ${cadburyCount} Cadbury variants are active.`);
} finally {
  await mongoose.disconnect();
}
