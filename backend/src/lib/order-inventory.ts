import mongoose from "mongoose";
import { HttpError } from "./errors.js";
import Product from "../models/Product.js";

export type InventoryItem = { product: mongoose.Types.ObjectId; quantity: number };

export async function reserveInventory(items: InventoryItem[]) {
  const reserved: InventoryItem[] = [];
  try {
    for (const item of items) {
      const result = await Product.updateOne(
        { _id: item.product, isActive: true, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
      );
      if (!result.modifiedCount) throw new HttpError(409, "One or more products no longer have enough stock");
      reserved.push(item);
    }
  } catch (error) {
    await Promise.all(reserved.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })));
    throw error;
  }
}

export async function releaseInventory(items: InventoryItem[]) {
  await Promise.all(items.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })));
}
