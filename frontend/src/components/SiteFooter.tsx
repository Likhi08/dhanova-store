import Link from "next/link";
import { Globe2, Headphones, Mail } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-intro">
        <Link className="footer-brand-lockup" href="/" aria-label="About Dhanova">
          <span className="footer-logo-mark"><img src="/brand/dhanova-logo.png" alt="" /></span>
          <span className="footer-wordmark"><strong>Dhanova</strong><small>Innovating tomorrow</small></span>
        </Link>
        <p>Your neighbourhood store, now at your fingertips.</p>
      </div>
      <div className="footer-links">
        <div><strong>Shop</strong><Link href={{ pathname: "/", query: { category: "Fresh Produce" }, hash: "catalog" }}>Fresh groceries</Link><Link href={{ pathname: "/", query: { category: "Pantry & Staples" }, hash: "catalog" }}>Everyday essentials</Link><Link href="/cart">Your cart</Link></div>
        <div><strong>Help</strong><Link href={{ pathname: "/account", query: { section: "profile" } }}>Your profile</Link><a href="mailto:support@dhanova.store">Contact</a><Link href={{ pathname: "/account", query: { section: "support" } }}>Delivery & returns</Link></div>
      </div>
      <div className="social-links"><Link href={{ pathname: "/account", query: { section: "support" } }} aria-label="Customer support"><Headphones size={18} /></Link><Link href="/" aria-label="About Dhanova"><Globe2 size={18} /></Link><a href="mailto:support@dhanova.store" aria-label="Email support"><Mail size={18} /></a></div>
      <p className="copyright">© 2026 Dhanova. All rights reserved.</p>
    </footer>
  );
}
