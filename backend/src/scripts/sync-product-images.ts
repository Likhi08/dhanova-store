import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type SourceProduct = {
  title: string;
  category: string;
  thumbnail: string;
};

type ProductResponse = {
  products: SourceProduct[];
};

const departmentSources: Record<string, string[]> = {
  "fresh-produce": ["groceries"],
  "dairy-breakfast": ["groceries"],
  snacks: ["groceries"],
  beverages: ["groceries"],
  household: ["kitchen-accessories", "home-decoration", "groceries"],
  "personal-care": ["beauty", "skin-care", "fragrances"],
  "baby-care": ["skin-care", "beauty", "groceries"],
  electronics: ["mobile-accessories", "smartphones", "laptops", "tablets"],
};

const preferredTitles: Record<string, string[]> = {
  "fresh-produce": ["Apple", "Potatoes", "Red Onions", "Cucumber", "Green Bell Pepper", "Green Chili Pepper", "Kiwi", "Lemon", "Strawberry", "Mulberry"],
  "dairy-breakfast": ["Milk", "Eggs", "Ice Cream", "Protein Powder", "Honey Jar", "Nescafe Coffee", "Rice", "Apple", "Juice", "Water"],
  snacks: ["Honey Jar", "Ice Cream", "Protein Powder", "Rice", "Nescafe Coffee", "Apple", "Strawberry", "Mulberry", "Cooking Oil", "Soft Drinks"],
  beverages: ["Water", "Soft Drinks", "Juice", "Milk", "Nescafe Coffee", "Lemon", "Coconut 2", "Honey Jar", "Orange 3", "Strawberry"],
};

const response = await fetch("https://dummyjson.com/products?limit=0&select=title,category,thumbnail");
if (!response.ok) throw new Error(`Product image feed returned ${response.status}`);
const { products } = (await response.json()) as ProductResponse;
const outputRoot = path.resolve(process.cwd(), "../frontend/public/product-images");

for (const [department, categories] of Object.entries(departmentSources)) {
  const candidates = products.filter((product) => categories.includes(product.category));
  const preferred = preferredTitles[department]
    ?.map((title) => candidates.find((product) => product.title === title))
    .filter((product): product is SourceProduct => Boolean(product));
  const chosen = [...(preferred ?? []), ...candidates.filter((product) => !preferred?.includes(product))].slice(0, 10);
  if (chosen.length < 10) throw new Error(`Not enough source images for ${department}`);

  const departmentDirectory = path.join(outputRoot, department);
  await mkdir(departmentDirectory, { recursive: true });
  await Promise.all(chosen.map(async (product, index) => {
    const imageResponse = await fetch(product.thumbnail);
    if (!imageResponse.ok) throw new Error(`Could not download ${product.thumbnail}`);
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    await writeFile(path.join(departmentDirectory, `${index}.webp`), bytes);
  }));
  console.log(`${department}: downloaded ${chosen.length} local product images`);
}

console.log(`Image library ready at ${outputRoot}`);
