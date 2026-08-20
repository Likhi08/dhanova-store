import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronRight, MapPin, Minus, Plus, Share2, ShieldCheck, ShoppingBag, SlidersHorizontal, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import ProductImage from "@/components/ProductImage";
import { apiFetch } from "@/lib/api";

type Product = {
  _id: string; name: string; description: string; brand: string; category: string; subcategory: string;
  price: number; wholesalePrice?: number; compareAtPrice?: number; rating?: number; stock: number; quantity: string; images: string[];
  specifications?: Record<string, string>;
};

type CartEntry = { quantity: number; product: null | { _id: string } };
const capitalizeFirst = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

export default function ProductDetailPage() {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [cartQuantity, setCartQuantity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!router.isReady || typeof router.query.id !== "string") return;
    const productId = router.query.id;
    setLoading(true);
    apiFetch(`/products/${productId}`).then(async (response) => {
      if (!response.ok) throw new Error("Product not found");
      return response.json();
    }).then((productData) => {
      setProduct(productData);
      setSelectedImage(0);
    }).catch(() => setProduct(null)).finally(() => setLoading(false));
    apiFetch("/cart").then(async (response) => response.ok ? response.json() : null).then((cartData) => {
      const entry = (cartData?.cart?.items ?? []).find((item: CartEntry) => item.product?._id === productId);
      setCartQuantity(entry?.quantity ?? 0);
    }).catch(() => setCartQuantity(0));
  }, [router.isReady, router.query.id]);

  const validOriginalPrice = product?.compareAtPrice !== undefined && product.compareAtPrice > product.price ? product.compareAtPrice : undefined;
  const discount = product && validOriginalPrice ? validOriginalPrice - product.price : 0;

  async function changeQuantity(quantity: number, add = false) {
    if (!product || updating) return;
    setUpdating(true);
    setMessage("");
    try {
      const response = await apiFetch("/cart", {
        method: add ? "POST" : quantity <= 0 ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quantity <= 0 && !add ? { productId: product._id } : { productId: product._id, quantity: add ? 1 : quantity }),
      });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error === "Authentication required" ? "Please log in to add this product." : data.error ?? "Unable to update cart");
      const entry = (data.cart?.items ?? []).find((item: CartEntry) => item.product?._id === product._id);
      setCartQuantity(entry?.quantity ?? 0);
    } catch {
      setMessage("Unable to update your cart right now.");
    } finally {
      setUpdating(false);
    }
  }

  async function shareProduct() {
    if (!product) return;
    try {
      if (navigator.share) await navigator.share({ title: product.name, text: product.name, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); setMessage("Product link copied."); }
    } catch { setMessage("Unable to share this product right now."); }
  }

  if (loading) return <><SiteHeader /><main className="product-detail-shell"><div className="product-detail-loading">Loading product…</div></main></>;
  if (!product) return <><SiteHeader /><main className="product-detail-shell"><div className="empty-state"><h1>Product not found</h1><Link href="/">Return to the store</Link></div></main><SiteFooter /></>;

  const highlights = [
    ["Brand", capitalizeFirst(product.brand)],
    ["Product type", product.subcategory || product.category],
    ["Model name", product.name.replace(product.brand, "").trim()],
    ["Key features", product.description],
    ["Weight / net quantity", product.quantity],
    ...(product.wholesalePrice !== undefined ? [["Wholesale price", `₹${product.wholesalePrice.toLocaleString("en-IN")}`]] : []),
    ["Category", product.category],
    ["Availability", product.specifications?.sourceStockStatus ?? (product.stock > 0 ? `${product.stock} units available` : "Out of stock")],
    ...Object.entries(product.specifications ?? {}).filter(([key]) => !["company", "packQuantity"].includes(key)).map(([key, value]) => [key.replace(/([A-Z])/g, " $1"), value]),
  ];

  return (
    <>
      <Head><title>{product.name} | Dhanova</title><meta name="description" content={product.description} /></Head>
      <SiteHeader />
      <main className="product-detail-shell">
        <div className="product-detail-toolbar">
          <Link href={{ pathname: "/", query: { category: product.category }, hash: "catalog" }}><SlidersHorizontal size={17} /> Browse &amp; filter {product.category}</Link>
          <span>Compare prices and narrow products by brand or product type.</span>
        </div>
        <div className="product-detail-grid">
          <section className="product-gallery">
            <div className="product-thumbnails">{product.images.map((image, index) => <button key={image} className={index === selectedImage ? "active" : ""} onClick={() => setSelectedImage(index)} aria-label={`Show image ${index + 1} of ${product.name}`}><ProductImage src={image} alt="" sizes="60px" /></button>)}</div>
            <div className="product-main-image">{product.images[selectedImage] ? <ProductImage src={product.images[selectedImage]} alt={product.name} sizes="(max-width: 900px) 100vw, 560px" eager /> : <ShoppingBag size={82} strokeWidth={1} />}</div>
            <div className="detail-cart-action">
              {cartQuantity > 0 ? <div className="detail-quantity-control" aria-label={`Quantity for ${product.name}`}><button aria-label={`Decrease ${product.name} quantity`} disabled={updating} onClick={() => void changeQuantity(cartQuantity - 1)}><Minus size={22} /></button><output aria-live="polite">{cartQuantity}</output><button aria-label={`Increase ${product.name} quantity`} disabled={updating || cartQuantity >= Math.min(99, product.stock)} onClick={() => void changeQuantity(cartQuantity + 1)}><Plus size={22} /></button></div> : <button className="detail-add-button" disabled={updating || product.stock === 0} onClick={() => void changeQuantity(1, true)}>Add to Cart</button>}
              {cartQuantity > 0 && <strong className="detail-line-total">₹{product.price.toLocaleString("en-IN")} × {cartQuantity} = ₹{(product.price * cartQuantity).toLocaleString("en-IN")}</strong>}
              {message && <p className="error">{message}</p>}
            </div>
          </section>

          <div className="product-detail-content">
            <section className="product-buy-panel">
              <div className="detail-brand-row"><span>{capitalizeFirst(product.brand)}<ChevronRight size={16} /></span><button aria-label="Share product" onClick={() => void shareProduct()}><Share2 size={19} /></button></div>
              <h1>{product.name}</h1>
              <div className="detail-rating" aria-label={`Product rating ${(product.rating ?? 0).toFixed(1)} out of 5`}><strong>★ {(product.rating ?? 0).toFixed(1)}</strong><span>{(product.rating ?? 0) > 0 ? "Product rating" : "Not rated yet"}</span></div>
              <p className="detail-meta">Net Qty: {product.quantity}<span>•</span><strong>{product.stock > 0 ? `${product.stock} available` : "Out of stock"}</strong></p>
              <strong className="detail-price">₹{product.price.toLocaleString("en-IN")}</strong>
              <p className="detail-mrp">MRP {validOriginalPrice ? <del>₹{validOriginalPrice.toLocaleString("en-IN")}</del> : "—"} <span>(incl. of all taxes)</span>{discount > 0 && <strong>₹{discount.toLocaleString("en-IN")} OFF</strong>}</p>
              <div className="detail-benefits"><div><ShieldCheck size={30} /><span>Secure checkout</span></div><div><MapPin size={30} /><span>Address delivery</span></div><div><Truck size={30} /><span>Delivery tracking</span></div></div>
            </section>

            <section className="product-information-card"><h2>Highlights</h2><dl>{highlights.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
            <section className="product-information-card"><h2>Information</h2><dl>
              <div><dt>Disclaimer</dt><dd>Images are for representational purposes. Please read the package label for manufacturing details, directions for use, allergen information, and other product-specific information before use.</dd></div>
              <div><dt>Customer care details</dt><dd>For assistance, contact support@dhanova.store.</dd></div>
              <div><dt>Seller</dt><dd>Dhanova marketplace</dd></div>
              <div><dt>Country of origin</dt><dd>{product.specifications?.countryOfOrigin ?? "Refer to the product package"}</dd></div>
              <div><dt>Shelf life / warranty</dt><dd>{product.category === "Electronics" ? "Manufacturer warranty details are available on the package." : "Please refer to the product package for shelf-life details."}</dd></div>
            </dl></section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
