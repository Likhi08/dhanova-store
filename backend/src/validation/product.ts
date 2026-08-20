import { z } from "zod";

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(5000),
  brand: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(100),
  subcategory: z.string().trim().max(100).default(""),
  price: z.coerce.number().min(0),
  wholesalePrice: z.coerce.number().min(0).optional(),
  compareAtPrice: z.coerce.number().min(0).optional(),
  rating: z.coerce.number().min(0).max(5).default(0),
  stock: z.coerce.number().int().min(0),
  quantity: z.string().trim().min(1).max(50),
  images: z.array(z.string().trim().refine(
    (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
    "Image must be a local path beginning with / or a full http(s) URL",
  )).max(10).default([]),
  specifications: z.record(z.string(), z.string()).default({}),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  isActive: z.boolean().default(true),
});

export const productUpdateSchema = productInputSchema.partial();
