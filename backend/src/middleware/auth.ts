import type { NextFunction, Request, Response } from "express";
import { jwtVerify, SignJWT } from "jose";
import { HttpError } from "../lib/errors.js";
import User from "../models/User.js";

export type UserRole = "customer" | "admin";
export type SessionUser = { id: string; email: string; name: string; role: UserRole };

const COOKIE_NAME = "site3_session";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error("JWT_SECRET must be at least 32 characters long");
  return new TextEncoder().encode(value);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt()
    .setExpirationTime(`${SESSION_AGE_SECONDS}s`).sign(secret());
}

export function setSessionCookie(response: Response, token: string) {
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_AGE_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

export async function readSession(request: Request): Promise<SessionUser | null> {
  const token = request.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.name !== "string" || (payload.role !== "customer" && payload.role !== "admin")) return null;
    return { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
  } catch { return null; }
}

export async function requireUser(request: Request, _response: Response, next: NextFunction) {
  const user = await readSession(request);
  if (!user) return next(new HttpError(401, "Authentication required"));
  request.user = user;
  next();
}

export async function requireAdmin(request: Request, _response: Response, next: NextFunction) {
  const user = await readSession(request);
  if (!user) return next(new HttpError(401, "Authentication required"));
  if (user.role !== "admin") return next(new HttpError(403, "Admin access required"));
  const current = await User.findById(user.id).select("role").lean();
  if (!current || current.role !== "admin") return next(new HttpError(403, "Admin access required"));
  request.user = user;
  next();
}
