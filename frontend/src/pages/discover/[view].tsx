import Head from "next/head";
import Link from "next/link";
import { ArrowRight, CalendarClock, Gift, Repeat2, Sparkles } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import DiscoveryProductCard, { DiscoveryProduct } from "@/components/DiscoveryProductCard";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { apiFetch } from "@/lib/api";

const views = {
  "top-picks": { eyebrow: "TRENDING NOW", title: "Top picks for you", copy: "Popular deals, highly rated favourites, and fresh discoveries." },
  "buy-again": { eyebrow: "YOUR SHOPPING HISTORY", title: "Buy again", copy: "Quickly reorder products from your previous purchases." },
  daily: { eyebrow: "SUBSCRIBE & RELAX", title: "Dhanova Daily", copy: "Schedule everyday essentials and never run out again." },
  saved: { eyebrow: "YOUR FAVOURITES", title: "Saved items", copy: "Everything you loved, kept together for easy shopping." },
} as const;
type View = keyof typeof views;

const categories = ["All", "Fresh Produce", "Dairy & Breakfast", "Snacks", "Beverages", "Personal Care"];

export default function DiscoverPage() {
  const router = useRouter();
  const requested = typeof router.query.view === "string" ? router.query.view : "top-picks";
  const view: View = requested in views ? requested as View : "top-picks";
  const meta = views[view];
  const [products, setProducts] = useState<DiscoveryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [busy, setBusy] = useState<string[]>([]);
  const [category, setCategory] = useState("All");

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem("dhanova_saved_products") ?? "[]")); } catch { setSaved([]); }
    try { setSubscriptions(JSON.parse(localStorage.getItem("dhanova_subscriptions") ?? "[]")); } catch { setSubscriptions([]); }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    setLoading(true); setMessage(""); setCategory("All");
    const savedIds: string[] = view === "saved" ? (() => { try { return JSON.parse(localStorage.getItem("dhanova_saved_products") ?? "[]"); } catch { return []; } })() : [];
    const request = view === "saved" ? Promise.all(savedIds.slice(0, 48).map((id) => apiFetch(`/products/${id}`).then(async (response) => response.ok ? response.json() : null))).then((items) => ({ ok: true, json: async () => ({ products: items.filter(Boolean) }) })) : view === "buy-again" ? apiFetch("/orders/buy-again") : view === "daily"
      ? Promise.all([apiFetch("/products?category=Fresh%20Produce&sort=price-asc&limit=18"), apiFetch("/products?category=Dairy%20%26%20Breakfast&sort=price-asc&limit=18")]).then(async ([fresh, dairy]) => ({ ok: fresh.ok && dairy.ok, json: async () => { const [a,b] = await Promise.all([fresh.json(), dairy.json()]); return { products: [...(a.products ?? []), ...(b.products ?? [])] }; } }))
      : apiFetch("/products?sort=price-asc&limit=36");
    Promise.resolve(request).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load products");
      setProducts(data.products ?? []);
    }).catch((error) => setMessage(view === "buy-again" && String(error).includes("Authentication") ? "Log in to see products from your previous orders." : "Unable to load this collection right now.")).finally(() => setLoading(false));
  }, [router.isReady, view]);

  const visible = useMemo(() => category === "All" ? products : products.filter((product) => product.category === category), [category, products]);

  function toggleSaved(id: string) {
    setSaved((current) => { const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; localStorage.setItem("dhanova_saved_products", JSON.stringify(next)); return next; });
  }

  async function act(product: DiscoveryProduct) {
    if (product.stock === 0) { setMessage(`We will notify you when ${product.name} is back.`); return; }
    if (view === "daily") {
      setSubscriptions((current) => { const next = current.includes(product._id) ? current.filter((id) => id !== product._id) : [...current, product._id]; localStorage.setItem("dhanova_subscriptions", JSON.stringify(next)); return next; });
      setMessage(subscriptions.includes(product._id) ? "Subscription removed." : "Added to your weekly Dhanova Daily list.");
      window.setTimeout(() => setMessage(""), 2600); return;
    }
    setBusy((current) => [...current, product._id]);
    try {
      const response = await apiFetch("/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product._id, quantity: 1 }) });
      const data = await response.json();
      setMessage(response.ok ? `${product.name} added to cart.` : data.error === "Authentication required" ? "Log in to add products to your cart." : data.error ?? "Unable to update cart.");
    } catch { setMessage("Unable to update your cart right now."); }
    finally { setBusy((current) => current.filter((id) => id !== product._id)); window.setTimeout(() => setMessage(""), 2600); }
  }

  return <>
    <Head><title>{meta.title} | Dhanova</title><meta name="description" content={meta.copy} /></Head>
    <SiteHeader />
    <main className={`discover-page page-shell ${view}`}>
      <section className="discover-hero"><div><p>{meta.eyebrow}</p><h1>{meta.title}</h1><span>{meta.copy}</span></div><div className="discover-hero-icon">{view === "daily" ? <CalendarClock size={48} /> : view === "buy-again" ? <Repeat2 size={48} /> : <Sparkles size={48} />}</div></section>
      {view === "top-picks" && <section className="offer-banner"><Gift size={28} /><div><strong>Extra value unlocked</strong><span>Save more on selected picks and enjoy free delivery on eligible baskets.</span></div><Link href="/products">Shop all <ArrowRight size={16} /></Link></section>}
      {view === "daily" && <section className="daily-benefits"><div><strong>5% cashback</strong><span>On recurring essentials</span></div><div><strong>Flexible schedule</strong><span>Update your list anytime</span></div><div><strong>Morning delivery</strong><span>Convenient doorstep drop</span></div></section>}
      <div className="discovery-tabs" aria-label="Filter collection">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
      {message && <div className="discovery-notice">{message}{message.startsWith("Log in") && <Link href="/login">Log in</Link>}</div>}
      {loading ? <div className="loading-grid">{[1,2,3,4,5,6,7,8].map((item) => <div className="product-skeleton" key={item} />)}</div> : visible.length ? <div className="discovery-grid">{visible.map((product) => <DiscoveryProductCard key={product._id} product={product} saved={saved.includes(product._id)} busy={busy.includes(product._id)} actionLabel={view === "daily" ? subscriptions.includes(product._id) ? "Subscribed ✓" : "Subscribe" : view === "buy-again" ? "ADD AGAIN" : "ADD"} onSave={() => toggleSaved(product._id)} onAction={() => void act(product)} />)}</div> : <div className="premium-empty"><h2>{view === "buy-again" ? "Nothing to buy again yet" : "No products found"}</h2><p>{view === "buy-again" ? "Complete your first order and your favourites will appear here." : "Try another category."}</p><Link href="/products" className="button dark-button">Start shopping</Link></div>}
    </main>
    <SiteFooter />
  </>;
}
