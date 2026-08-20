import type { NextApiRequest, NextApiResponse } from "next";
import catalogue from "@/data/products.json";

type Product = {
  _id: string; name: string; description: string; brand: string; category: string; subcategory?: string;
  price: number; wholesalePrice?: number; compareAtPrice?: number; rating?: number; stock: number;
  quantity: string; images: string[]; tags?: string[]; isActive?: boolean; createdAt?: string;
};

const products = (catalogue as Product[]).filter((product) => product.isActive !== false);
const homepageCategories = ["Fresh Produce", "Dairy & Breakfast", "Snacks", "Dry Fruits", "Pantry & Staples", "Beverages", "Household", "Home Decor", "Personal Care", "Baby Care", "Electronics"];

function text(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

export default function handler(request: NextApiRequest, response: NextApiResponse) {
  response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
  if (request.method !== "GET") return response.status(405).json({ error: "This production catalogue is read-only." });
  const route = Array.isArray(request.query.path) ? request.query.path[0] : undefined;

  if (route === "homepage") {
    const featured = homepageCategories.flatMap((category) => products.filter((product) => product.category === category).slice(0, 12));
    return response.json({ products: featured, pagination: { page: 1, limit: featured.length, total: products.length, pages: 1 } });
  }
  if (route === "filters") {
    const values = (key: "category" | "subcategory" | "brand") => [...new Set(products.map((product) => product[key]).filter(Boolean) as string[])].sort();
    const prices = products.map((product) => product.price);
    return response.json({ categories: values("category"), subcategories: values("subcategory"), brands: values("brand"), priceRange: { min: Math.min(...prices), max: Math.max(...prices) } });
  }
  if (route === "suggestions") {
    const query = text(request.query.q).trim().toLowerCase();
    const matches = query ? products.filter((product) => product.name.toLowerCase().startsWith(query)).slice(0, 8) : [];
    return response.json({ products: matches.map(({ _id, name, brand, price, images }) => ({ _id, name, brand, price, images })) });
  }
  if (route) {
    const product = products.find((item) => item._id === route);
    return product ? response.json(product) : response.status(404).json({ error: "Product not found" });
  }

  const query = text(request.query.q).trim().toLowerCase();
  const category = text(request.query.category);
  const subcategory = text(request.query.subcategory);
  const brand = text(request.query.brand);
  const minPrice = Number(text(request.query.minPrice));
  const maxPrice = Number(text(request.query.maxPrice));
  const sort = text(request.query.sort) || "newest";
  const page = Math.max(1, Number(text(request.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, Number(text(request.query.limit)) || 24));
  let matches = products.filter((product) => {
    const searchable = `${product.name} ${product.brand} ${(product.tags ?? []).join(" ")}`.toLowerCase();
    return (!query || searchable.includes(query)) && (!category || product.category === category) && (!subcategory || product.subcategory === subcategory) && (!brand || product.brand === brand) && (!minPrice || product.price >= minPrice) && (!maxPrice || product.price <= maxPrice);
  });
  matches = [...matches].sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "name" ? a.name.localeCompare(b.name) : String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  const total = matches.length;
  const start = (page - 1) * limit;
  return response.json({ products: matches.slice(start, start + limit), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}
