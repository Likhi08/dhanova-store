import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database.js";
import Product from "../models/Product.js";

const SOURCE = "https://wholesaledryfruits.in";
const API = `${SOURCE}/wp-json/wc/store/v1`;
const SOURCE_LABEL = "Wholesale Dryfruits reference catalog";

type PriceData = {
  price: string;
  regular_price: string;
  sale_price: string;
  currency_minor_unit: number;
};

type Attribute = {
  name: string;
  terms?: Array<{ name: string; slug: string }>;
};

type VariationReference = {
  id: number;
  attributes: Array<{ name: string; value: string }>;
};

type SourceProduct = {
  id: number;
  name: string;
  slug: string;
  type: string;
  sku: string;
  permalink: string;
  description: string;
  short_description: string;
  prices: PriceData;
  images: Array<{ src: string }>;
  categories: Array<{ name: string; slug: string }>;
  attributes: Attribute[];
  variations: VariationReference[];
  is_purchasable: boolean;
  is_in_stock: boolean;
};

async function sourceFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { "User-Agent": "DhanovaCatalog/1.0 (+https://dhanova.local)" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`Source catalog request failed (${response.status}): ${path}`);
  return response.json() as Promise<T>;
}

function decodeText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function money(prices: PriceData, field: keyof Pick<PriceData, "price" | "regular_price" | "sale_price">) {
  return Number(prices[field] || 0) / (10 ** prices.currency_minor_unit);
}

function packLabel(product: SourceProduct, variation?: VariationReference) {
  const termLookup = new Map(
    product.attributes.flatMap((attribute) => (attribute.terms ?? []).map((term) => [term.slug, term.name] as const)),
  );
  const selected = variation?.attributes.map((attribute) => termLookup.get(attribute.value) ?? attribute.value).filter(Boolean) ?? [];
  if (selected.length) return selected.join(" · ");
  const allOptions = product.attributes.flatMap((attribute) => attribute.terms?.map((term) => term.name) ?? []);
  if (allOptions.length === 1) return allOptions[0]!;
  const nameQuantity = product.name.match(/\b\d+(?:\.\d+)?\s*(?:kg|g|gm|grams?|pieces?|pcs?|ml|litres?|l)\b/i)?.[0];
  return nameQuantity ?? "1 pack";
}

function packGrams(quantity: string) {
  const match = quantity.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(kg|gm|g|grams?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  return Math.round(amount * (match[2] === "kg" ? 1000 : 1));
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]!);
    }
  }));
  return results;
}

const sourceProducts = [
  ...await sourceFetch<SourceProduct[]>("/products?per_page=100&page=1"),
  ...await sourceFetch<SourceProduct[]>("/products?per_page=100&page=2"),
];

const sourceVariants = (await mapWithConcurrency(sourceProducts, 6, async (product) => {
  const variationRows = product.variations.length
    ? await mapWithConcurrency(product.variations, 4, async (reference) => ({
        reference,
        product: await sourceFetch<SourceProduct>(`/products/${reference.id}`),
      }))
    : [{ reference: undefined, product }];

  return variationRows.map(({ reference, product: pricedProduct }) => {
    const quantity = packLabel(product, reference);
    const price = money(pricedProduct.prices, "price") || money(product.prices, "price");
    const regularPrice = money(pricedProduct.prices, "regular_price") || money(product.prices, "regular_price");
    const sourceCategories = product.categories.map((category) => category.name);
    const subcategory = sourceCategories.find((name) => !["Best Sellers", "Gift Hampers"].includes(name)) ?? sourceCategories[0] ?? "Dry Fruits";
    const description = decodeText(`${product.short_description} ${product.description}`).slice(0, 5000)
      || `${product.name}, imported from the Wholesale Dryfruits reference catalog.`;
    const variantKey = reference ? reference.id : product.id;
    return {
      name: reference ? `${product.name} — ${quantity}` : product.name,
      slug: `wdf-${product.slug}-${variantKey}`,
      description,
      brand: "Wholesale Dryfruits",
      category: "Dry Fruits",
      subcategory,
      price,
      wholesalePrice: price,
      ...(regularPrice > price ? { compareAtPrice: regularPrice } : {}),
      stock: product.is_in_stock && product.is_purchasable ? 100 : 0,
      quantity,
      images: product.images.slice(0, 5).map((image) => image.src),
      specifications: new Map([
        ["company", "Wholesale Dryfruits"],
        ["packQuantity", quantity],
        ["availablePackOptions", product.attributes.flatMap((attribute) => attribute.terms?.map((term) => term.name) ?? []).join(", ") || quantity],
        ["source", SOURCE_LABEL],
        ["sourceProductId", String(product.id)],
        ["sourceVariationId", reference ? String(reference.id) : ""],
        ["sourceSku", pricedProduct.sku || product.sku || ""],
        ["sourceUrl", product.permalink || `${SOURCE}/product/${product.slug}/`],
        ["sourceStockStatus", product.is_in_stock ? "In stock" : "Out of stock"],
        ["priceCapturedOn", "2026-08-10"],
      ]),
      tags: [...sourceCategories, subcategory, product.name, quantity, "wholesale dry fruits"].slice(0, 30),
      isActive: product.is_in_stock && product.is_purchasable && price > 0,
    };
  });
})).flat();

const standardPacks = [250, 500, 750, 1000] as const;
const standardLabel = (grams: number) => grams === 1000 ? "1 kg" : `${grams} g`;
const groupedVariants = new Map<string, typeof sourceVariants>();
sourceVariants.forEach((product) => {
  const sourceProductId = product.specifications.get("sourceProductId")!;
  groupedVariants.set(sourceProductId, [...(groupedVariants.get(sourceProductId) ?? []), product]);
});

const imported = Array.from(groupedVariants.values()).flatMap((variants) => {
  const weighted = variants
    .map((product) => ({ product, grams: packGrams(product.quantity) }))
    .filter((entry): entry is { product: (typeof variants)[number]; grams: number } => entry.grams !== null && entry.product.price > 0);
  const sourceCategories = variants[0]?.tags ?? [];
  const excluded = sourceCategories.includes("Gift Hampers") || /gift|diwali|wedding|shaadi|hamper/i.test(variants[0]?.name ?? "");
  if (!weighted.length || excluded) return [];

  return standardPacks.map((grams) => {
    const exact = weighted.find((entry) => entry.grams === grams);
    const reference = exact ?? [...weighted].sort((a, b) => Math.abs(a.grams - grams) - Math.abs(b.grams - grams))[0]!;
    const price = exact ? exact.product.price : Math.max(1, Math.round((reference.product.price / reference.grams) * grams));
    const compareAtPrice = reference.product.compareAtPrice
      ? (exact ? reference.product.compareAtPrice : Math.round((reference.product.compareAtPrice / reference.grams) * grams))
      : undefined;
    const quantity = standardLabel(grams);
    const baseName = reference.product.name.replace(/\s+[—-]\s+[^—]+$/, "");
    const specifications = new Map(reference.product.specifications);
    specifications.set("packQuantity", quantity);
    specifications.set("standardPackSize", quantity);
    specifications.set("priceMethod", exact ? "Exact referenced variant price" : `Proportional to referenced ${reference.product.quantity} pack`);
    return {
      ...reference.product,
      name: `${baseName} — ${quantity}`,
      slug: `wdf-standard-${specifications.get("sourceProductId")}-${grams}g`,
      price,
      wholesalePrice: price,
      ...(compareAtPrice && compareAtPrice > price ? { compareAtPrice } : { compareAtPrice: undefined }),
      quantity,
      specifications,
      tags: [...reference.product.tags.filter((tag) => !/^\d+\s*(?:kg|g|gm)$/i.test(tag)), quantity].slice(0, 30),
      isActive: true,
    };
  });
});

await connectToDatabase();
const activeSlugs = imported.filter((product) => product.isActive).map((product) => product.slug);
await Product.updateMany(
  { "specifications.source": SOURCE_LABEL, slug: { $nin: activeSlugs } },
  { $set: { isActive: false } },
);
const result = await Product.bulkWrite(imported.map((product) => ({
  updateOne: { filter: { slug: product.slug }, update: { $set: product }, upsert: true },
})), { ordered: false });

const [sourceActive, dryFruitTotal, catalogTotal] = await Promise.all([
  Product.countDocuments({ "specifications.source": SOURCE_LABEL, isActive: true }),
  Product.countDocuments({ category: "Dry Fruits", isActive: true }),
  Product.countDocuments({ isActive: true }),
]);
console.log(`Wholesale Dryfruits import: ${result.upsertedCount} inserted, ${result.modifiedCount} updated.`);
console.log(`${sourceActive} referenced SKUs active; ${dryFruitTotal} active Dry Fruits products; ${catalogTotal} active products total.`);
await mongoose.disconnect();
