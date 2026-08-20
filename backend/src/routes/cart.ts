import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

const router = Router();
const { isValidObjectId } = mongoose;
const itemSchema = z.object({ productId: z.string().refine(isValidObjectId, "Invalid product ID"), quantity: z.coerce.number().int().min(1).max(99).default(1) });

async function populatedCart(userId: string) {
  return Cart.findOne({ user: userId }).populate({ path: "items.product", select: "name slug price stock quantity images isActive", match: { isActive: true } }).lean();
}

router.use(requireUser);
router.get("/", async (request, response) => { response.json({ cart: await populatedCart(request.user!.id) }); });
router.post("/", async (request, response) => {
  const input = itemSchema.parse(request.body);
  const product = await Product.findOne({ _id: input.productId, isActive: true }).select("stock").lean();
  if (!product) throw new HttpError(404, "Product not found");
  if (product.stock < input.quantity) throw new HttpError(409, "Insufficient stock");
  const existing = await Cart.findOne({ user: request.user!.id, "items.product": input.productId });
  if (existing) {
    const item = existing.items.find((entry) => entry.product.toString() === input.productId);
    if (item) item.quantity = Math.min(item.quantity + input.quantity, product.stock, 99);
    await existing.save();
  } else {
    await Cart.findOneAndUpdate({ user: request.user!.id }, { $push: { items: { product: input.productId, quantity: input.quantity } } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  response.json({ cart: await populatedCart(request.user!.id) });
});
router.patch("/", async (request, response) => {
  const input = itemSchema.parse(request.body);
  const product = await Product.findOne({ _id: input.productId, isActive: true }).select("stock").lean();
  if (!product) throw new HttpError(404, "Product not found");
  if (product.stock < input.quantity) throw new HttpError(409, "Insufficient stock");
  const result = await Cart.updateOne({ user: request.user!.id, "items.product": input.productId }, { $set: { "items.$.quantity": input.quantity } });
  if (!result.matchedCount) throw new HttpError(404, "Cart item not found");
  response.json({ cart: await populatedCart(request.user!.id) });
});
router.delete("/", async (request, response) => {
  const input = z.object({ productId: z.string().refine(isValidObjectId, "Invalid product ID") }).parse(request.body);
  await Cart.updateOne({ user: request.user!.id }, { $pull: { items: { product: input.productId } } });
  response.json({ cart: await populatedCart(request.user!.id) });
});

export default router;
