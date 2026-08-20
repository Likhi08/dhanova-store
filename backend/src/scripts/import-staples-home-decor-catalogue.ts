import "dotenv/config";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database.js";
import Product from "../models/Product.js";

const SOURCE_LABEL = "Staples Home Decor JSON catalogue";
const DEFAULT_PATH = path.join(homedir(), "Downloads", "staples_home_decor_catalog_1000.json");
const cataloguePath = path.resolve(process.argv[2] ?? process.env.STAPLES_HOME_DECOR_CATALOG_PATH ?? DEFAULT_PATH);
const categoryMap: Record<string, string> = {
  Staples: "Pantry & Staples",
  Home: "Household",
  Decor: "Home Decor",
};
const relatedImageMap: Record<string, string> = {
  Staples: "/product-images/catalogue-fallbacks/staples.png",
  Home: "/product-images/catalogue-fallbacks/household.png",
  Decor: "/product-images/catalogue-fallbacks/home-decor.png",
};

type CatalogueItem = {
  sku: string;
  name: string;
  brand: string;
  section: string;
  category: string;
  modelNumber: string | null;
  size: string | null;
  colour: string | null;
  mrp: number;
  estimatedWholesalePrice: number;
  suggestedSellingPrice: number;
  currency: string;
  imageUrl: string | null;
  imageType: string | null;
  barcode: string | null;
  supplier: string | null;
  stock: number;
  unit: string;
  pricingStatus: string;
  verificationStatus: string;
  active: boolean;
  priceUpdatedAt: string | null;
  createdAt: string;
};

function slugify(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const [rawCatalogue, sourceStat] = await Promise.all([
  readFile(cataloguePath, "utf8"),
  stat(cataloguePath),
]);
const rows = JSON.parse(rawCatalogue) as CatalogueItem[];
if (!Array.isArray(rows) || rows.length !== 1000) throw new Error(`Expected 1,000 catalogue items but received ${Array.isArray(rows) ? rows.length : "invalid JSON"}.`);
if (new Set(rows.map((row) => row.sku)).size !== rows.length) throw new Error("Catalogue contains duplicate SKUs.");

const capturedOn = sourceStat.mtime.toISOString().slice(0, 10);
const products = rows.map((row) => {
  const category = categoryMap[row.section];
  if (!category) throw new Error(`Unsupported section '${row.section}' for ${row.sku}.`);
  if (!row.sku || !row.name || !row.brand || !row.category || row.suggestedSellingPrice <= 0) {
    throw new Error(`Invalid required product data for ${row.sku || "unknown SKU"}.`);
  }
  const quantity = row.size?.trim() || row.unit?.trim() || "1 piece-or-pack";
  const compareAtPrice = row.mrp > row.suggestedSellingPrice ? row.mrp : undefined;
  const description = `${row.name}. Imported from the supplied ${row.section} catalogue. Price and inventory are catalogue estimates and must be verified against the supplier invoice before commercial fulfilment.`;

  return {
    name: row.name,
    slug: `shd-${slugify(row.sku)}`,
    description,
    brand: row.brand,
    category,
    subcategory: row.category,
    price: row.suggestedSellingPrice,
    wholesalePrice: row.estimatedWholesalePrice > 0 ? row.estimatedWholesalePrice : undefined,
    compareAtPrice,
    stock: row.stock > 0 ? row.stock : 25,
    quantity,
    images: [relatedImageMap[row.section]!],
    specifications: new Map([
      ["company", row.brand],
      ["packQuantity", quantity],
      ["catalogueSection", row.section],
      ["catalogueCategory", row.category],
      ["catalogueEntryId", row.sku],
      ["modelNumber", row.modelNumber ?? ""],
      ["colour", row.colour ?? ""],
      ["barcode", row.barcode ?? ""],
      ["supplier", row.supplier ?? ""],
      ["indicativeMRP", `₹${row.mrp}`],
      ["estimatedWholesale", `₹${row.estimatedWholesalePrice}`],
      ["suggestedSellingPrice", `₹${row.suggestedSellingPrice}`],
      ["priceStatus", row.pricingStatus],
      ["verificationStatus", row.verificationStatus],
      ["sourceActiveStatus", String(row.active)],
      ["sourceStock", String(row.stock)],
      ["inventoryStatus", "Catalogue default stock; not supplier verified"],
      ["imageStatus", "Related category image used because the supplied catalogue image is a grey placeholder"],
      ["imageSource", "Related catalogue fallback"],
      ["imageSourceProduct", `${category} assortment`],
      ["originalImageUrl", row.imageUrl ?? ""],
      ["originalImageType", row.imageType ?? ""],
      ["source", SOURCE_LABEL],
      ["sourceFile", path.basename(cataloguePath)],
      ["catalogueCapturedOn", capturedOn],
    ]),
    tags: [row.section, row.category, row.brand, row.name, quantity, "catalogue", "estimated price"],
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
  const sectionCounts = await Product.aggregate<{ _id: string; count: number }>([
    { $match: { isActive: true, "specifications.source": SOURCE_LABEL } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const total = await Product.countDocuments({ isActive: true });
  console.log(`Staples/Home/Decor import: ${result.upsertedCount} inserted, ${result.modifiedCount} updated.`);
  console.log(sectionCounts.map((item) => `${item._id}: ${item.count}`).join("; "));
  console.log(`${total} active products total.`);
} finally {
  await mongoose.disconnect();
}
