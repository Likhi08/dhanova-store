import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { CreditCard, MapPin, Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import ProductImage from "@/components/ProductImage";

type CartItem = {
  _id: string;
  quantity: number;
  product: null | { _id: string; name: string; price: number; stock: number; quantity: string; images: string[] };
};
type Address = { _id: string; label: string; fullName: string; line1: string; city: string; state: string; pincode: string; isDefault: boolean };

type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: "payment.failed", callback: (response: { error?: { description?: string } }) => void) => void };
type OnlinePaymentMethod = "upi" | "rupay" | "razorpay" | "cashfree";

const paymentMethodNames: Record<OnlinePaymentMethod, string> = { upi: "UPI", rupay: "RuPay", razorpay: "Razorpay", cashfree: "Cashfree" };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpayCheckout() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [message, setMessage] = useState("Loading cart…");
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string[]>([]);
  const [paymentEnabled, setPaymentEnabled] = useState<boolean | null>(null);
  const [paying, setPaying] = useState(false);
  const [paidOrderId, setPaidOrderId] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedOnlineMethod, setSelectedOnlineMethod] = useState<OnlinePaymentMethod>("upi");

  async function loadCart() {
    try {
      const response = await apiFetch("/cart");
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error === "Authentication required" ? "Log in to view your cart." : data.error);
        return;
      }
      setItems((data.cart?.items ?? []).filter((item: CartItem) => item.product));
      setMessage("");
    } catch {
      setMessage("Backend unavailable. Start the API server on port 4000.");
    }
  }

  useEffect(() => {
    apiFetch("/auth/me").then((response) => response.json()).then((data) => {
      if (data.user?.role === "admin") void router.replace("/admin");
    }).catch(() => undefined);
    void loadCart();
    apiFetch("/payments/config").then(async (response) => response.ok ? response.json() : { enabled: false }).then((data) => setPaymentEnabled(Boolean(data.enabled))).catch(() => setPaymentEnabled(false));
    apiFetch("/account/addresses").then(async (response) => response.ok ? response.json() : { addresses: [] }).then((data) => {
      const nextAddresses = data.addresses ?? [];
      setAddresses(nextAddresses);
      setSelectedAddressId(nextAddresses.find((address: Address) => address.isDefault)?._id ?? nextAddresses[0]?._id ?? "");
    }).catch(() => setAddresses([]));
  }, [router]);

  const total = useMemo(() => items.reduce((sum, item) => sum + (item.product?.price ?? 0) * item.quantity, 0), [items]);
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  async function update(productId: string, quantity?: number) {
    if (updating.includes(productId)) return;
    setError("");
    setUpdating((current) => [...current, productId]);
    try {
      const response = await apiFetch("/cart", {
        method: quantity === undefined ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quantity === undefined ? { productId } : { productId, quantity }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error ?? "Unable to update quantity");
      setItems((data.cart?.items ?? []).filter((item: CartItem) => item.product));
    } catch {
      setError("Unable to update your cart right now.");
    } finally {
      setUpdating((current) => current.filter((id) => id !== productId));
    }
  }

  async function startPayment() {
    if (!paymentEnabled || paying) return;
    setPaying(true);
    setError("");
    try {
      const checkoutLoaded = await loadRazorpayCheckout();
      if (!checkoutLoaded || !window.Razorpay) throw new Error("Payment window could not be loaded");
      if (!selectedAddressId) throw new Error("Add and select a delivery address before payment");
      const orderResponse = await apiFetch("/payments/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addressId: selectedAddressId }) });
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.error ?? "Unable to start payment");

      const instance = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Dhanova",
        description: `${itemCount} cart item${itemCount === 1 ? "" : "s"}`,
        order_id: order.gatewayOrderId,
        prefill: { name: order.customer.name, email: order.customer.email },
        theme: { color: "#8c2bd5" },
        modal: { ondismiss: () => setPaying(false) },
        handler: async (payment: RazorpaySuccess) => {
          const verifyResponse = await apiFetch("/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ localOrderId: order.localOrderId, ...payment }),
          });
          const verification = await verifyResponse.json();
          if (!verifyResponse.ok) {
            setError(verification.error ?? "Payment verification failed. Please contact support.");
            setPaying(false);
            return;
          }
          setItems([]);
          setPaidOrderId(verification.orderId);
          setPaying(false);
        },
      });
      instance.on("payment.failed", (response) => {
        setError(response.error?.description ?? "Payment failed. No order was confirmed.");
        setPaying(false);
      });
      instance.open();
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Unable to start payment");
      setPaying(false);
    }
  }

  async function placeCashOnDeliveryOrder() {
    if (!selectedAddressId) {
      void router.push({ pathname: "/account", query: { section: "addresses", returnTo: "/cart" } });
      return;
    }
    if (paying) return;
    setPaying(true);
    setError("");
    try {
      const response = await apiFetch("/orders/cash-on-delivery", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addressId: selectedAddressId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to place order");
      setItems([]);
      setPaidOrderId(data.orderId);
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : "Unable to place order");
    } finally { setPaying(false); }
  }

  return (
    <>
      <Head><title>Cart | Dhanova</title></Head>
      <main className="content-page">
        <p className="eyebrow">YOUR SELECTION</p><h1>Shopping cart</h1>
        {paidOrderId ? <div className="payment-success"><ShieldCheck size={42} /><h2>Order confirmed</h2><p>Your order <strong>#{paidOrderId.slice(-8).toUpperCase()}</strong> has been placed successfully.</p><Link className="button dark-button" href={{ pathname: "/account", query: { section: "orders" } }}>View orders</Link></div> : message ? <div className="empty-state"><p>{message}</p><Link href="/login">Go to login</Link></div> : items.length === 0 ? (
          <div className="empty-state"><h2>Your cart is empty</h2><Link href="/">Browse products</Link></div>
        ) : (
          <div className="cart-layout">
            <section className="cart-list">
              {error && <p className="error cart-error">{error}</p>}
              {items.map((item) => item.product && (
                <article className="cart-item" key={item._id}>
                  {item.product.images[0] ? <ProductImage className="cart-product-image" src={item.product.images[0]} alt={item.product.name} sizes="82px" /> : <div className="cart-product-placeholder"><ShoppingBag size={24} /></div>}
                  <div className="cart-product-copy"><h3>{item.product.name}</h3><p className="cart-pack-size"><span>Pack / weight</span><strong>{item.product.quantity}</strong></p><p>Unit price: ₹{item.product.price.toLocaleString("en-IN")}</p><strong className="line-calculation">₹{item.product.price.toLocaleString("en-IN")} × {item.quantity} = ₹{(item.product.price * item.quantity).toLocaleString("en-IN")}</strong></div>
                  <div className="quantity-control" aria-label={`Quantity for ${item.product.name}`}><button type="button" aria-label={`Decrease ${item.product.name} quantity`} disabled={item.quantity <= 1 || updating.includes(item.product._id)} onClick={() => void update(item.product!._id, item.quantity - 1)}><Minus size={17} /></button><output aria-live="polite">{item.quantity}</output><button type="button" aria-label={`Increase ${item.product.name} quantity`} disabled={item.quantity >= Math.min(99, item.product.stock) || updating.includes(item.product._id)} onClick={() => void update(item.product!._id, item.quantity + 1)}><Plus size={17} /></button></div>
                  <button className="danger cart-remove" disabled={updating.includes(item.product._id)} onClick={() => void update(item.product!._id)}><Trash2 size={15} /> Remove</button>
                </article>
              ))}
            </section>
            <aside className="summary">
              <h2>Bill Summary</h2>
              <div><span>Items</span><strong>{itemCount}</strong></div>
              <div className="summary-total"><span>To Pay</span><strong>₹{total.toLocaleString("en-IN")}</strong></div>
              <label className="checkout-address">Delivery address{addresses.length ? <select value={selectedAddressId} onChange={(event) => setSelectedAddressId(event.target.value)}>{addresses.map((address) => <option key={address._id} value={address._id}>{address.label} — {address.line1}, {address.city} {address.pincode}</option>)}</select> : <Link href={{ pathname: "/account", query: { section: "addresses" } }}>Add a delivery address</Link>}</label>
              <section className={`payment-methods ${paymentEnabled ? "configured" : "setup-pending"}`} aria-label="Accepted online payment methods">
                <div className="payment-methods-heading"><strong>Online payment options</strong>{!paymentEnabled && <span>Setup pending</span>}</div>
                <div className="payment-method-grid">
                  <button type="button" className={`payment-option ${selectedOnlineMethod === "upi" ? "selected" : ""}`} aria-pressed={selectedOnlineMethod === "upi"} onClick={() => setSelectedOnlineMethod("upi")}><b>UPI</b><small>PhonePe, Google Pay & more</small></button>
                  <button type="button" className={`payment-option ${selectedOnlineMethod === "rupay" ? "selected" : ""}`} aria-pressed={selectedOnlineMethod === "rupay"} onClick={() => setSelectedOnlineMethod("rupay")}><b>RuPay</b><small>Debit and credit cards</small></button>
                  <button type="button" className={`payment-option ${selectedOnlineMethod === "razorpay" ? "selected" : ""}`} aria-pressed={selectedOnlineMethod === "razorpay"} onClick={() => setSelectedOnlineMethod("razorpay")}><b>Razorpay</b><small>Secure payment gateway</small></button>
                  <button type="button" className={`payment-option ${selectedOnlineMethod === "cashfree" ? "selected" : ""}`} aria-pressed={selectedOnlineMethod === "cashfree"} onClick={() => setSelectedOnlineMethod("cashfree")}><b>Cashfree</b><small>Online payment gateway</small></button>
                </div>
                <p className="selected-payment-method">Selected: <strong>{paymentMethodNames[selectedOnlineMethod]}</strong>{selectedOnlineMethod === "cashfree" ? " — gateway integration pending" : !paymentEnabled ? " — credentials pending" : ""}</p>
              </section>
              <p className="payment-security"><ShieldCheck size={16} />Secure checkout. Prices and stock are verified on the server.</p>
              <button className="payment-button" disabled={Boolean(selectedAddressId) && (!paymentEnabled || selectedOnlineMethod === "cashfree" || paying)} onClick={() => selectedAddressId ? void startPayment() : void router.push({ pathname: "/account", query: { section: "addresses", returnTo: "/cart" } })}>{selectedAddressId ? <CreditCard size={18} /> : <MapPin size={18} />}{!selectedAddressId ? "Add delivery address to continue" : paying ? "Processing…" : paymentEnabled === null ? "Checking payment…" : selectedOnlineMethod === "cashfree" ? "Cashfree setup required" : paymentEnabled ? `Pay ₹${total.toLocaleString("en-IN")} with ${paymentMethodNames[selectedOnlineMethod]}` : "Online payment setup required"}</button>
              {!selectedAddressId ? <small className="payment-setup-note">Add your delivery address first. You will return here to complete the order.</small> : paymentEnabled === false && <small className="payment-setup-note">Online options become active after the team configures payment gateway credentials. Cash on delivery is available below.</small>}
              <button className="cod-button" disabled={paying} onClick={() => void placeCashOnDeliveryOrder()}>{selectedAddressId ? <ShoppingBag size={18} /> : <MapPin size={18} />}{selectedAddressId ? "Place cash-on-delivery order" : "Add address for cash on delivery"}</button>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
