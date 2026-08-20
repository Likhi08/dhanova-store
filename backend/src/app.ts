import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";
import { connectToDatabase } from "./config/database.js";
import { errorHandler } from "./lib/errors.js";
import authRoutes from "./routes/auth.js";
import cartRoutes from "./routes/cart.js";
import productRoutes from "./routes/products.js";
import paymentRoutes from "./routes/payments.js";
import orderRoutes from "./routes/orders.js";
import accountRoutes from "./routes/account.js";
import User from "./models/User.js";
import { fileURLToPath } from "node:url";

const app = express();
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
let initialization: Promise<void> | null = null;

async function initialize() {
  await connectToDatabase();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    await User.findOneAndUpdate(
      { email: adminEmail },
      { $set: { name: process.env.ADMIN_NAME?.trim() || "Dhanova Admin", email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 12), role: "admin" } },
      { upsert: true, runValidators: true },
    );
  }
}

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(async (_request, _response, next) => {
  try {
    initialization ??= initialize();
    await initialization;
    next();
  } catch (error) {
    initialization = null;
    next(error);
  }
});
app.use("/api/uploads", express.static(fileURLToPath(new URL("../uploads/", import.meta.url)), { fallthrough: false, maxAge: "7d" }));
app.get("/api/health", (_request, response) => response.json({ status: "ok" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false }), authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/payments", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false }), paymentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/account", accountRoutes);
app.use(errorHandler);

export default app;
