import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { releaseInventory, reserveInventory } from "../lib/order-inventory.js";
import Cart from "../models/Cart.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Product from "../models/Product.js";

const router = Router();
router.use(requireUser);

router.get("/buy-again", async (request, response) => {
  const orders = await Order.find({ user: request.user!.id, status: { $ne: "cancelled" } }).sort({ createdAt: -1 }).limit(25).select("items.product").lean();
  const productIds = [...new Set(orders.flatMap((order) => order.items.map((item) => item.product.toString())))].slice(0, 36);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true }).lean();
  const byId = new Map(products.map((product) => [product._id.toString(), product]));
  response.json({ products: productIds.map((id) => byId.get(id)).filter(Boolean) });
});

router.get("/", async (request, response) => {
  const orders = await Order.find({ user: request.user!.id }).sort({ createdAt: -1 }).limit(50).lean();
  response.json({ orders });
});

router.post("/cash-on-delivery", async (request, response) => {
  const { addressId } = z.object({ addressId: z.string().refine(mongoose.isValidObjectId, "Invalid address ID") }).parse(request.body);
  const [user, cart] = await Promise.all([
    User.findById(request.user!.id).select("addresses").lean(),
    Cart.findOne({ user: request.user!.id }).populate({ path: "items.product", select: "name price stock isActive", match: { isActive: true } }).lean(),
  ]);
  const address = user?.addresses.find((entry) => entry._id.toString() === addressId);
  if (!address) throw new HttpError(404, "Delivery address not found");
  const items = (cart?.items ?? []) as unknown as Array<{ product: null | { _id: mongoose.Types.ObjectId; name: string; price: number; stock: number }; quantity: number }>;
  if (!items.length || items.some((item) => !item.product)) throw new HttpError(400, "Your cart is empty");
  const orderItems = items.map((item) => ({ product: item.product!._id, name: item.product!.name, price: item.product!.price, quantity: item.quantity }));
  const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  await reserveInventory(orderItems);
  try {
    const order = await Order.create({
      user: request.user!.id, items: orderItems, subtotal: total, total, status: "processing", paymentProvider: "cod",
      deliveryAddress: address.toObject ? address.toObject() : address,
    });
    await Cart.updateOne({ user: request.user!.id }, { $set: { items: [] } });
    response.status(201).json({ success: true, orderId: order.id });
  } catch (error) {
    await releaseInventory(orderItems);
    throw error;
  }
});

export default router;
