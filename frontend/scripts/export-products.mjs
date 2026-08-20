import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = process.env.LOCAL_API_URL ?? "http://localhost:4000/api";
const firstResponse = await fetch(`${baseUrl}/products?page=1&limit=100&sort=newest`);
if (!firstResponse.ok) throw new Error(`Unable to read local catalogue: ${firstResponse.status}`);
const firstPage = await firstResponse.json();
const products = [...firstPage.products];

for (let page = 2; page <= firstPage.pagination.pages; page += 1) {
  const response = await fetch(`${baseUrl}/products?page=${page}&limit=100&sort=newest`);
  if (!response.ok) throw new Error(`Unable to read catalogue page ${page}: ${response.status}`);
  const data = await response.json();
  products.push(...data.products);
}

await mkdir(new URL("../src/data/", import.meta.url), { recursive: true });
await writeFile(new URL("../src/data/products.json", import.meta.url), JSON.stringify(products));
console.log(`Exported ${products.length} products for production browsing.`);
