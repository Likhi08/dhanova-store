import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireUser } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import User from "../models/User.js";

const router = Router();
function isGoogleMapsUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (
      host === "maps.app.goo.gl" ||
      (host === "goo.gl" && url.pathname.startsWith("/maps")) ||
      host === "maps.google.com" ||
      ((host === "google.com" || host === "www.google.com") && url.pathname.startsWith("/maps"))
    );
  } catch { return false; }
}

const addressSchema = z.object({
  label: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  line1: z.string().trim().min(5).max(200),
  line2: z.string().trim().max(200).default(""),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  mapUrl: z.string().trim().max(500).refine(isGoogleMapsUrl, "Enter a valid Google Maps location link").default(""),
  isDefault: z.boolean().default(false),
});

router.use(requireUser);

router.get("/addresses", async (request, response) => {
  const user = await User.findById(request.user!.id).select("addresses").lean();
  if (!user) throw new HttpError(404, "Account not found");
  response.json({ addresses: user.addresses });
});

router.post("/addresses", async (request, response) => {
  const input = addressSchema.parse(request.body);
  const user = await User.findById(request.user!.id).select("addresses");
  if (!user) throw new HttpError(404, "Account not found");
  if (user.addresses.length >= 3) throw new HttpError(400, "You can save up to 3 delivery addresses");
  if (input.isDefault || user.addresses.length === 0) user.addresses.forEach((address) => { address.isDefault = false; });
  user.addresses.push({ ...input, isDefault: input.isDefault || user.addresses.length === 0 });
  await user.save();
  response.status(201).json({ addresses: user.addresses });
});

router.patch("/addresses/:id", async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw new HttpError(400, "Invalid address ID");
  const input = addressSchema.partial().parse(request.body);
  const user = await User.findById(request.user!.id).select("addresses");
  if (!user) throw new HttpError(404, "Account not found");
  const address = user.addresses.id(request.params.id);
  if (!address) throw new HttpError(404, "Address not found");
  if (input.isDefault) user.addresses.forEach((entry) => { entry.isDefault = false; });
  Object.assign(address, input);
  await user.save();
  response.json({ addresses: user.addresses });
});

router.delete("/addresses/:id", async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) throw new HttpError(400, "Invalid address ID");
  const user = await User.findById(request.user!.id).select("addresses");
  if (!user) throw new HttpError(404, "Account not found");
  const address = user.addresses.id(request.params.id);
  if (!address) throw new HttpError(404, "Address not found");
  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && user.addresses[0]) user.addresses[0].isDefault = true;
  await user.save();
  response.json({ addresses: user.addresses });
});

export default router;
