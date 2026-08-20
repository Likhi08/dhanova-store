import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database.js";
import Product from "../models/Product.js";

const CATALOGUE_SOURCE = "Cadbury Product Catalogue workbook";
const SOURCE = "https://cococart.in";

type CocoProduct = {
  title: string;
  handle: string;
  vendor: string;
  images: Array<{ src: string }>;
};

function normalize(value: string) {
  return value.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:cadbury|mondelez|chocolate|chocolates|bar|bars|pack|pouch|india)\b/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|grams?|ml|l|litres?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function packKey(value: string) {
  const matches = [...value.toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*(kg|g|gm|gms|grams?|ml|l|litres?)/g)];
  const match = matches.at(-1);
  if (!match) return "";
  const amount = Number(match[1]);
  const unit = match[2]!;
  if (unit === "kg") return `${amount * 1000}g`;
  if (unit === "l" || unit.startsWith("litre")) return `${amount * 1000}ml`;
  return `${amount}${unit.startsWith("m") ? "ml" : "g"}`;
}

function similarity(left: string, right: string) {
  const a = new Set(normalize(left).split(" ").filter(Boolean));
  const b = new Set(normalize(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function isSafeNameMatch(catalogueName: string, sourceName: string) {
  const catalogueTokens = new Set(normalize(catalogueName).split(" ").filter(Boolean));
  const sourceTokens = new Set(normalize(sourceName).split(" ").filter(Boolean));
  if (![...catalogueTokens].every((token) => sourceTokens.has(token))) return false;
  const allowedSourceExtras = new Set(["dark", "original", "classic"]);
  return [...sourceTokens].every((token) => catalogueTokens.has(token) || allowedSourceExtras.has(token));
}

async function loadCocoCartProducts() {
  const products: CocoProduct[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(`${SOURCE}/products.json?limit=250&page=${page}`, {
      headers: { "User-Agent": "DhanovaCatalog/1.0 (+https://dhanova.local)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`CocoCart catalogue request failed with ${response.status}.`);
    const batch = (await response.json() as { products: CocoProduct[] }).products;
    if (!batch.length) break;
    products.push(...batch);
    if (batch.length < 250) break;
  }
  return products.filter((product) => /cadbury|mondelez/i.test(`${product.vendor} ${product.title}`) && product.images.length > 0);
}

await connectToDatabase();
try {
  const [catalogue, sourceProducts] = await Promise.all([
    Product.find({ isActive: true, "specifications.source": CATALOGUE_SOURCE }).lean(),
    loadCocoCartProducts(),
  ]);
  const matches = catalogue.flatMap((product) => {
    const specifications = product.specifications as unknown as Record<string, string> | undefined;
    const pack = specifications?.packQuantity ?? product.quantity;
    const productBaseName = product.name.split("—")[0]!.trim();
    const candidates = sourceProducts
      .filter((source) => packKey(source.title) === packKey(pack))
      .map((source) => ({ source, score: similarity(productBaseName, source.title) }))
      .filter((candidate) => candidate.score >= 0.75 && isSafeNameMatch(productBaseName, candidate.source.title))
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best || (candidates[1] && best.score === candidates[1].score)) return [];
    return [{ product, source: best.source, score: best.score }];
  });

  const matchedIds = matches.map(({ product }) => product._id);
  const cleared = await Product.updateMany(
    { "specifications.source": CATALOGUE_SOURCE, "specifications.imageSource": "CocoCart", _id: { $nin: matchedIds } },
    {
      $set: {
        images: [],
        "specifications.imageStatus": "Workbook contains a search link; no confident CocoCart match found",
      },
      $unset: {
        "specifications.imageSource": "",
        "specifications.imageSourceUrl": "",
        "specifications.imageSourceProduct": "",
        "specifications.imageMatchConfidence": "",
      },
    },
  );
  const result = matches.length ? await Product.bulkWrite(matches.map(({ product, source, score }) => ({
    updateOne: {
      filter: { _id: product._id },
      update: {
        $set: {
          images: source.images.slice(0, 5).map((image) => image.src),
          "specifications.imageStatus": "Matched retailer product image",
          "specifications.imageSource": "CocoCart",
          "specifications.imageSourceUrl": `${SOURCE}/products/${source.handle}`,
          "specifications.imageSourceProduct": source.title,
          "specifications.imageMatchConfidence": `${Math.round(score * 100)}% name similarity with exact pack size`,
        },
      },
    },
  })), { ordered: false }) : { modifiedCount: 0 };

  console.log(`${sourceProducts.length} Cadbury listings found on CocoCart.`);
  console.log(`${matches.length} exact-pack catalogue matches; ${result.modifiedCount} products updated with direct images; ${cleared.modifiedCount} unsafe prior matches cleared.`);
  matches.slice(0, 20).forEach(({ product, source, score }) => console.log(`${Math.round(score * 100)}% | ${product.name} <- ${source.title}`));
} finally {
  await mongoose.disconnect();
}
