import mongoose from "mongoose";
import type { InferSchemaType, Model } from "mongoose";

const { Schema, model, models } = mongoose;

const schema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, required: true, maxlength: 5000 },
  brand: { type: String, required: true, trim: true, index: true },
  category: { type: String, required: true, trim: true, index: true },
  subcategory: { type: String, trim: true, default: "", index: true },
  price: { type: Number, required: true, min: 0, index: true },
  wholesalePrice: { type: Number, min: 0 },
  compareAtPrice: { type: Number, min: 0 },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  quantity: { type: String, required: true, trim: true, maxlength: 50 },
  images: [{ type: String, trim: true }],
  specifications: { type: Map, of: String, default: {} },
  tags: [{ type: String, lowercase: true, trim: true }],
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

schema.index({ name: "text", description: "text", brand: "text", tags: "text" });
schema.index({ isActive: 1, category: 1, subcategory: 1, price: 1 });
schema.index({ isActive: 1, createdAt: -1 });
export type ProductDocument = InferSchemaType<typeof schema>;
export default (models.Product as Model<ProductDocument>) || model<ProductDocument>("Product", schema);
