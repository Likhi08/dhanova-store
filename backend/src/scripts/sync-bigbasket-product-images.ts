import "dotenv/config";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database.js";
import Product from "../models/Product.js";

const SOURCE = "https://www.bigbasket.com";
const requestedLimit = Number(process.argv.find((argument) => argument.startsWith("--limit="))?.split("=")[1] ?? 0);
const requestedCategory = process.argv.find((argument) => argument.startsWith("--category="))?.slice("--category=".length);
const requestedBrand = process.argv.find((argument) => argument.startsWith("--brand="))?.slice("--brand=".length);
const debugMatches = process.argv.includes("--debug");

type BigBasketProduct = {
  id: string;
  desc: string;
  w: string;
  absolute_url: string;
  brand?: { name?: string };
  images?: Array<{ l?: string; xl?: string; xxl?: string }>;
};

function normalize(value: string) {
  return value.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:pack|pouch|bottle|tub|can|box|jar|product)\b/g, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|grams?|ml|l|litres?|pcs?|pieces?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function removeBrand(value: string, brand: string) {
  const brandWords = new Set(normalize(brand).split(" ").filter(Boolean));
  return normalize(value).split(" ").filter((word) => !brandWords.has(word)).join(" ");
}

function canonicalBrand(value: string) {
  const compact = normalize(value).replace(/\s+/g, "");
  return compact === "haldirams" ? "haldiram" : compact;
}

function packKey(value: string) {
  const text = value.toLowerCase().replace(/grams?|gms?|gm\b/g, "g").replace(/litres?|ltr\b/g, "l").replace(/pieces?|pcs\b/g, "pc");
  const multi = text.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pc)/);
  if (multi) return `${multi[1]}x${multi[2]}${multi[3]}`;
  const quantity = text.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pc)/);
  if (quantity) {
    const amount = Number(quantity[1]);
    if (quantity[2] === "kg") return `${amount * 1000}g`;
    if (quantity[2] === "l") return `${amount * 1000}ml`;
    return `${amount}${quantity[2]}`;
  }
  const countPack = text.match(/(\d+)\s*[- ]?pack/);
  if (countPack) return `${countPack[1]}pack`;
  return normalize(text);
}

function nameScore(catalogueName: string, sourceName: string) {
  const a = new Set(normalize(catalogueName).split(" ").filter(Boolean));
  const b = new Set(normalize(sourceName).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const containment = intersection / Math.min(a.size, b.size);
  const jaccard = intersection / new Set([...a, ...b]).size;
  return containment >= 0.85 && jaccard >= 0.6 ? (containment + jaccard) / 2 : 0;
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const output = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await mapper(items[index]!, index);
    }
  }));
  return output;
}

async function createSessionCookie() {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, 15_000));
    try {
      const response = await fetch(`${SOURCE}/ps/?q=test`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36" },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    } catch { continue; }
  }
  throw new Error("BigBasket temporarily blocked catalogue access after multiple retries.");
}

async function searchBigBasket(query: string, cookie: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt ? 750 : 250));
    const url = `${SOURCE}/listing-svc/v2/products?type=ps&slug=${encodeURIComponent(query)}&page=1`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36",
          "X-Channel": "BB-WEB",
          "Content-Type": "application/json",
          "X-Tracker": randomUUID(),
          "common-client-static-version": "101",
          "X-Entry-Context": "bb-b2c",
          "X-Entry-Context-Id": "100",
          "X-Integrated-FC-Door-Visible": "true",
          Cookie: cookie,
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch { continue; }
    if (!response.ok) continue;
    const body = await response.text();
    if (!body.trim()) continue;
    try {
      const payload = JSON.parse(body) as { tabs?: Array<{ product_info?: { products?: BigBasketProduct[] } }> };
      return payload.tabs?.flatMap((tab) => tab.product_info?.products ?? []) ?? [];
    } catch { continue; }
  }
  return [];
}

await connectToDatabase();
try {
  const missing = await Product.find({
    isActive: true,
    $or: [
      { "images.0": { $exists: false } },
      { "specifications.imageSource": "Related catalogue fallback" },
    ],
    ...(requestedCategory ? { category: requestedCategory } : {}),
    ...(requestedBrand ? { brand: requestedBrand } : {}),
  }).sort({ category: 1, name: 1 }).lean();
  const targets = requestedLimit > 0 ? missing.slice(0, requestedLimit) : missing;
  const cookie = await createSessionCookie();
  const updates = await mapWithConcurrency(targets, 1, async (product, index) => {
    const baseWithBrand = product.name.split("—")[0]!.trim();
    const baseName = removeBrand(baseWithBrand, product.brand);
    const query = `${baseWithBrand} ${product.quantity}`;
    const results = await searchBigBasket(query, cookie);
    if (debugMatches) console.log(`QUERY ${product.name} => ${results.slice(0, 5).map((source) => `${source.brand?.name}|${source.desc}|${source.w}`).join(" || ") || "no results"}`);
    const candidates = results.flatMap((source) => {
      const sourceImage = source.images?.[0]?.xxl ?? source.images?.[0]?.xl ?? source.images?.[0]?.l;
      if (!sourceImage || packKey(source.w) !== packKey(product.quantity)) return [];
      const brandScore = canonicalBrand(source.brand?.name ?? "") === canonicalBrand(product.brand) ? 1 : 0;
      const score = nameScore(baseName, source.desc);
      return brandScore && score ? [{ source, sourceImage, score }] : [];
    }).sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if ((index + 1) % 50 === 0) console.log(`Checked ${index + 1}/${targets.length}; matches so far are being collected.`);
    if (!best || (candidates[1] && best.score === candidates[1].score)) return 0;
    const updated = await Product.updateOne(
      {
        _id: product._id,
        $or: [
          { "images.0": { $exists: false } },
          { "specifications.imageSource": "Related catalogue fallback" },
        ],
      },
      {
        $set: {
          images: [best.sourceImage],
          "specifications.imageStatus": "Exact name, brand, and pack matched retailer image",
          "specifications.imageSource": "BigBasket",
          "specifications.imageSourceUrl": `${SOURCE}${best.source.absolute_url}`,
          "specifications.imageSourceProduct": `${best.source.brand?.name ?? ""} ${best.source.desc} — ${best.source.w}`.trim(),
          "specifications.imageMatchConfidence": `${Math.round(best.score * 100)}% name score with exact brand and pack size`,
        },
      },
    );
    return updated.modifiedCount;
  });
  const updatedCount = updates.reduce((sum, count) => sum + count, 0);
  const stillMissing = await Product.countDocuments({ isActive: true, "images.0": { $exists: false } });
  console.log(`${targets.length} missing-image products checked; ${updatedCount} strict BigBasket matches updated.`);
  console.log(`${stillMissing} active products still need images.`);
} finally {
  await mongoose.disconnect();
}
