import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { releaseInventory, reserveInventory } from "../lib/order-inventory.js";
import Cart from "../models/Cart.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

const router = Router();

type PopulatedCartItem = {
  product: null | { _id: mongoose.Types.ObjectId; name: string; price: number; stock: number; isActive: boolean };
  quantity: number;
};

function paymentCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) throw new HttpError(503, "Payment gateway is not configured yet");
  return { keyId, keySecret };
}

router.use(requireUser);

router.get("/config", (_request, response) => {
  response.json({ enabled: Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()) });
});

router.post("/create-order", async (request, response) => {
  const { keyId, keySecret } = paymentCredentials();
  const { addressId } = z.object({ addressId: z.string().refine(mongoose.isValidObjectId, "Invalid address ID") }).parse(request.body);
  const [cart, user] = await Promise.all([
    Cart.findOne({ user: request.user!.id }).populate({ path: "items.product", select: "name price stock isActive", match: { isActive: true } }).lean(),
    User.findById(request.user!.id).select("addresses").lean(),
  ]);
  const address = user?.addresses.find((entry) => entry._id.toString() === addressId);
  if (!address) throw new HttpError(404, "Delivery address not found");
  const items = (cart?.items ?? []) as unknown as PopulatedCartItem[];
  if (!items.length || items.some((item) => !item.product)) throw new HttpError(400, "Your cart is empty");
  if (items.some((item) => item.product!.stock < item.quantity)) throw new HttpError(409, "One or more products no longer have enough stock");

  const orderItems = items.map((item) => ({ product: item.product!._id, name: item.product!.name, price: item.product!.price, quantity: item.quantity }));
  const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (total <= 0) throw new HttpError(400, "Order total must be greater than zero");

  const localOrder = await Order.create({ user: request.user!.id, items: orderItems, subtotal: total, total, status: "pending", paymentProvider: "razorpay", deliveryAddress: address });
  const gatewayResponse = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: Math.round(total * 100), currency: "INR", receipt: `dh_${localOrder.id}`, notes: { localOrderId: localOrder.id } }),
  });
  const gatewayOrder = await gatewayResponse.json() as { id?: string; amount?: number; currency?: string; error?: { description?: string } };
  if (!gatewayResponse.ok || !gatewayOrder.id) {
    localOrder.status = "cancelled";
    await localOrder.save();
    throw new HttpError(502, gatewayOrder.error?.description ?? "Unable to create payment order");
  }

  localOrder.providerOrderId = gatewayOrder.id;
  await localOrder.save();
  response.status(201).json({
    keyId,
    localOrderId: localOrder.id,
    gatewayOrderId: gatewayOrder.id,
    amount: gatewayOrder.amount ?? Math.round(total * 100),
    currency: gatewayOrder.currency ?? "INR",
    customer: { name: request.user!.name, email: request.user!.email },
  });
});

const verifySchema = z.object({
  localOrderId: z.string().refine(mongoose.isValidObjectId, "Invalid local order ID"),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
});

router.post("/verify", async (request, response) => {
  const { keySecret } = paymentCredentials();
  const input = verifySchema.parse(request.body);
  const order = await Order.findOne({ _id: input.localOrderId, user: request.user!.id, paymentProvider: "razorpay" });
  if (!order || !order.providerOrderId) throw new HttpError(404, "Payment order not found");
  if (order.status === "paid" && order.paymentReference === input.razorpay_payment_id) return response.json({ success: true, orderId: order.id });
  if (order.status !== "pending" || order.providerOrderId !== input.razorpay_order_id) throw new HttpError(409, "Payment order does not match");

  const expected = createHmac("sha256", keySecret).update(`${order.providerOrderId}|${input.razorpay_payment_id}`).digest();
  const received = Buffer.from(input.razorpay_signature, "hex");
  if (received.length !== expected.length || !timingSafeEqual(expected, received)) throw new HttpError(400, "Payment signature verification failed");

  // Claim the pending order before touching inventory. Razorpay may retry the
  // verification callback, and two concurrent requests must not reserve twice.
  const claimedOrder = await Order.findOneAndUpdate(
    { _id: order._id, user: request.user!.id, status: "pending", providerOrderId: input.razorpay_order_id },
    { $set: { status: "processing" } },
    { new: true },
  );
  if (!claimedOrder) {
    const current = await Order.findById(order._id).select("status paymentReference").lean();
    if (current?.status === "paid" && current.paymentReference === input.razorpay_payment_id) {
      return response.json({ success: true, orderId: order.id });
    }
    throw new HttpError(409, "Payment verification is already in progress");
  }

  try {
    await reserveInventory(claimedOrder.items.map((item) => ({ product: item.product, quantity: item.quantity })));
  } catch (error) {
    await Order.updateOne({ _id: claimedOrder._id, status: "processing" }, { $set: { status: "pending" } });
    throw error;
  }

  try {
    claimedOrder.status = "paid";
    claimedOrder.paymentReference = input.razorpay_payment_id;
    claimedOrder.paidAt = new Date();
    await claimedOrder.save();
  } catch (error) {
    await releaseInventory(claimedOrder.items.map((item) => ({ product: item.product, quantity: item.quantity })));
    await Order.updateOne(
      { _id: claimedOrder._id, status: "processing" },
      { $set: { status: "pending" }, $unset: { paymentReference: 1, paidAt: 1 } },
    );
    throw error;
  }
  await Cart.updateOne({ user: request.user!.id }, { $set: { items: [] } });
  response.json({ success: true, orderId: order.id });
});

export default router;
