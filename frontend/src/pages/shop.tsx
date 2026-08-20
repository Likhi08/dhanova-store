import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Apple, ArrowRight, Baby, BadgePercent, CalendarClock, Clock3, Cookie, CupSoda, Gift, Grape, Grid2X2, Heart, House, LampDesk, Milk, Minus, Plus, RefreshCcw, Repeat2,
  Edit3, PackageOpen, Search, ShieldCheck, ShoppingBag, ShoppingBasket, SlidersHorizontal,
  Smartphone, Sparkles, Truck,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import ProductImage from "@/components/ProductImage";
import { apiFetch } from "@/lib/api";

type Product = {
  _id: string; name: string; brand: string; category: string; subcategory: string;
  price: number; wholesalePrice?: number; compareAtPrice?: number; rating?: number; stock: number; quantity: string; images: string[];
};
type FilterOptions = { categories: string[]; subcategories: string[]; brands: string[] };
type Pagination = { page: number; pages: number; total: number };
type QuickEditFields = {
  name: string; price: string; compareAtPrice: string; wholesalePrice: string; rating: string; quantity: string; stock: string;
};

const categoryCards = [
  { name: "Fresh Produce", label: "Fruits & Vegetables", icon: Apple, tone: "lime", image: "/product-images/fresh-produce/0.webp" },
  { name: "Dairy & Breakfast", label: "Dairy & Breakfast", icon: Milk, tone: "blue", image: "/product-images/dairy-breakfast/0.webp" },
  { name: "Snacks", label: "Snacks & Munchies", icon: Cookie, tone: "orange", image: "/product-images/snacks/0.webp" },
  { name: "Dry Fruits", label: "Dry Fruits & Nuts", icon: Grape, tone: "sand", image: "/product-images/snacks/2.webp" },
  { name: "Pantry & Staples", label: "Pantry & Staples", icon: PackageOpen, tone: "violet", image: "/product-images/catalogue-fallbacks/staples.webp" },
  { name: "Beverages", label: "Cold Drinks & Juices", icon: CupSoda, tone: "violet", image: "/product-images/beverages/0.webp" },
  { name: "Household", label: "Home & Cleaning", icon: House, tone: "sand", image: "/product-images/catalogue-fallbacks/household.webp" },
  { name: "Home Decor", label: "Home Decor", icon: LampDesk, tone: "pink", image: "/product-images/catalogue-fallbacks/home-decor.webp" },
  { name: "Personal Care", label: "Beauty & Personal Care", icon: Sparkles, tone: "pink", image: "/product-images/personal-care/0.webp" },
  { name: "Baby Care", label: "Baby Care", icon: Baby, tone: "blue", image: "/product-images/baby-care/catalogue-fallback.webp" },
  { name: "Electronics", label: "Electronics", icon: Smartphone, tone: "lime", image: "/product-images/electronics/6.webp" },
];

const defaultFilters = { q: "", category: "", subcategory: "", brand: "", sort: "newest" };
const capitalizeFirst = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

export default function Home() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [options, setOptions] = useState<FilterOptions>({ categories: [], subcategories: [], brands: [] });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [updatingCart, setUpdatingCart] = useState<string[]>([]);
  const [savedProducts, setSavedProducts] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);
  const [quickEditFields, setQuickEditFields] = useState<QuickEditFields | null>(null);
  const [quickEditSaving, setQuickEditSaving] = useState(false);

  async function loadProducts(nextFilters = filters, page = 1, append = false) {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => value && params.set(key, value));
    params.set("page", String(page));
    params.set("limit", "100");
    try {
      const response = await apiFetch(`/products?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load products");
      setProducts((current) => append ? [...current, ...(data.products ?? [])] : (data.products ?? []));
      setPagination(data.pagination ?? { page: 1, pages: 1, total: 0 });
    } catch {
      setMessage("Backend unavailable. Start the API server on port 4000.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    apiFetch("/auth/me").then((response) => response.json()).then((data) => {
      setIsAdmin(data.user?.role === "admin");
    }).catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const requestedCategory = typeof router.query.category === "string" ? router.query.category : "";
    const requestedSearch = typeof router.query.q === "string" ? router.query.q : "";
    const nextFilters = { ...defaultFilters, category: requestedCategory, q: requestedSearch };
    const params = new URLSearchParams();
    if (requestedCategory) params.set("category", requestedCategory);
    if (requestedSearch) params.set("q", requestedSearch);
    params.set("limit", "100");
    setFilters(nextFilters);
    setLoading(true);
    const productRequest = !requestedCategory && !requestedSearch
      ? apiFetch("/products/homepage").then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Unable to load homepage products");
          return data;
        })
      : apiFetch(`/products?${params}`).then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Unable to load products");
          return data;
        });
    apiFetch("/products/filters").then((response) => response.ok ? response.json() : null).then((filterData) => {
      if (filterData) setOptions({ categories: filterData.categories ?? [], subcategories: filterData.subcategories ?? [], brands: filterData.brands ?? [] });
    }).catch(() => undefined);
    productRequest.then((productData) => {
      setProducts(productData.products ?? []);
      setPagination(productData.pagination ?? { page: 1, pages: 1, total: 0 });
      if (requestedCategory || requestedSearch || window.location.hash === "#catalog") {
        window.requestAnimationFrame(() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" }));
      }
    }).catch(() => setMessage("Backend unavailable. Start the API server on port 4000.")).finally(() => setLoading(false));
  }, [router.isReady, router.query.category, router.query.q]);

  useEffect(() => {
    apiFetch("/cart").then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      syncCartQuantities(data.cart?.items ?? []);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    try { setSavedProducts(JSON.parse(window.localStorage.getItem("dhanova_saved_products") ?? "[]")); } catch { setSavedProducts([]); }
  }, []);

  const productGroups = useMemo(() => {
    const grouped = new Map<string, Product[]>();
    products.forEach((product) => {
      const label = product.category === "Dry Fruits" ? "Dry Fruits — Wholesale Packs" : product.subcategory || product.category;
      grouped.set(label, [...(grouped.get(label) ?? []), product]);
    });
    return Array.from(grouped.entries());
  }, [products]);

  function chooseCategory(category: string) {
    void router.push({ pathname: "/products", query: { category } });
  }

  function syncCartQuantities(items: Array<{ quantity: number; product: null | { _id: string } }>) {
    setCartQuantities(Object.fromEntries(items.filter((item) => item.product).map((item) => [item.product!._id, item.quantity])));
  }

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
      if (!response.ok) {
        setMessage(data.error === "Authentication required" ? "Log in to add products to your cart." : data.error ?? "Unable to update cart");
      } else {
        syncCartQuantities(data.cart?.items ?? []);
        setMessage(quantity <= 0 ? "Removed from your cart." : "Cart updated.");
      }
    } catch {
      setMessage("Unable to update your cart right now.");
    } finally {
      setUpdatingCart((current) => current.filter((id) => id !== productId));
      window.setTimeout(() => setMessage(""), 2500);
    }
  }

  function toggleSavedProduct(productId: string) {
    setSavedProducts((current) => {
      const next = current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId];
      window.localStorage.setItem("dhanova_saved_products", JSON.stringify(next));
      return next;
    });
  }

  function openQuickEdit(product: Product) {
    setQuickEditProduct(product);
    setQuickEditFields({
      name: product.name,
      price: String(product.price),
      compareAtPrice: product.compareAtPrice === undefined ? "" : String(product.compareAtPrice),
      wholesalePrice: product.wholesalePrice === undefined ? "" : String(product.wholesalePrice),
      rating: String(product.rating ?? 0),
      quantity: product.quantity,
      stock: String(product.stock),
    });
    setMessage("");
  }

  async function saveQuickEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quickEditProduct || !quickEditFields) return;
    setQuickEditSaving(true);
    try {
      if (quickEditFields.compareAtPrice !== "" && Number(quickEditFields.compareAtPrice) < Number(quickEditFields.price)) throw new Error("Original price cannot be lower than the selling price.");
      const response = await apiFetch(`/products/${quickEditProduct._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quickEditFields.name,
          price: Number(quickEditFields.price),
          ...(quickEditFields.compareAtPrice !== "" ? { compareAtPrice: Number(quickEditFields.compareAtPrice) } : {}),
          ...(quickEditFields.wholesalePrice !== "" ? { wholesalePrice: Number(quickEditFields.wholesalePrice) } : {}),
          rating: Number(quickEditFields.rating),
          quantity: quickEditFields.quantity,
          stock: Number(quickEditFields.stock),
        }),
      });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error ?? "Unable to update the product");
      setProducts((current) => current.map((product) => product._id === updated._id ? { ...product, ...updated } : product));
      setQuickEditProduct(null);
      setQuickEditFields(null);
      setMessage(`${updated.name} updated successfully.`);
      window.setTimeout(() => setMessage(""), 2500);
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Unable to update the product.");
    } finally {
      setQuickEditSaving(false);
    }
  }

  return (
    <>
      <Head><title>Dhanova — Everything you need, delivered fast</title><meta name="description" content="Shop groceries, fresh produce, snacks, household essentials, personal care, electronics and more at Dhanova." /></Head>
      <SiteHeader />

      <main>
        <section className="marketplace-promos page-shell">
          <article className="promo-card purple"><p>ALL NEW DHANOVA EXPERIENCE</p><h2><span>₹0</span> handling fee</h2><div><strong>Everyday low prices</strong><strong>Fast delivery</strong></div><button type="button" onClick={() => { setMessage("Free-delivery benefit unlocked for eligible baskets."); window.setTimeout(() => setMessage(""), 2800); }}>Unlock benefit</button></article>
          <article className="promo-card aqua"><p>YOUR DAILY STORE</p><h2>Essentials delivered <em>in minutes.</em></h2><button onClick={() => chooseCategory("Fresh Produce")}>Shop fresh</button></article>
        </section>
        <section className="marketplace-actions page-shell" aria-label="Explore shopping options">
          <Link href="/categories"><Grid2X2 size={25} /><span><strong>Categories</strong><small>Browse every department</small></span><ArrowRight size={17} /></Link>
          <Link href="/discover/top-picks"><Gift size={25} /><span><strong>Top picks & deals</strong><small>Offers selected for you</small></span><ArrowRight size={17} /></Link>
          <Link href="/discover/buy-again"><Repeat2 size={25} /><span><strong>Buy again</strong><small>Repeat previous purchases</small></span><ArrowRight size={17} /></Link>
          <Link href="/discover/daily"><CalendarClock size={25} /><span><strong>Dhanova Daily</strong><small>Subscribe to essentials</small></span><ArrowRight size={17} /></Link>
        </section>
        <section className="hero-premium">
          <div className="hero-content">
            <span className="pill">YOUR EVERYDAY STORE</span>
            <h1>Welcome to<br /><em>Dhanova.</em></h1>
            <p>Welcome in. Discover fresh groceries, favourite snacks, home essentials and everyday surprises—all brought together for faster, happier shopping.</p>
            <div className="hero-actions"><a className="button lime-button" href="#catalog">Start shopping <ArrowRight size={18} /></a><Link className="text-link" href={{ pathname: "/products", query: { category: "Fresh Produce" } }}>Shop fresh</Link></div>
            <div className="hero-stat"><strong>30K+</strong><span>products across<br />everyday categories</span></div>
          </div>
          <div className="hero-image" role="img" aria-label="Fresh groceries, household goods, personal care and everyday essentials" />
        </section>

        <section className="category-section page-shell">
          <div className="title-row"><div><p className="kicker">SHOP BY CATEGORY</p><h2>What do you need?</h2></div><a href="#catalog">View everything <ArrowRight size={16} /></a></div>
          <div className="category-grid">
            {categoryCards.map(({ name, label, icon: Icon, tone }) => (
              <button className={`category-card ${tone}`} key={name} onClick={() => chooseCategory(name)}>
                <Icon size={34} strokeWidth={1.5} /><span>{label}</span><ArrowRight className="category-arrow" size={18} />
              </button>
            ))}
          </div>
        </section>

        <section className="editorial-banner page-shell">
          <div className="editorial-copy"><p className="kicker">THE DHANOVA ADVANTAGE</p><span className="editorial-pill"><BadgePercent size={15} /> Smarter shopping starts here</span><h2>One cart.<br /><em>Every need.</em></h2><p>Fresh groceries, trending snacks, home care, beauty, baby essentials and electronics—curated into one joyful, dependable shopping experience.</p><div className="editorial-actions"><Link href="/categories" className="button editorial-primary">Explore categories <ArrowRight size={18} /></Link><Link href="/discover/top-picks" className="editorial-secondary">See today’s deals</Link></div></div>
          <div className="editorial-showcase"><div className="editorial-image"><img src="/quick-commerce-hero.png" alt="Fresh groceries and everyday Dhanova essentials" /><span>Everything you need</span></div><div className="editorial-benefits"><div><Clock3 size={21} /><strong>8–15 min</strong><span>Quick delivery</span></div><div><ShieldCheck size={21} /><strong>Quality first</strong><span>Carefully checked</span></div><div><Gift size={21} /><strong>Better value</strong><span>Deals every day</span></div></div></div>
        </section>

        <section className="catalog-section page-shell" id="catalog">
          <div className="title-row catalog-title"><div><p className="kicker">EVERYDAY LOW PRICES</p><h2>Popular near you.</h2></div><span className="result-count">{loading ? "Loading products…" : `Showing ${products.length} of ${pagination.total.toLocaleString("en-IN")} products`}</span></div>
          {filters.q && (
            <div className="search-result-sort" aria-label="Search result sorting">
              <div><Search size={18} /><span>Results for</span><strong>“{filters.q}”</strong></div>
              <label><SlidersHorizontal size={17} /><span>Sort results</span><select aria-label="Sort search results" value={filters.sort} onChange={(event) => { const next = { ...filters, sort: event.target.value }; setFilters(next); void loadProducts(next); }}><option value="newest">Recommended</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name: A–Z</option></select></label>
            </div>
          )}
          <form className="filter-toolbar" onSubmit={(event: FormEvent) => { event.preventDefault(); void loadProducts(); }}>
            <label className="search-field"><Search size={18} /><input aria-label="Search products" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Search milk, chips, soap, chargers…" /></label>
            <div className="filter-label"><SlidersHorizontal size={17} /><span>Filter by</span></div>
            <select aria-label="Category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{options.categories.map((item) => <option key={item}>{item}</option>)}</select>
            <select aria-label="Product type" value={filters.subcategory} onChange={(event) => setFilters({ ...filters, subcategory: event.target.value })}><option value="">All types</option>{options.subcategories.map((item) => <option key={item}>{item}</option>)}</select>
            <select aria-label="Brand" value={filters.brand} onChange={(event) => setFilters({ ...filters, brand: event.target.value })}><option value="">All brands</option>{options.brands.map((item) => <option key={item}>{item}</option>)}</select>
            <select aria-label="Sort products" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}><option value="newest">Newest first</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name A–Z</option></select>
            <button type="submit" className="apply-button">Apply</button>
          </form>

          {message && <div className="toast"><ShoppingBag size={17} />{message}</div>}
          {loading ? (
            <div className="loading-grid">{[1,2,3,4].map((item) => <div className="product-skeleton" key={item} />)}</div>
          ) : products.length === 0 ? (
            <div className="empty-state premium-empty"><div className="empty-icon"><ShoppingBasket size={28} /></div><h3>Your store is ready to stock.</h3><p>Add groceries, household goods, personal care, electronics and other products from the admin dashboard.</p><Link href="/admin" className="button dark-button">Open admin <ArrowRight size={17} /></Link></div>
          ) : (
            <div className="product-shelves">
              {productGroups.map(([groupName, groupProducts]) => (
                <section className="product-shelf" key={groupName}>
                  <div className="shelf-heading"><h3>{groupName}</h3><Link href={{ pathname: "/products", query: groupName === "Dry Fruits — Wholesale Packs" ? { category: "Dry Fruits" } : productGroups.length === 1 && filters.category ? { category: filters.category, subcategory: groupName } : { subcategory: groupName } }}>See all <ArrowRight size={14} /></Link></div>
                  <div className="shelf-scroll">
                    {groupProducts.map((product) => (
                      <article className="shelf-card" key={product._id}>
                        <Link className="shelf-image" href={`/product/${product._id}`}><span>{product.stock > 0 ? "AVAILABLE" : "SOLD OUT"}</span>{product.images[0] ? <ProductImage src={product.images[0]} alt={product.name} sizes="168px" /> : <ShoppingBasket size={46} />}</Link>
                        <p className="shelf-brand">{capitalizeFirst(product.brand)}</p><p className="shelf-quantity">Weight: {product.quantity}</p>
                        <h4><Link href={`/product/${product._id}`}>{product.name}</Link></h4>
                        <div className="shelf-rating"><strong>{(product.rating ?? 0) > 0 ? `★ ${(product.rating ?? 0).toFixed(1)}` : "New"}</strong><span>·</span>{product.stock > 0 ? `${product.stock} available` : "Out of stock"}</div>
                        {product.wholesalePrice !== undefined && <p className="wholesale-price">Wholesale: ₹{product.wholesalePrice.toLocaleString("en-IN")}</p>}
                        <div className="shelf-price"><div><strong>₹{product.price.toLocaleString("en-IN")}</strong>{product.compareAtPrice !== undefined && product.compareAtPrice > product.price && <del>₹{product.compareAtPrice.toLocaleString("en-IN")}</del>}</div>{isAdmin ? <button className="shelf-quick-edit" onClick={() => openQuickEdit(product)}><Edit3 size={12} /> Edit</button> : cartQuantities[product._id] > 0 ? <div className="shelf-quantity-control" aria-label={`Quantity for ${product.name}`}><button aria-label={`Decrease ${product.name} quantity`} disabled={updatingCart.includes(product._id)} onClick={() => void changeCartQuantity(product._id, cartQuantities[product._id] - 1)}><Minus size={13} /></button><output aria-live="polite">{cartQuantities[product._id]}</output><button aria-label={`Increase ${product.name} quantity`} disabled={updatingCart.includes(product._id) || cartQuantities[product._id] >= Math.min(99, product.stock)} onClick={() => void changeCartQuantity(product._id, cartQuantities[product._id] + 1)}><Plus size={13} /></button></div> : <button className="shelf-add" aria-label={`Add ${product.name} to cart`} disabled={product.stock === 0 || updatingCart.includes(product._id)} onClick={() => void changeCartQuantity(product._id, 1, true)}>ADD</button>}</div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
          {!loading && false && products.length > 0 && (
            <div className="product-grid">
              {products.map((product, index) => (
                <article className="product-card" key={product._id}>
                  <div className="product-image">
                    {index < 3 && <span className="product-badge">{index === 0 ? "NEW" : "POPULAR"}</span>}
                    <button className={savedProducts.includes(product._id) ? "wishlist saved" : "wishlist"} aria-label={`${savedProducts.includes(product._id) ? "Remove" : "Save"} ${product.name}`} aria-pressed={savedProducts.includes(product._id)} onClick={() => toggleSavedProduct(product._id)}><Heart size={18} fill={savedProducts.includes(product._id) ? "currentColor" : "none"} /></button>
                    <Link className="product-image-link" href={`/product/${product._id}`}>{product.images[0] ? <ProductImage src={product.images[0]} alt={product.name} sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 250px" /> : <div className="product-placeholder"><ShoppingBasket size={58} strokeWidth={1} /><span>Image coming soon</span></div>}</Link>
                  </div>
                  <div className="product-info"><p className="product-category">{product.category}{product.subcategory ? ` / ${product.subcategory}` : ""}</p><h3><Link href={`/product/${product._id}`}>{product.name}</Link></h3><p className="product-brand">{capitalizeFirst(product.brand)}</p><p className="product-quantity">{product.quantity}</p><div className="price-row"><div><strong>₹{product.price.toLocaleString("en-IN")}</strong>{product.compareAtPrice !== undefined && product.compareAtPrice > product.price && <del>₹{product.compareAtPrice.toLocaleString("en-IN")}</del>}{cartQuantities[product._id] > 0 && <small className="product-line-total">₹{product.price.toLocaleString("en-IN")} × {cartQuantities[product._id]} = ₹{(product.price * cartQuantities[product._id]).toLocaleString("en-IN")}</small>}</div>{cartQuantities[product._id] > 0 ? <div className="product-quantity-control" aria-label={`Quantity for ${product.name}`}><button aria-label={`Decrease ${product.name} quantity`} disabled={updatingCart.includes(product._id)} onClick={() => void changeCartQuantity(product._id, cartQuantities[product._id] - 1)}><Minus size={15} /></button><output>{cartQuantities[product._id]}</output><button aria-label={`Increase ${product.name} quantity`} disabled={updatingCart.includes(product._id) || cartQuantities[product._id] >= Math.min(99, product.stock)} onClick={() => void changeCartQuantity(product._id, cartQuantities[product._id] + 1)}><Plus size={15} /></button></div> : <button className="add-cart" disabled={product.stock === 0 || updatingCart.includes(product._id)} onClick={() => void changeCartQuantity(product._id, 1, true)} aria-label={`Add ${product.name} to cart`}><ShoppingBag size={18} /></button>}</div></div>
                </article>
              ))}
            </div>
          )}
          {!loading && pagination.page < pagination.pages && (
            <div className="load-more-wrap">
              <button className="button dark-button" onClick={() => void loadProducts(filters, pagination.page + 1, true)}>
                Load more products <ArrowRight size={17} />
              </button>
              <span>Page {pagination.page} of {pagination.pages}</span>
            </div>
          )}
        </section>

        <section className="benefits"><div><Truck size={23} /><span><strong>Fast doorstep delivery</strong>Across your neighbourhood</span></div><div><ShieldCheck size={23} /><span><strong>Quality checked</strong>Fresh and genuine products</span></div><div><RefreshCcw size={23} /><span><strong>Easy support</strong>Help when you need it</span></div></section>
      </main>
      {quickEditProduct && quickEditFields && (
        <div className="quick-edit-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuickEditProduct(null); }}>
          <section className="quick-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-edit-title">
            <div className="quick-edit-heading"><div><p>ADMIN QUICK EDIT</p><h2 id="quick-edit-title">Update product</h2></div><button type="button" onClick={() => setQuickEditProduct(null)} aria-label="Close quick edit">×</button></div>
            <form onSubmit={saveQuickEdit}>
              <label>Product name<input required minLength={2} value={quickEditFields.name} onChange={(event) => setQuickEditFields({ ...quickEditFields, name: event.target.value })} /></label>
              <div className="quick-edit-row"><label>Selling price (₹)<input required type="number" min="0" step="0.01" value={quickEditFields.price} onChange={(event) => setQuickEditFields({ ...quickEditFields, price: event.target.value })} /></label><label>Original price (₹)<input type="number" min="0" step="0.01" value={quickEditFields.compareAtPrice} onChange={(event) => setQuickEditFields({ ...quickEditFields, compareAtPrice: event.target.value })} /></label></div>
              <div className="quick-edit-row"><label>Wholesale price (₹)<input type="number" min="0" step="0.01" value={quickEditFields.wholesalePrice} onChange={(event) => setQuickEditFields({ ...quickEditFields, wholesalePrice: event.target.value })} /></label><label>Available stock<input required type="number" min="0" step="1" value={quickEditFields.stock} onChange={(event) => setQuickEditFields({ ...quickEditFields, stock: event.target.value })} /></label></div>
              <label>Product rating (0–5)<input required type="number" min="0" max="5" step="0.1" value={quickEditFields.rating} onChange={(event) => setQuickEditFields({ ...quickEditFields, rating: event.target.value })} /></label>
              <label>Pack quantity<input required value={quickEditFields.quantity} onChange={(event) => setQuickEditFields({ ...quickEditFields, quantity: event.target.value })} placeholder="1 unit / 500 g / Pack of 6" /></label>
              <div className="quick-edit-actions"><button type="button" onClick={() => setQuickEditProduct(null)}>Cancel</button><button type="submit" disabled={quickEditSaving}>{quickEditSaving ? "Saving…" : "Save changes"}</button></div>
            </form>
          </section>
        </div>
      )}
      <SiteFooter />
    </>
  );
}
