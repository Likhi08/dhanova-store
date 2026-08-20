import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { BadgeCheck, Headphones, LogOut, Mail, MapPin, Navigation, Package, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { apiFetch } from "@/lib/api";

type User = { name: string; email: string; role: "customer" | "admin" };
type Order = { _id: string; total: number; status: string; createdAt: string; items: Array<{ name: string; quantity: number }> };
type Address = { _id: string; label: string; fullName: string; phone: string; line1: string; line2: string; city: string; state: string; pincode: string; mapUrl: string; isDefault: boolean };
type Section = "orders" | "support" | "addresses" | "profile";
const emptyAddress = { label: "Home", fullName: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "", mapUrl: "", isDefault: false };

const sections = [
  { id: "orders" as const, label: "Orders", icon: Package },
  { id: "support" as const, label: "Customer Support", icon: Headphones },
  { id: "addresses" as const, label: "Saved Addresses", icon: MapPin },
  { id: "profile" as const, label: "Profile", icon: UserRound },
];

export default function AccountPage() {
  const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [section, setSection] = useState<Section>("profile");
  const [loading, setLoading] = useState(true);
  const [accountError, setAccountError] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [addressMessage, setAddressMessage] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;

    async function loadAccount() {
      setLoading(true);
      setAccountError("");

      try {
        const accountResponse = await apiFetch("/auth/me");
        if (!accountResponse.ok) {
          setUser(null);
          setAccountError("Your session has expired. Redirecting to login...");
          setLoading(false);
          await router.replace("/login");
          return;
        }

        const accountData = await accountResponse.json();
        if (!accountData?.user) {
          setUser(null);
          setAccountError("Your session has expired. Redirecting to login...");
          setLoading(false);
          await router.replace("/login");
          return;
        }

        if (accountData.user.role === "admin") {
          setAccountError("Redirecting to the admin area...");
          setLoading(false);
          await router.replace("/admin");
          return;
        }

        setUser(accountData.user);

        const [orderData, addressData] = await Promise.all([
          apiFetch("/orders")
            .then(async (response) => response.ok ? response.json() : { orders: [] })
            .catch(() => ({ orders: [] })),
          apiFetch("/account/addresses")
            .then(async (response) => response.ok ? response.json() : { addresses: [] })
            .catch(() => ({ addresses: [] })),
        ]);

        setOrders(orderData.orders ?? []);
        setAddresses(addressData.addresses ?? []);
      } catch (error) {
        console.error("Unable to load account", error);
        setUser(null);
        setAccountError("Unable to load your account. Redirecting to login...");
        setLoading(false);
        await router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    void loadAccount();
  }, [router.isReady]);

  useEffect(() => {
    const requested = router.query.section;
    if (requested === "orders" || requested === "support" || requested === "addresses" || requested === "profile") setSection(requested);
    else if (router.isReady) setSection("profile");
  }, [router.query.section]);

  function openSection(nextSection: Section) {
    const returnTo = nextSection === "addresses" && router.query.returnTo === "/cart" ? { returnTo: "/cart" } : {};
    void router.push({ pathname: "/account", query: { section: nextSection, ...returnTo } });
  }

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
      await router.push("/login");
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAddress(true);
    setAddressMessage("");
    try {
      const response = await apiFetch("/account/addresses", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(addressForm),
      });
      const data = await response.json();
      if (!response.ok) return setAddressMessage(data.error ?? "Unable to save address");
      setAddresses(data.addresses ?? []);
      setAddressForm(emptyAddress);
      setAddressMessage("Address saved successfully");
      if (router.query.returnTo === "/cart") await router.push("/cart");
    } catch { setAddressMessage("Unable to save address right now"); }
    finally { setSavingAddress(false); }
  }

  async function removeAddress(id: string) {
    const response = await apiFetch(`/account/addresses/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) return setAddressMessage(data.error ?? "Unable to remove address");
    setAddresses(data.addresses ?? []);
    setAddressMessage("Address removed");
  }

  async function makeDefault(id: string) {
    const response = await apiFetch(`/account/addresses/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDefault: true }),
    });
    const data = await response.json();
    if (!response.ok) return setAddressMessage(data.error ?? "Unable to update address");
    setAddresses(data.addresses ?? []);
    setAddressMessage("Default address updated");
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return setAddressMessage("Location access is not supported by this browser.");
    setLocating(true);
    setAddressMessage("Requesting your location permission…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = coords.latitude.toFixed(6);
        const longitude = coords.longitude.toFixed(6);
        setAddressForm((current) => ({ ...current, mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}` }));
        setAddressMessage("Exact Google Maps location added. Please verify the pin before saving.");
        setLocating(false);
      },
      () => {
        setAddressMessage("Location permission was denied or your position was unavailable. Paste a Google Maps link instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <>
      <Head><title>{section === "profile" ? "My profile" : section === "orders" ? "My orders" : section === "addresses" ? "Saved addresses" : "Customer support"} | Dhanova</title></Head>
      {router.isReady && router.query.section !== "profile" && <SiteHeader />}
      <main className="account-shell">
        {loading ? <div className="product-detail-loading">Loading account…</div> : accountError || !user ? <div className="product-detail-loading" role="alert">{accountError || "Unable to load your account."}</div> : (
          <div className="account-layout">
            <aside className="account-sidebar">
              <div className="account-user"><div className="account-avatar"><UserRound size={32} /></div><div><strong>{user.name}</strong><span>{user.email}</span></div></div>
              <nav aria-label="Account sections">{sections.map(({ id, label, icon: Icon }) => <button key={id} className={section === id ? "active" : ""} aria-current={section === id ? "page" : undefined} onClick={() => openSection(id)}><Icon size={19} />{label}</button>)}</nav>
              <button className="account-logout" onClick={() => void logout()}><LogOut size={17} />Log Out</button>
              <Link className="account-wordmark" href="/" aria-label="Dhanova home"><img src="/brand/dhanova-logo.png" alt="Dhanova — Innovating Tomorrow" /></Link>
            </aside>

            <section className="account-content">
              {section === "orders" && <><div className="account-section-heading"><p className="kicker">PURCHASES</p><h1>Your orders</h1>{orders.length > 0 && <Link className="button dark-button" href="/discover/buy-again">Buy these items again</Link>}</div>{orders.length ? <div className="account-orders">{orders.map((order) => <article key={order._id}><div><span className={`order-status ${order.status}`}>{order.status}</span><h3>Order #{order._id.slice(-8).toUpperCase()}</h3><p>{new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} items</p></div><strong>₹{order.total.toLocaleString("en-IN")}</strong></article>)}</div> : <div className="account-empty"><Package size={38} /><h2>No orders yet</h2><p>Your completed purchases will appear here.</p><Link className="button dark-button" href="/">Start shopping</Link></div>}</>}
              {section === "support" && <><div className="account-section-heading"><p className="kicker">WE ARE HERE TO HELP</p><h1>Customer support</h1></div><div className="account-info-card"><Headphones size={34} /><h2>How can we help?</h2><p>For order, payment, delivery, or product support, email our care team. Include your order number when available.</p><a className="button dark-button" href="mailto:support@dhanova.store">Email support</a></div></>}
              {section === "addresses" && <><div className="account-section-heading"><p className="kicker">DELIVERY</p><h1>Saved addresses</h1></div>
                <div className="address-layout">
                  <div className="address-list"><div className="address-count"><strong>{addresses.length}</strong><span>of 3 delivery addresses saved</span></div>{addresses.map((address) => <article key={address._id} className={address.isDefault ? "default" : ""}><div><strong>{address.label}{address.isDefault && <span>Default</span>}</strong><p>{address.fullName} · +91 {address.phone}</p><p>{address.line1}{address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state} – {address.pincode}</p>{address.mapUrl && <a className="address-map-link" href={address.mapUrl} target="_blank" rel="noreferrer"><MapPin size={14} />Open exact location in Google Maps</a>}</div><div>{!address.isDefault && <button type="button" onClick={() => void makeDefault(address._id)}>Make default</button>}<button type="button" className="danger" onClick={() => void removeAddress(address._id)}>Remove</button></div></article>)}{!addresses.length && <p className="address-empty">No saved addresses yet. Add your delivery address below.</p>}</div>
                  {addresses.length < 3 ? <form className="address-form" onSubmit={saveAddress}><h2>Add delivery address</h2><div className="field-row"><label>Label<input value={addressForm.label} onChange={(event) => setAddressForm({ ...addressForm, label: event.target.value })} required /></label><label>Full name<input value={addressForm.fullName} onChange={(event) => setAddressForm({ ...addressForm, fullName: event.target.value })} required /></label></div><div className="field-row"><label>Mobile number<input inputMode="numeric" pattern="[6-9][0-9]{9}" value={addressForm.phone} onChange={(event) => setAddressForm({ ...addressForm, phone: event.target.value })} required /></label><label>PIN code<input inputMode="numeric" pattern="[0-9]{6}" value={addressForm.pincode} onChange={(event) => setAddressForm({ ...addressForm, pincode: event.target.value })} required /></label></div><label>Address line 1<input value={addressForm.line1} onChange={(event) => setAddressForm({ ...addressForm, line1: event.target.value })} required /></label><label>Address line 2<input value={addressForm.line2} onChange={(event) => setAddressForm({ ...addressForm, line2: event.target.value })} /></label><div className="field-row"><label>City<input value={addressForm.city} onChange={(event) => setAddressForm({ ...addressForm, city: event.target.value })} required /></label><label>State<input value={addressForm.state} onChange={(event) => setAddressForm({ ...addressForm, state: event.target.value })} required /></label></div><label>Exact Google Maps location (optional)<input type="url" inputMode="url" placeholder="Paste a Google Maps share link" value={addressForm.mapUrl} onChange={(event) => setAddressForm({ ...addressForm, mapUrl: event.target.value })} /></label><div className="map-location-actions"><button type="button" onClick={useCurrentLocation} disabled={locating}><Navigation size={16} />{locating ? "Finding location…" : "Use my current location"}</button><small>Your browser will ask permission. Verify the map pin before saving.</small></div><label className="checkbox-label"><input type="checkbox" checked={addressForm.isDefault} onChange={(event) => setAddressForm({ ...addressForm, isDefault: event.target.checked })} />Use as default address</label><button type="submit" disabled={savingAddress}>{savingAddress ? "Saving…" : "Save address"}</button>{addressMessage && <p className="notice">{addressMessage}</p>}</form> : <p className="address-limit-notice">You have saved the maximum of 3 addresses. Remove one to add another.</p>}
                </div></>}
              {section === "profile" && <div className="profile-experience"><div className="profile-hero-card"><div className="profile-hero-copy"><p className="kicker">PERSONAL DETAILS</p><h1>Your profile</h1><span>Welcome back, {user.name.split(" ")[0]}. Your Dhanova account keeps shopping personal, secure and effortless.</span></div><div className="profile-hero-emblem"><Sparkles size={23} /><UserRound size={48} /><small>DHANOVA MEMBER</small></div></div><div className="profile-details"><div><span><UserRound size={20} /> Full name</span><strong>{user.name}</strong><small>Your name across orders and deliveries</small></div><div><span><Mail size={20} /> Email address</span><strong>{user.email}</strong><small>Used for login and order updates</small></div><div><span><BadgeCheck size={20} /> Account type</span><strong>{user.role === "admin" ? "Administrator" : "Dhanova Customer"}</strong><small>Verified shopping account</small></div></div><div className="profile-trust-strip"><ShieldCheck size={22} /><div><strong>Your account is protected</strong><span>Secure login, private details and verified checkout.</span></div><BadgeCheck size={22} /></div></div>}
            </section>
          </div>
        )}
        </main>
      <SiteFooter />
      </>
  );
}
