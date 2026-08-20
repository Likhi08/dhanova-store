import Head from "next/head";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Edit3, Image as ImageIcon, Plus, Search, Trash2, X } from "lucide-react";
import AdminHeader from "@/components/AdminHeader";
import ProductImage from "@/components/ProductImage";
import { apiFetch } from "@/lib/api";

type Product = {
  _id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  brand: string;
  price: number;
  wholesalePrice?: number;
  compareAtPrice?: number;
  rating: number;
  quantity: string;
  stock: number;
  images: string[];
};

type ProductFields = Omit<Product, "_id" | "images"> & { image: string };

const emptyProduct: ProductFields = {
  name: "", description: "", category: "", subcategory: "", brand: "",
  price: 0, wholesalePrice: undefined, compareAtPrice: undefined, rating: 0, quantity: "", stock: 0, image: "",
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<ProductFields>(emptyProduct);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  async function loadProducts(query = search) {
    const params = new URLSearchParams({ limit: "100", sort: "name" });
    if (query.trim()) params.set("q", query.trim());
    const response = await apiFetch(`/products?${params}`);
    const data = await response.json();
    setProducts(data.products ?? []);
    setTotal(data.pagination?.total ?? 0);
  }

  useEffect(() => {
    apiFetch("/auth/me").then((response) => response.json()).then((data) => {
      const isAdmin = data.user?.role === "admin";
      setAuthorized(isAdmin);
      if (isAdmin) void loadProducts();
    }).catch(() => setAuthorized(false));
  }, []);

  function updateField<K extends keyof ProductFields>(key: K, value: ProductFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function startEditing(product: Product) {
    setEditingId(product._id);
    setFields({
      name: product.name, description: product.description, category: product.category,
      subcategory: product.subcategory, brand: product.brand, price: product.price,
      wholesalePrice: product.wholesalePrice, compareAtPrice: product.compareAtPrice, rating: product.rating ?? 0, quantity: product.quantity, stock: product.stock,
      image: product.images[0] ?? "",
    });
    setSelectedImage(null);
    setImagePreview(product.images[0] ?? "");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setFields(emptyProduct);
    setSelectedImage(null);
    setImagePreview("");
    setMessage("");
  }

  function chooseImage(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Choose a JPG, PNG, or WebP image from your device.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("The product image must be 5 MB or smaller.");
      return;
    }
    setSelectedImage(file);
    setMessage("");
    const reader = new FileReader();
    reader.onload = () => setImagePreview(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (fields.compareAtPrice !== undefined && Number(fields.compareAtPrice) < Number(fields.price)) throw new Error("Original price cannot be lower than the selling price.");
      let image = fields.image;
      if (selectedImage) {
        const uploadResponse = await apiFetch("/products/upload-image", {
          method: "POST",
          headers: { "Content-Type": selectedImage.type },
          body: selectedImage,
        });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadData.error ?? "Unable to upload the image");
        image = uploadData.image;
      }
      if (!image) throw new Error("Choose a product image from your device");

      const payload = {
      name: fields.name,
      slug: slugify(fields.name),
      description: fields.description,
      category: fields.category,
      subcategory: fields.subcategory,
      brand: fields.brand,
      price: Number(fields.price),
      ...(fields.wholesalePrice !== undefined && fields.wholesalePrice !== null && String(fields.wholesalePrice) !== "" ? { wholesalePrice: Number(fields.wholesalePrice) } : {}),
      ...(fields.compareAtPrice !== undefined && fields.compareAtPrice !== null && String(fields.compareAtPrice) !== "" ? { compareAtPrice: Number(fields.compareAtPrice) } : {}),
      rating: Number(fields.rating),
      quantity: fields.quantity,
      stock: Number(fields.stock),
      images: [image],
      tags: [],
      specifications: {},
      };

      const response = await apiFetch(editingId ? `/products/${editingId}` : "/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error ?? `Unable to ${editingId ? "update" : "add"} product`);
      setMessage(editingId ? "Product updated successfully" : "Product added successfully");
      setEditingId(null);
      setFields(emptyProduct);
      setSelectedImage(null);
      setImagePreview("");
      await loadProducts();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Unable to reach the product service.");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(id: string) {
    if (!window.confirm("Remove this product from the store?")) return;
    const response = await apiFetch(`/products/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Unable to remove product");
    if (editingId === id) resetForm();
    setProducts((current) => current.filter((product) => product._id !== id));
    setTotal((current) => Math.max(0, current - 1));
    setMessage("Product removed successfully");
  }

  return (
    <>
      <Head><title>Admin | Dhanova</title></Head>
      <AdminHeader />
      <main className="content-page">
        <p className="eyebrow">CONTROL PANEL</p><h1>Product administration</h1>
        {authorized === null ? <p>Checking access…</p> : !authorized ? (
          <div className="empty-state"><h2>Admin access required</h2><p>Log in with the Dhanova administrator account.</p><Link href="/login">Go to login</Link></div>
        ) : (
          <div className="admin-layout">
            <section className="form-card admin-form">
              <div className="admin-form-heading">
                <div><p className="kicker">{editingId ? "EDIT PRODUCT" : "NEW PRODUCT"}</p><h2>{editingId ? "Update product" : "Add a product"}</h2></div>
                {editingId && <button type="button" className="icon-button" onClick={resetForm} aria-label="Cancel editing"><X size={18} /></button>}
              </div>
              {imagePreview || fields.image ? <img className="admin-image-preview" src={imagePreview || fields.image} alt="Product preview" /> : <div className="admin-image-empty"><ImageIcon size={30} /><span>Image preview</span></div>}
              <form onSubmit={saveProduct}>
                <label className="device-image-field">Product image<input type="file" accept="image/jpeg,image/png,image/webp" required={!editingId && !fields.image} onChange={(event) => chooseImage(event.target.files?.[0])} /><small>Choose a JPG, PNG, or WebP file from this device (maximum 5 MB).</small></label>
                <label>Name<input value={fields.name} onChange={(event) => updateField("name", event.target.value)} required /></label>
                <label>Description<textarea value={fields.description} onChange={(event) => updateField("description", event.target.value)} required minLength={10} /></label>
                <div className="field-row"><label>Category<input value={fields.category} onChange={(event) => updateField("category", event.target.value)} placeholder="Electronics" required /></label><label>Product type<input value={fields.subcategory} onChange={(event) => updateField("subcategory", event.target.value)} placeholder="Audio" /></label></div>
                <label>Brand<input value={fields.brand} onChange={(event) => updateField("brand", event.target.value)} required /></label>
                <div className="field-row"><label>Price (₹)<input value={fields.price} onChange={(event) => updateField("price", Number(event.target.value))} type="number" min="0" step="0.01" required /></label><label>Original price (₹)<input value={fields.compareAtPrice ?? ""} onChange={(event) => updateField("compareAtPrice", event.target.value === "" ? undefined : Number(event.target.value))} type="number" min="0" step="0.01" /></label></div>
                <label>Wholesale price (₹)<input value={fields.wholesalePrice ?? ""} onChange={(event) => updateField("wholesalePrice", event.target.value === "" ? undefined : Number(event.target.value))} type="number" min="0" step="0.01" placeholder="Optional wholesale cost" /></label>
                <label>Product rating (0–5)<input value={fields.rating} onChange={(event) => updateField("rating", Number(event.target.value))} type="number" min="0" max="5" step="0.1" required /></label>
                <div className="field-row"><label>Pack quantity<input value={fields.quantity} onChange={(event) => updateField("quantity", event.target.value)} placeholder="1 unit / 500 g / Pack of 6" required /></label><label>Available stock<input value={fields.stock} onChange={(event) => updateField("stock", Number(event.target.value))} type="number" min="0" required /></label></div>
                <button type="submit" disabled={saving}>{editingId ? <Edit3 size={17} /> : <Plus size={17} />}{saving ? "Saving…" : editingId ? "Save changes" : "Add product"}</button>
                {message && <p className="notice">{message}</p>}
              </form>
            </section>
            <section className="admin-products">
              <div className="admin-list-heading"><div><p className="kicker">CATALOG</p><h2>Active products</h2></div><span>{products.length} of {total} shown</span></div>
              <form className="admin-search" onSubmit={(event) => { event.preventDefault(); void loadProducts(search); }}>
                <Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find any product to edit…" aria-label="Find a product" /><button type="submit">Search</button>
              </form>
              {products.map((product) => (
                <article key={product._id} className={editingId === product._id ? "is-editing" : ""}>
                  {product.images[0] ? <ProductImage src={product.images[0]} alt={product.name} sizes="72px" /> : <div className="product-admin-placeholder"><ImageIcon size={20} /></div>}
                  <div className="admin-product-copy"><strong>{product.name}</strong><p>{product.category} · {product.brand}</p><p>₹{product.price.toLocaleString("en-IN")} · ★ {(product.rating ?? 0).toFixed(1)} · {product.quantity} · {product.stock} in stock{product.wholesalePrice !== undefined ? ` · Wholesale ₹${product.wholesalePrice.toLocaleString("en-IN")}` : ""}</p></div>
                  <div className="admin-product-actions"><button className="edit-button" onClick={() => startEditing(product)}><Edit3 size={15} /> Edit</button><button className="danger" onClick={() => void removeProduct(product._id)}><Trash2 size={15} /> Remove</button></div>
                </article>
              ))}
              {!products.length && <p>No active products yet.</p>}
            </section>
          </div>
        )}
      </main>
    </>
  );
}
