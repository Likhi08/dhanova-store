import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Heart, Minus, Plus, Search, ShoppingBag, ShoppingBasket, SlidersHorizontal } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import ProductImage from "@/components/ProductImage";
import { apiFetch } from "@/lib/api";

type Product = {
  _id: string; name: string; brand: string; category: string; subcategory: string;
  price: number; compareAtPrice?: number; stock: number; quantity: string; images: string[];
};
type FilterOptions = { categories: string[]; subcategories: string[]; brands: string[] };
type Pagination = { page: number; pages: number; total: number };

const emptyFilters = { q: "", category: "", subcategory: "", brand: "", sort: "newest" };
const capitalizeFirst = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [options, setOptions] = useState<FilterOptions>({ categories: [], subcategories: [], brands: [] });
  const [filters, setFilters] = useState(emptyFilters);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [updatingCart, setUpdatingCart] = useState<string[]>([]);
  const [savedProducts, setSavedProducts] = useState<string[]>([]);

  function syncCart(items: Array<{ quantity: number; product: null | { _id: string } }>) {
    setCartQuantities(Object.fromEntries(items.filter((item) => item.product).map((item) => [item.product!._id, item.quantity])));
  }

  async function loadProducts(nextFilters = filters, page = 1, append = false) {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => value && params.set(key, value));
    params.set("page", String(page));
    params.set("limit", "24");
    try {
      const response = await apiFetch(`/products?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load products");
      setProducts((current) => append ? [...current, ...(data.products ?? [])] : (data.products ?? []));
      setPagination(data.pagination ?? { page: 1, pages: 1, total: 0 });
    } catch {
      setMessage("Unable to load products right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try { setSavedProducts(JSON.parse(localStorage.getItem("dhanova_saved_products") ?? "[]")); } catch { setSavedProducts([]); }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const requestedSubcategory = typeof router.query.subcategory === "string" ? router.query.subcategory : "";
    const isDryFruitsShelf = requestedSubcategory === "Dry Fruits — Wholesale Packs";
    const nextFilters = {
      ...emptyFilters,
      q: typeof router.query.q === "string" ? router.query.q : "",
      category: isDryFruitsShelf ? "Dry Fruits" : typeof router.query.category === "string" ? router.query.category : "",
      subcategory: isDryFruitsShelf ? "" : requestedSubcategory,
    };
    setFilters(nextFilters);
    void loadProducts(nextFilters);
    apiFetch("/products/filters").then((response) => response.ok ? response.json() : null).then((data) => {
      if (data) setOptions({ categories: data.categories ?? [], subcategories: data.subcategories ?? [], brands: data.brands ?? [] });
    }).catch(() => undefined);
    apiFetch("/cart").then(async (response) => response.ok ? response.json() : null).then((data) => {
      if (data) syncCart(data.cart?.items ?? []);
    }).catch(() => undefined);
  }, [router.isReady, router.query.category, router.query.q, router.query.subcategory]);

  async function changeCartQuantity(productId: string, quantity: number, add = false) {
    if (updatingCart.includes(productId)) return;
    setUpdatingCart((current) => [...current, productId]);
    try {
      const response = await apiFetch("/cart", {
        method: add ? "POST" : quantity <= 0 ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quantity <= 0 && !add ? { productId } : { productId, quantity: add ? 1 : quantity }),
      });
      const data = await response.json();
      if (!response.ok) setMessage(data.error === "Authentication required" ? "Log in to add products to your cart." : data.error ?? "Unable to update cart.");
      else { syncCart(data.cart?.items ?? []); setMessage(quantity <= 0 ? "Removed from your cart." : "Cart updated."); }
    } catch { setMessage("Unable to update your cart right now."); }
    finally {
      setUpdatingCart((current) => current.filter((id) => id !== productId));
      window.setTimeout(() => setMessage(""), 2500);
    }
  }

  function toggleSavedProduct(productId: string) {
    setSavedProducts((current) => { const next = current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]; localStorage.setItem("dhanova_saved_products", JSON.stringify(next)); return next; });
  }

  const title = filters.subcategory || filters.category || (filters.q ? `Results for “${filters.q}”` : "All products");

  return (
    <>
      <Head><title>{title} | Dhanova</title><meta name="description" content={`Shop ${title} products at Dhanova.`} /></Head>
      <SiteHeader />
      <main className="collection-page page-shell">
        <div className="title-row catalog-title"><div><p className="kicker">SHOP THE FULL RANGE</p><h1>{title}</h1></div><span className="result-count">{loading ? "Loading products…" : `${pagination.total.toLocaleString("en-IN")} products`}</span></div>

        <form className="filter-toolbar collection-filters" onSubmit={(event: FormEvent) => { event.preventDefault(); void loadProducts(filters); }}>
          <label className="search-field"><Search size={18} /><input aria-label="Search products" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Search in this collection…" /></label>
          <div className="filter-label"><SlidersHorizontal size={17} /><span>Filter by</span></div>
          <select aria-label="Category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{options.categories.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Product type" value={filters.subcategory} onChange={(event) => setFilters({ ...filters, subcategory: event.target.value })}><option value="">All types</option>{options.subcategories.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Brand" value={filters.brand} onChange={(event) => setFilters({ ...filters, brand: event.target.value })}><option value="">All brands</option>{options.brands.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Sort products" value={filters.sort} onChange={(event) => { const next = { ...filters, sort: event.target.value }; setFilters(next); void loadProducts(next); }}><option value="newest">Newest first</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name A–Z</option></select>
          <button type="submit" className="apply-button">Apply</button>
        </form>

        {message && <div className="toast"><ShoppingBag size={17} />{message}</div>}
        {loading ? <div className="loading-grid">{[1,2,3,4,5,6,7,8].map((item) => <div className="product-skeleton" key={item} />)}</div> : products.length === 0 ? (
          <div className="empty-state premium-empty"><div className="empty-icon"><ShoppingBasket size={28} /></div><h3>No products found.</h3><p>Try changing the category, product type, brand, or search.</p></div>
        ) : <div className="product-grid">{products.map((product, index) => (
          <article className="product-card" key={product._id}>
            <div className="product-image">{product.compareAtPrice && product.compareAtPrice > product.price && <span className="discount-chip">{Math.round((1 - product.price / product.compareAtPrice) * 100)}% OFF</span>}<button type="button" className={savedProducts.includes(product._id) ? "wishlist saved" : "wishlist"} onClick={() => toggleSavedProduct(product._id)} aria-label={`${savedProducts.includes(product._id) ? "Remove" : "Save"} ${product.name}`}><Heart size={18} fill={savedProducts.includes(product._id) ? "currentColor" : "none"} /></button><Link className="product-image-link" href={`/product/${product._id}`}>{product.images[0] ? <ProductImage src={product.images[0]} alt={product.name} sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 250px" eager={index < 4} /> : <div className="product-placeholder"><ShoppingBasket size={58} /><span>Image coming soon</span></div>}</Link></div>
            <div className="product-info"><p className="product-category">{product.category}{product.subcategory ? ` / ${product.subcategory}` : ""}</p><h3><Link href={`/product/${product._id}`}>{product.name}</Link></h3><p className="product-brand">{capitalizeFirst(product.brand)}</p><p className="product-quantity">{product.quantity}</p><div className="price-row"><div><strong>₹{product.price.toLocaleString("en-IN")}</strong>{product.compareAtPrice !== undefined && product.compareAtPrice > product.price && <del>₹{product.compareAtPrice.toLocaleString("en-IN")}</del>}</div>{cartQuantities[product._id] > 0 ? <div className="product-quantity-control" aria-label={`Quantity for ${product.name}`}><button type="button" aria-label={`Decrease ${product.name} quantity`} disabled={updatingCart.includes(product._id)} onClick={() => void changeCartQuantity(product._id, cartQuantities[product._id] - 1)}><Minus size={15} /></button><output>{cartQuantities[product._id]}</output><button type="button" aria-label={`Increase ${product.name} quantity`} disabled={updatingCart.includes(product._id) || cartQuantities[product._id] >= Math.min(99, product.stock)} onClick={() => void changeCartQuantity(product._id, cartQuantities[product._id] + 1)}><Plus size={15} /></button></div> : <button type="button" className="add-cart" disabled={product.stock === 0 || updatingCart.includes(product._id)} onClick={() => void changeCartQuantity(product._id, 1, true)} aria-label={`Add ${product.name} to cart`}><ShoppingBag size={18} /></button>}</div></div>
          </article>
        ))}</div>}

        {!loading && pagination.page < pagination.pages && <div className="load-more-wrap"><button className="button dark-button" onClick={() => void loadProducts(filters, pagination.page + 1, true)}>Load more products</button><span>Page {pagination.page} of {pagination.pages}</span></div>}
      </main>
      <SiteFooter />
    </>
  );
}
