import type { AppProps } from "next/app";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import MobileDock from "@/components/MobileDock";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    document.body.classList.toggle("inner-page-watermark", router.pathname !== "/");
    return () => document.body.classList.remove("inner-page-watermark");
  }, [router.pathname]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const selector = [
      ".promo-card", ".marketplace-actions > a", ".hero-content > *", ".category-card", ".editorial-copy > *", ".editorial-showcase",
      ".product-shelf", ".product-card", ".category-tile", ".discover-product-card", ".discover-hero", ".offer-banner",
      ".daily-benefits > div", ".account-content", ".summary", ".cart-item",
      ".store-welcome-copy > *", ".store-brand-stage", ".store-story > *", ".store-promise-grid > article", ".store-mission > *", ".store-visit",
    ].join(",");
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold: .08, rootMargin: "0px 0px -35px" });
    const register = () => document.querySelectorAll<HTMLElement>(selector).forEach((element, index) => {
      if (element.dataset.motionReady) return;
      element.dataset.motionReady = "true";
      element.classList.add("motion-reveal");
      element.style.setProperty("--motion-delay", `${Math.min(index % 8, 7) * 55}ms`);
      observer.observe(element);
    });
    register();
    const mutations = new MutationObserver(register);
    mutations.observe(document.getElementById("__next") ?? document.body, { childList: true, subtree: true });
    return () => { mutations.disconnect(); observer.disconnect(); };
  }, [router.asPath]);

  function goBack() {
    if (window.history.length > 1) router.back();
    else void router.push("/");
  }

  return (
    <>
      <Component {...pageProps} />
      <MobileDock />
      {router.pathname !== "/" && <button type="button" className="global-back-button" onClick={goBack} aria-label="Go back to the previous page"><ArrowLeft size={18} /> Back</button>}
    </>
  );
}
