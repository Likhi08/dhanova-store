import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { useRouter } from "next/router";
import {
  Apple, ArrowLeft, Baby, ChevronDown, Cookie, CornerUpLeft, CupSoda, Grape, House, LampDesk, Menu, Mic, Milk, PackageOpen, Search,
  ShoppingBag, Smartphone, Sparkles, UserRound, X, Zap,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import AdminHeader from "@/components/AdminHeader";

type SessionUser = { name: string; role: "customer" | "admin" } | null;
type ProductSuggestion = { _id: string; name: string; brand: string; price: number; images: string[] };
type SpeechRecognitionResultEventLike = { results: ArrayLike<{ 0: { transcript: string } }> };
type SpeechRecognitionLike = { lang: string; interimResults: boolean; start: () => void; onresult: (event: SpeechRecognitionResultEventLike) => void; onend: () => void; onerror: () => void };
declare global { interface Window { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike } }

const navigation = [
  { category: "", href: "/", label: "Home", icon: House },
  { category: "Fresh Produce", label: "Fresh", icon: Apple },
  { category: "Dairy & Breakfast", label: "Dairy", icon: Milk },
  { category: "Snacks", label: "Snacks", icon: Cookie },
  { category: "Dry Fruits", label: "Dry Fruits", icon: Grape },
  { category: "Beverages", label: "Drinks", icon: CupSoda },
  { category: "Pantry & Staples", label: "Staples", icon: PackageOpen },
  { category: "Household", label: "Household", icon: ShoppingBag },
  { category: "Home Decor", label: "Decor", icon: LampDesk },
  { category: "Personal Care", label: "Beauty", icon: Sparkles },
  { category: "Electronics", label: "Electronics", icon: Smartphone },
  { category: "Baby Care", label: "Baby", icon: Baby },
];

export default function SiteHeader() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<SessionUser>(null);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (router.isReady) setSearch(typeof router.query.q === "string" ? router.query.q : "");
  }, [router.isReady, router.query.q]);

  useEffect(() => {
    apiFetch("/auth/me").then((response) => response.json()).then((data) => setUser(data.user ?? null)).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSuggestionsLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const response = await apiFetch(`/products/suggestions?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load suggestions");
        setSuggestions(data.products ?? []);
        setSuggestionsOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setSuggestionsOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  useEffect(() => {
    if (!mobileSearchOpen || !window.matchMedia("(max-width: 760px)").matches) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileSearchOpen]);

  function searchProducts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    setSuggestionsOpen(false);
    setMobileSearchOpen(false);
    void router.push({ pathname: "/products", query: query ? { q: query } : {} });
  }

  function openSuggestion(productId: string) {
    setSuggestionsOpen(false);
    setMobileSearchOpen(false);
    void router.push(`/product/${productId}`);
  }

  function startVoiceSearch() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) { setSearch(""); setSuggestionsOpen(true); return; }
    const recognition = new Recognition();
    recognition.lang = "en-IN"; recognition.interimResults = false; setListening(true);
    recognition.onresult = (event) => { const transcript = event.results[0]?.[0]?.transcript?.trim() ?? ""; setSearch(transcript); if (transcript) void router.push({ pathname: "/products", query: { q: transcript } }); };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.start();
  }

  if (user?.role === "admin") return <AdminHeader userName={user.name} />;

  return (
    <header className="commerce-header">
      <div className="header-primary">
        <Link className="brand-logo" href="/" aria-label="Dhanova home"><img src="/brand/dhanova-logo.png" alt="Dhanova — Innovating Tomorrow" /></Link>
        <button className="delivery-selector" type="button" aria-label="Select delivery location" onClick={() => void router.push(user ? { pathname: "/account", query: { section: "addresses" } } : "/login")}>
          <span><Zap size={16} fill="currentColor" />Delivery in minutes</span>
          <small>Select location <ChevronDown size={14} /></small>
        </button>
        <form className="header-search" onSubmit={searchProducts} onFocus={() => { setMobileSearchOpen(true); if (search.trim()) setSuggestionsOpen(true); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSuggestionsOpen(false); }}>
          <Search size={22} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setSuggestionsOpen(false); }} placeholder='Search for "apple juice"' aria-label="Search products" aria-autocomplete="list" aria-expanded={suggestionsOpen} aria-controls="product-suggestions" autoComplete="off" />
          <button type="button" className={listening ? "voice-search listening" : "voice-search"} onClick={startVoiceSearch} aria-label={listening ? "Listening for product search" : "Search by voice"}><Mic size={20} /></button>
          <button type="submit">Search</button>
          {suggestionsOpen && <div className="search-suggestions" id="product-suggestions" role="listbox" aria-label="Product suggestions">
            <div className="suggestion-heading"><span>Products starting with “{search.trim()}”</span><small>{suggestions.length} found</small></div>
            {suggestionsLoading ? <p className="suggestion-status">Searching…</p> : suggestions.length ? suggestions.map((product) => <button type="button" role="option" className="suggestion-item" key={product._id} onClick={() => openSuggestion(product._id)}>{product.images[0] ? <ProductImage src={product.images[0]} alt="" sizes="40px" /> : <span className="suggestion-placeholder"><ShoppingBag size={18} /></span>}<span><strong>{product.name}</strong><small>{product.brand}</small></span><b>₹{product.price.toLocaleString("en-IN")}</b></button>) : <p className="suggestion-status">No product names start with “{search.trim()}”.</p>}
            <button type="submit" className="suggestion-view-all">Search all products for “{search.trim()}”</button>
          </div>}
        </form>
        {mobileSearchOpen && <div className="mobile-search-overlay" role="dialog" aria-modal="true" aria-label="Search products">
          <form className="mobile-search-bar" onSubmit={searchProducts}>
            <button type="button" className="mobile-search-back" aria-label="Close search" onClick={() => { setMobileSearchOpen(false); setSuggestionsOpen(false); }}><ArrowLeft size={27} /></button>
            <Search size={25} aria-hidden="true" />
            <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search products" autoComplete="off" />
            {search && <button type="button" className="mobile-search-clear" aria-label="Clear search" onClick={() => setSearch("")}><X size={25} /></button>}
          </form>
          <div className="mobile-suggestion-list" role="listbox" aria-label="Product suggestions">
            {suggestionsLoading ? <p className="mobile-suggestion-status">Searching…</p> : search.trim() && suggestions.length ? suggestions.map((product) => <div className="mobile-suggestion-row" key={product._id}>
              <button type="button" role="option" className="mobile-suggestion-product" onClick={() => openSuggestion(product._id)}>{product.images[0] ? <ProductImage src={product.images[0]} alt="" sizes="48px" /> : <span><ShoppingBag size={21} /></span>}<strong>{product.name}</strong></button>
              <button type="button" className="mobile-suggestion-fill" aria-label={`Use ${product.name} as search text`} onClick={() => setSearch(product.name)}><CornerUpLeft size={24} /></button>
            </div>) : search.trim() ? <p className="mobile-suggestion-status">No product names start with “{search.trim()}”.</p> : <p className="mobile-suggestion-status">Start typing to find products.</p>}
          </div>
        </div>}
        <div className="header-actions">
          <Link className={router.pathname === "/" || router.pathname === "/store" ? "store-home-button active" : "store-home-button"} href="/" aria-label="Dhanova store home"><House size={25} /><span>Home</span></Link>
          <Link href={user ? { pathname: "/account", query: { section: "profile" } } : "/login"} aria-label="Profile"><UserRound size={27} /><span>{user?.name?.split(" ")[0] ?? "Login"}</span></Link>
          <Link href="/cart" aria-label="Shopping cart"><ShoppingBag size={27} /><span>Cart</span></Link>
          <button className="menu-toggle" aria-label="Toggle categories" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={24} /> : <Menu size={24} />}</button>
        </div>
      </div>
      <nav className={menuOpen ? "main-nav open" : "main-nav"} aria-label="Product categories">
        <div className="nav-scroll">
          {navigation.map(({ category, href, label, icon: Icon }) => {
            const active = category ? router.pathname === "/products" && router.query.category === category : router.pathname === href;
            return (
              <Link key={label} href={category ? { pathname: "/products", query: { category } } : (href ?? "/")} className={active ? "active" : ""} onClick={() => setMenuOpen(false)}>
                <Icon size={21} /><span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
