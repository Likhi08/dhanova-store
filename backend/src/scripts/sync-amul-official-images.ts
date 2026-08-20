import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database.js";
import Product from "../models/Product.js";

const AMUL_SITE = "https://amul.com";
const AMUL_API = "https://webcms.amul.com/api/v1";
const SOURCE_LABEL = "Amul official catalogue";

type AmulProduct = {
  product_slug: string;
  product_title: string;
  product_display_size: string;
  status: string;
  product_image: string;
};

type AmulSubcategory = {
  sub_category_title: string;
  product: AmulProduct[];
};

type CategoryResponse = {
  status: number;
  product_category_data: {
    sub_category: AmulSubcategory[];
  };
};

function normalizeName(value: string) {
  return value.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bamul\b/g, " ")
    .replace(/\bice[ -]?cream\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function unitKey(amountText: string, unitText: string) {
  const amount = Number(amountText);
  const unit = unitText.toLowerCase().replace(/litres?|ltr/g, "l");
  if (unit === "l") return `${amount * 1000}ml`;
  return `${amount}${unit}`;
}

function sourcePackKeys(value: string) {
  return new Set([...value.matchAll(/(\d+(?:\.\d+)?)\s*(ml|l|litres?|ltr)\b/gi)]
    .map((match) => unitKey(match[1]!, match[2]!)));
}

function cataloguePackKey(value: string) {
  const normalized = value.toLowerCase().replace(/litres?|ltr/g, "l");
  const multi = normalized.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(ml|l)\b/);
  if (multi) {
    const unit = unitKey(multi[2]!, multi[3]!);
    return Number(multi[1]) === 1 ? unit : `${multi[1]}x${unit}`;
  }
  const size = normalized.match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/);
  return size ? unitKey(size[1]!, size[2]!) : "";
}

function imageRepresentsPack(product: AmulProduct, wantedPack: string) {
  const listedPacks = sourcePackKeys(product.product_display_size);
  if (listedPacks.size === 1) return listedPacks.has(wantedPack);
  const imagePacks = sourcePackKeys(decodeURIComponent(product.product_image));
  return imagePacks.has(wantedPack);
}

async function loadOfficialIceCreams() {
  const commonHeaders = {
    Accept: "application/json",
    Origin: AMUL_SITE,
    Referer: `${AMUL_SITE}/ice-cream`,
    "User-Agent": "Mozilla/5.0 (compatible; DhanovaCatalog/1.0)",
  };
  const tokenResponse = await fetch(`${AMUL_API}/website-token`, {
    method: "POST",
    headers: { ...commonHeaders, "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(20_000),
  });
  if (!tokenResponse.ok) throw new Error(`Amul token request failed with ${tokenResponse.status}.`);
  const { token } = await tokenResponse.json() as { token: string };

  const categoryResponse = await fetch(`${AMUL_API}/categoryDetails?category_id=ice-cream`, {
    headers: {
      ...commonHeaders,
      Authorization: `Bearer ${token}`,
      "X-Website-Token": token,
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!categoryResponse.ok) throw new Error(`Amul catalogue request failed with ${categoryResponse.status}.`);
  const payload = await categoryResponse.json() as CategoryResponse;

  return payload.product_category_data.sub_category.flatMap((subcategory) =>
    subcategory.product
      .filter((product) => product.status === "Active" && product.product_image)
      .map((product) => ({ ...product, subcategory: subcategory.sub_category_title })),
  );
}

await connectToDatabase();
try {
  const [catalogue, officialProducts] = await Promise.all([
    Product.find({ isActive: true, brand: { $in: ["Amul", "Amul Gold"] } }).lean(),
    loadOfficialIceCreams(),
  ]);

  const matches = catalogue.flatMap((product) => {
    const baseName = product.name.split(/[—–]/)[0]!.trim();
    const wantedName = normalizeName(baseName);
    const wantedPack = cataloguePackKey(product.quantity);
    if (!wantedName || !wantedPack) return [];

    const candidates = officialProducts.filter((official) => {
      const names = [
        normalizeName(official.product_title),
        normalizeName(`${official.product_title} ${official.subcategory}`),
      ];
      return names.includes(wantedName)
        && sourcePackKeys(official.product_display_size).has(wantedPack)
        && imageRepresentsPack(official, wantedPack);
    });
    if (candidates.length !== 1) return [];
    return [{ product, official: candidates[0]! }];
  });

  const matchedIds = matches.map(({ product }) => product._id);
  const cleared = await Product.updateMany(
    { "specifications.imageSource": SOURCE_LABEL, _id: { $nin: matchedIds } },
    {
      $set: {
        images: [],
        "specifications.imageStatus": "No exact official Amul name and pack-size match found",
      },
      $unset: {
        "specifications.imageSource": "",
        "specifications.imageSourceUrl": "",
        "specifications.imageSourceProduct": "",
        "specifications.imageMatchConfidence": "",
      },
    },
  );

  const result = matches.length ? await Product.bulkWrite(matches.map(({ product, official }) => ({
    updateOne: {
      filter: { _id: product._id },
      update: {
        $set: {
          images: [official.product_image],
          "specifications.imageStatus": "Exact product and pack matched on Amul's official catalogue",
          "specifications.imageSource": SOURCE_LABEL,
          "specifications.imageSourceUrl": `${AMUL_SITE}/products`,
          "specifications.imageSourceProduct": `Amul ${official.product_title} — ${official.product_display_size}`,
          "specifications.imageMatchConfidence": "Exact official product name and pack size",
        },
      },
    },
  })), { ordered: false }) : { modifiedCount: 0 };

  console.log(`${officialProducts.length} active ice-cream products found in Amul's official catalogue.`);
  console.log(`${matches.length} exact catalogue matches; ${result.modifiedCount} products updated; ${cleared.modifiedCount} stale official matches cleared.`);
  matches.forEach(({ product, official }) => console.log(`${product.name} <- ${official.product_title} (${official.product_display_size})`));
} finally {
  await mongoose.disconnect();
}
