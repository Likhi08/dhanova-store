import mongoose from "mongoose";
import type { InferSchemaType, Model } from "mongoose";

const { Schema, model, models } = mongoose;

const addressSchema = new Schema({
  label: { type: String, required: true, trim: true, maxlength: 50 },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 15 },
  line1: { type: String, required: true, trim: true, maxlength: 200 },
  line2: { type: String, trim: true, maxlength: 200, default: "" },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, required: true, trim: true, maxlength: 100 },
  pincode: { type: String, required: true, trim: true, maxlength: 6 },
  mapUrl: { type: String, trim: true, maxlength: 500, default: "" },
  isDefault: { type: Boolean, default: false },
}, { _id: true });

const schema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["customer", "admin"], default: "customer", index: true },
  addresses: { type: [addressSchema], default: [] },
}, { timestamps: true });

export type UserDocument = InferSchemaType<typeof schema>;
export default (models.User as Model<UserDocument>) || model<UserDocument>("User", schema);
