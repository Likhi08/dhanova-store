import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database.js";
import Product from "../models/Product.js";

const SOURCE_LABEL = "Related catalogue fallback";
const categoryAssetFolders: Record<string, string> = {
  Beverages: "beverages",
  "Dairy & Breakfast": "dairy-breakfast",
  "Personal Care": "personal-care",
  Snacks: "snacks",
  "Dry Fruits": "snacks",
  Electronics: "electronics",
};

function baseName(value: string) {
  return value.split(/[—–]/)[0]!.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:pack|pouch|bottle|box|jar|tub|ice cream|product)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(baseName(value).split(" ").filter((token) => token.length > 1));
}

function similarity(left: string, right: string) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

function stableIndex(value: string) {
  let hash = 0;
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % 10;
}

await connectToDatabase();
try {
  const products = await Product.find({ isActive: true }).lean();
  const targets = products.filter((product) => !product.images?.length);
  const donors = products.filter((product) =>
    product.images?.length && (product.specifications as unknown as Record<string, string> | undefined)?.imageSource !== SOURCE_LABEL,
  );

  const updates = targets.flatMap((product) => {
    const categoryDonors = donors.filter((donor) => donor.category === product.category);
    const family = categoryDonors.filter((donor) => baseName(donor.name) === baseName(product.name));
    const sameBrand = categoryDonors.filter((donor) => donor.brand.toLowerCase() === product.brand.toLowerCase());
    const sameSubcategory = categoryDonors.filter((donor) =>
      product.subcategory && donor.subcategory?.toLowerCase() === product.subcategory.toLowerCase(),
    );
    const pool = family.length ? family : sameBrand.length ? sameBrand : sameSubcategory;
    const donor = pool.sort((a, b) => similarity(product.name, b.name) - similarity(product.name, a.name))[0];

    if (donor?.images?.[0]) {
      const relationship = family.length ? "same product family" : sameBrand.length ? "same brand and category" : "same subcategory";
      return [{
        updateOne: {
          filter: { _id: product._id, "images.0": { $exists: false } },
          update: {
            $set: {
              images: [donor.images[0]],
              "specifications.imageStatus": `Related image used from the ${relationship}`,
              "specifications.imageSource": SOURCE_LABEL,
              "specifications.imageSourceProduct": donor.name,
              "specifications.imageMatchConfidence": `Fallback: ${relationship}; exact product image not available`,
            },
          },
        },
      }];
    }

    const folder = categoryAssetFolders[product.category];
    if (!folder) return [];
    return [{
      updateOne: {
        filter: { _id: product._id, "images.0": { $exists: false } },
        update: {
          $set: {
            images: [`/product-images/${folder}/${stableIndex(`${product.brand}-${product.name}`)}.webp`],
            "specifications.imageStatus": "Related category image used until an exact product image is available",
            "specifications.imageSource": SOURCE_LABEL,
            "specifications.imageSourceProduct": `${product.category} category image`,
            "specifications.imageMatchConfidence": "Fallback: same product category; exact product image not available",
          },
        },
      },
    }];
  });

  const result = updates.length ? await Product.bulkWrite(updates, { ordered: false }) : { modifiedCount: 0 };
  const remaining = await Product.countDocuments({ isActive: true, "images.0": { $exists: false } });
  console.log(`${targets.length} products needed images; ${result.modifiedCount} related fallbacks added.`);
  console.log(`${remaining} active products remain without an image.`);
} finally {
  await mongoose.disconnect();
}
