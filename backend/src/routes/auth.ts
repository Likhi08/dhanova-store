import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { clearSessionCookie, createSessionToken, readSession, setSessionCookie } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import User from "../models/User.js";

const router = Router();
const registerSchema = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().toLowerCase(), password: z.string().min(8).max(128) });
const loginSchema = z.object({ email: z.string().trim().email().toLowerCase(), password: z.string().min(1).max(128) });

router.post("/register", async (request, response) => {
  const input = registerSchema.parse(request.body);
  if (await User.exists({ email: input.email })) throw new HttpError(409, "An account with this email already exists");
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const user = await User.create({ name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 12), role: adminEmails.includes(input.email) ? "admin" : "customer" });
  const sessionUser = { id: user.id, name: user.name, email: user.email, role: user.role } as const;
  setSessionCookie(response, await createSessionToken(sessionUser));
  response.status(201).json({ user: sessionUser });
});

router.post("/login", async (request, response) => {
  const input = loginSchema.parse(request.body);
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw new HttpError(401, "Invalid email or password");
  const sessionUser = { id: user.id, name: user.name, email: user.email, role: user.role } as const;
  setSessionCookie(response, await createSessionToken(sessionUser));
  response.json({ user: sessionUser });
});

router.post("/logout", (_request, response) => { clearSessionCookie(response); response.json({ success: true }); });
router.get("/me", async (request, response) => { response.json({ user: await readSession(request) }); });

export default router;
