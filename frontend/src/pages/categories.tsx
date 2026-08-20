import Head from "next/head";
import Link from "next/link";
import { Heart, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import ProductImage from "@/components/ProductImage";

const groups = [
  { title: "Fresh", items: [
    ["Fresh Produce", "Fruits & Vegetables", "/product-images/fresh-produce/0.webp"], ["Dairy & Breakfast", "Dairy & Breakfast", "/product-images/dairy-breakfast/0.webp"], ["Baby Care", "Baby Care", "/product-images/baby-care/catalogue-fallback.webp"],
  ] },
  { title: "Grocery & Kitchen", items: [
    ["Pantry & Staples", "Atta, Rice, Dal & More", "/product-images/catalogue-fallbacks/staples.webp"], ["Dry Fruits", "Dry Fruits & Nuts", "/product-images/snacks/2.webp"], ["Household", "Home & Cleaning", "/product-images/household/0.webp"], ["Home Decor", "Kitchen & Home Decor", "/product-images/catalogue-fallbacks/home-decor.webp"],
  ] },
  { title: "Snacks & Drinks", items: [
    ["Snacks", "Namkeen, Chips & Biscuits", "/product-images/snacks/0.webp"], ["Beverages", "Cold Drinks & Juices", "/product-images/beverages/0.webp"],
  ] },
  { title: "Lifestyle & More", items: [
    ["Personal Care", "Beauty & Personal Care", "/product-images/personal-care/0.webp"], ["Electronics", "Electronics & Accessories", "/product-images/electronics/6.webp"],
  ] },
] as const;

export default function CategoriesPage() {
  const [search, setSearch] = useState("");
  const visibleGroups = useMemo(() => groups.map((group) => ({ ...group, items: group.items.filter(([category, label]) => `${category} ${label}`.toLowerCase().includes(search.toLowerCase())) })).filter((group) => group.items.length), [search]);
  return <>
    <Head><title>All Categories | Dhanova</title><meta name="description" content="Browse every Dhanova shopping category." /></Head>
    <SiteHeader />
    <main className="categories-page page-shell">
      <div className="categories-heading"><div><p className="kicker">EXPLORE DHANOVA</p><h1>All Categories</h1><span>Find everything you need, organised for faster shopping.</span></div><Link href="/discover/top-picks"><Sparkles size={18} /> View top picks</Link></div>
      <label className="category-search"><Search size={22} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories" aria-label="Search categories" /><Link href="/discover/saved" aria-label="View saved favourites"><Heart size={21} /></Link></label>
      <div className="category-groups">{visibleGroups.map((group) => <section key={group.title}><h2>{group.title}</h2><div>{group.items.map(([category, label, image]) => <Link className="category-tile" key={category} href={{ pathname: "/products", query: { category } }}><span><ProductImage src={image} alt="" sizes="(max-width: 680px) 42vw, 190px" /></span><strong>{label}</strong><small>Shop now</small></Link>)}</div></section>)}</div>
      {!visibleGroups.length && <div className="premium-empty"><h2>No categories found</h2><p>Try a different search.</p></div>}
    </main>
    <SiteFooter />
  </>;
}
