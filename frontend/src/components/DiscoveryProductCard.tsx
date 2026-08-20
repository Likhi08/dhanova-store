import Link from "next/link";
import { Bell, Clock3, Heart, ShoppingBag } from "lucide-react";
import ProductImage from "@/components/ProductImage";

export type DiscoveryProduct = {
  _id: string; name: string; brand: string; category: string; subcategory: string;
  price: number; compareAtPrice?: number; rating?: number; stock: number; quantity: string; images: string[];
};

type Props = {
  product: DiscoveryProduct;
  saved: boolean;
  busy?: boolean;
  actionLabel?: string;
  onAction: () => void;
  onSave: () => void;
};

export default function DiscoveryProductCard({ product, saved, busy, actionLabel = "ADD", onAction, onSave }: Props) {
  const discount = product.compareAtPrice && product.compareAtPrice > product.price ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  return <article className="discovery-product-card">
    <div className="discovery-product-image">
      {discount > 0 && <span className="discount-chip">{discount}% OFF</span>}
      <button type="button" className={saved ? "discovery-heart saved" : "discovery-heart"} onClick={onSave} aria-label={`${saved ? "Remove" : "Save"} ${product.name}`}><Heart size={18} fill={saved ? "currentColor" : "none"} /></button>
      <Link href={`/product/${product._id}`}>{product.images[0] ? <ProductImage src={product.images[0]} alt={product.name} sizes="(max-width: 680px) 50vw, (max-width: 1050px) 33vw, 280px" /> : <ShoppingBag size={46} />}</Link>
      {product.stock === 0 && <span className="sold-out-chip">SOLD OUT</span>}
    </div>
    <div className="discovery-product-copy">
      <p>{product.brand}</p><h3><Link href={`/product/${product._id}`}>{product.name}</Link></h3>
      <span className="discovery-pack">{product.quantity}</span>
      <div className="discovery-delivery"><Clock3 size={13} /> Delivery in 8–15 mins</div>
      <div className="discovery-price"><div><strong>₹{product.price.toLocaleString("en-IN")}</strong>{product.compareAtPrice && product.compareAtPrice > product.price && <del>₹{product.compareAtPrice.toLocaleString("en-IN")}</del>}</div><button type="button" disabled={busy} onClick={onAction}>{product.stock === 0 ? <><Bell size={15} /> Notify</> : actionLabel}</button></div>
    </div>
  </article>;
}
