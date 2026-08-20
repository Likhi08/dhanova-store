import Head from "next/head";
import Link from "next/link";
import { ArrowRight, Clock3, HeartHandshake, Leaf, MapPin, ShieldCheck, Sparkles, Store, Truck } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

const promises = [
  { icon: Clock3, title: "Minutes, not hours", copy: "Everyday essentials prepared quickly for convenient neighbourhood delivery." },
  { icon: ShieldCheck, title: "Quality comes first", copy: "Carefully selected products, transparent pricing and dependable service." },
  { icon: HeartHandshake, title: "Made for your day", copy: "From breakfast to last-minute needs, Dhanova is designed around real routines." },
];

export default function StorePage() {
  return <>
    <Head><title>About Dhanova | Your Everyday Store</title><meta name="description" content="Meet Dhanova, your neighbourhood store for quick, dependable everyday delivery." /></Head>
    <SiteHeader />
    <main className="store-home">
      <section className="store-welcome">
        <div className="store-welcome-copy">
          <span className="store-eyebrow"><Sparkles size={15} /> Welcome to Dhanova</span>
          <h1>Your neighbourhood store, <em>made extraordinary.</em></h1>
          <p>Fresh essentials, trusted quality and quick neighbourhood delivery—all in one place.</p>
          <div className="store-welcome-actions"><Link className="button store-primary" href="/categories">Explore our store <ArrowRight size={18} /></Link><a href="#our-story">Our story</a></div>
        </div>
        <div className="store-brand-stage" aria-label="Dhanova products and brand">
          <span className="store-orbit orbit-one" /><span className="store-orbit orbit-two" />
          <div className="store-logo-glow"><img src="/brand/dhanova-logo.png" alt="Dhanova — Innovating Tomorrow" /></div>
          <Link className="store-product-float product-fresh" href={{ pathname: "/products", query: { category: "Fresh Produce" } }} aria-label="Shop fresh produce"><img src="/product-images/fresh-produce/0.webp" alt="Fresh produce" /><span>Fresh</span></Link>
          <Link className="store-product-float product-dairy" href={{ pathname: "/products", query: { category: "Dairy & Breakfast" } }} aria-label="Shop dairy"><img src="/product-images/dairy-breakfast/0.webp" alt="Dairy products" /><span>Dairy</span></Link>
          <Link className="store-product-float product-snacks" href={{ pathname: "/products", query: { category: "Snacks" } }} aria-label="Shop snacks"><img src="/product-images/snacks/0.webp" alt="Snacks" /><span>Snacks</span></Link>
          <Link className="store-product-float product-drinks" href={{ pathname: "/products", query: { category: "Beverages" } }} aria-label="Shop beverages"><img src="/product-images/beverages/0.webp" alt="Beverages" /><span>Drinks</span></Link>
          <div className="store-floating-note note-one"><Truck size={18} /><strong>Fast delivery</strong></div>
          <div className="store-floating-note note-two"><Leaf size={18} /><strong>Fresh choices</strong></div>
        </div>
      </section>

      <section className="store-story" id="our-story">
        <div className="store-story-heading"><span>01 / OUR STORY</span><h2>Built to make everyday shopping feel effortless.</h2></div>
        <div className="store-story-copy"><p>We created Dhanova for the moments when life moves fast but quality still matters. It is a modern local store experience that keeps essentials close, service human and every visit simple.</p><p>Our name stands for progress with purpose. We combine reliable neighbourhood care with a smarter digital experience—always innovating tomorrow.</p></div>
      </section>

      <section className="store-promises">
        <div className="store-section-title"><span>WHY DHANOVA</span><h2>Our promise to every home</h2></div>
        <div className="store-promise-grid">{promises.map(({ icon: Icon, title, copy }, index) => <article key={title}><b>0{index + 1}</b><Icon size={29} /><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="store-mission">
        <div><span>OUR MISSION</span><h2>More time for life.<br />Less time waiting.</h2></div>
        <div className="store-mission-mark"><Store size={46} /><strong>One trusted store</strong><small>For every everyday need</small></div>
      </section>

      <section className="store-visit">
        <MapPin size={28} /><div><span>READY WHEN YOU ARE</span><h2>Come in. Feel at home.</h2><p>Discover a store built around speed, care and the needs of your neighbourhood.</p></div><Link href="/categories">Start exploring <ArrowRight size={19} /></Link>
      </section>
    </main>
    <SiteFooter />
  </>;
}
