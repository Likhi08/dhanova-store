import mongoose from "mongoose";
import type { InferSchemaType, Model } from "mongoose";

const { Schema, model, models } = mongoose;

const schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  items: [{ product: { type: Schema.Types.ObjectId, ref: "Product", required: true }, name: { type: String, required: true }, price: { type: Number, required: true, min: 0 }, quantity: { type: Number, required: true, min: 1 } }],
  subtotal: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  deliveryAddress: {
    label: String, fullName: String, phone: String, line1: String, line2: String,
    city: String, state: String, pincode: String, mapUrl: String,
  },
  status: { type: String, enum: ["pending", "paid", "processing", "shipped", "delivered", "cancelled"], default: "pending", index: true },
  paymentProvider: String,
  providerOrderId: { type: String, index: true, sparse: true },
  paymentReference: { type: String, index: true, sparse: true },
  paidAt: Date,
}, { timestamps: true });
schema.index({ user: 1, createdAt: -1 });
export type OrderDocument = InferSchemaType<typeof schema>;
export default (models.Order as Model<OrderDocument>) || model<OrderDocument>("Order", schema);
