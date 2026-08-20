import express, { Router } from "express";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import type { QueryFilter, SortOrder } from "mongoose";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import Product, { ProductDocument } from "../models/Product.js";
import { productInputSchema, productUpdateSchema } from "../validation/product.js";

const router = Router();
const { isValidObjectId } = mongoose;
const uploadDirectory = fileURLToPath(new URL("../../uploads/", import.meta.url));
const supportedImageTypes: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const querySchema = z.object({
  q: z.string().trim().max(100).optional(), category: z.string().trim().max(100).optional(),
  subcategory: z.string().trim().max(100).optional(), brand: z.string().trim().max(100).optional(),
  minPrice: z.coerce.number().min(0).optional(), maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "name"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(24),
});

const homepageCategories = [
  "Fresh Produce", "Dairy & Breakfast", "Snacks", "Dry Fruits", "Pantry & Staples", "Beverages",
  "Household", "Home Decor", "Personal Care", "Baby Care", "Electronics",
];

router.get("/homepage", async (_request, response) => {
  const [categoryProducts, total] = await Promise.all([
    Promise.all(homepageCategories.map((category) => Product.find({ isActive: true, category }).sort({ createdAt: -1 }).limit(12).lean())),
    Product.countDocuments({ isActive: true }),
  ]);
  response.json({ products: categoryProducts.flat(), pagination: { page: 1, limit: 132, total, pages: 1 } });
});

router.get("/filters", async (_request, response) => {
  const [categories, subcategories, brands, priceRange] = await Promise.all([
    Product.distinct("category", { isActive: true }), Product.distinct("subcategory", { isActive: true, subcategory: { $ne: "" } }),
    Product.distinct("brand", { isActive: true }), Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }]),
  ]);
  response.json({ categories: categories.sort(), subcategories: subcategories.sort(), brands: brands.sort(), priceRange: priceRange[0] ?? { min: 0, max: 0 } });
});

router.get("/suggestions", async (request, response) => {
  const { q } = z.object({ q: z.string().trim().min(1).max(100) }).parse(request.query);
  const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const products = await Product.find({ isActive: true, name: { $regex: `^${escapedQuery}`, $options: "i" } })
    .select("name brand price images")
    .sort({ name: 1 })
    .limit(8)
    .lean();
  response.json({ products });
});

router.get("/", async (request, response) => {
  const query = querySchema.parse(request.query);
  const filter: QueryFilter<ProductDocument> = { isActive: true };
  if (query.q) {
    const escapedQuery = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wordPrefix = { $regex: `(^|\\s)${escapedQuery}`, $options: "i" };
    filter.$or = [{ name: wordPrefix }, { brand: wordPrefix }, { tags: wordPrefix }];
  }
  if (query.category) filter.category = query.category;
  if (query.subcategory) filter.subcategory = query.subcategory;
  if (query.brand) filter.brand = query.brand;
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {};
    if (query.minPrice !== undefined) filter.price.$gte = query.minPrice;
    if (query.maxPrice !== undefined) filter.price.$lte = query.maxPrice;
  }
  const sorts: Record<string, Record<string, SortOrder>> = { newest: { createdAt: -1 }, "price-asc": { price: 1 }, "price-desc": { price: -1 }, name: { name: 1 } };
  const [products, total] = await Promise.all([
    Product.find(filter).sort(sorts[query.sort]).skip((query.page - 1) * query.limit).limit(query.limit).lean(), Product.countDocuments(filter),
  ]);
  response.json({ products, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
});

router.post("/upload-image", requireAdmin, express.raw({ type: Object.keys(supportedImageTypes), limit: "5mb" }), async (request, response) => {
  const contentType = request.headers["content-type"]?.split(";", 1)[0] ?? "";
  const extension = supportedImageTypes[contentType];
  if (!extension) throw new HttpError(415, "Choose a JPG, PNG, or WebP image");
  if (!Buffer.isBuffer(request.body) || request.body.length === 0) throw new HttpError(400, "Choose an image from your device");
  await mkdir(uploadDirectory, { recursive: true });
  const filename = `${randomUUID()}${extension}`;
  await writeFile(`${uploadDirectory}/${filename}`, request.body, { flag: "wx" });
  response.status(201).json({ image: `/api/uploads/${filename}` });
});

router.post("/", requireAdmin, async (request, response) => {
  const input = productInputSchema.parse(request.body);
  if (input.compareAtPrice !== undefined && input.compareAtPrice < input.price) throw new HttpError(400, "Original price cannot be lower than the selling price");
  response.status(201).json(await Product.create(input));
});
router.get("/:id", async (request, response) => {
  if (!isValidObjectId(request.params.id)) throw new HttpError(400, "Invalid product ID");
  const product = await Product.findOne({ _id: request.params.id, isActive: true }).lean();
  if (!product) throw new HttpError(404, "Product not found");
  response.json(product);
});
router.patch("/:id", requireAdmin, async (request, response) => {
  if (!isValidObjectId(request.params.id)) throw new HttpError(400, "Invalid product ID");
  const updates = productUpdateSchema.parse(request.body);
  if (updates.price !== undefined || updates.compareAtPrice !== undefined) {
    const current = await Product.findById(request.params.id).select("price compareAtPrice").lean();
    if (!current) throw new HttpError(404, "Product not found");
    const nextPrice = updates.price ?? current.price;
    const nextOriginalPrice = updates.compareAtPrice ?? current.compareAtPrice;
    if (nextOriginalPrice != null && nextOriginalPrice < nextPrice) throw new HttpError(400, "Original price cannot be lower than the selling price");
  }
  const product = await Product.findByIdAndUpdate(request.params.id, updates, { new: true, runValidators: true }).lean();
  if (!product) throw new HttpError(404, "Product not found");
  response.json(product);
});
router.delete("/:id", requireAdmin, async (request, response) => {
  if (!isValidObjectId(request.params.id)) throw new HttpError(400, "Invalid product ID");
  const product = await Product.findByIdAndUpdate(request.params.id, { isActive: false }, { new: true }).lean();
  if (!product) throw new HttpError(404, "Product not found");
  response.json({ success: true });
});

export default router;
