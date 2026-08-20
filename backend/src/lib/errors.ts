import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ error: error.issues[0]?.message ?? "Invalid request" });
    return;
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    response.status(409).json({ error: "A record with this value already exists" });
    return;
  }
  console.error(error);
  response.status(500).json({ error: "Internal server error" });
};
