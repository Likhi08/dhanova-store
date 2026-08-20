import Link from "next/link";
import { useRouter } from "next/router";
import { Grid2X2, Heart, House, RefreshCcw, Repeat2 } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/categories", label: "Categories", icon: Grid2X2 },
  { href: "/discover/top-picks", label: "Top picks", icon: Heart },
  { href: "/discover/buy-again", label: "Buy again", icon: Repeat2 },
  { href: "/discover/daily", label: "Daily", icon: RefreshCcw },
];

export default function MobileDock() {
  const router = useRouter();
  if (router.pathname === "/login" || router.pathname === "/admin") return null;
  return <nav className="mobile-dock" aria-label="Quick navigation">{items.map(({ href, label, icon: Icon }) => {
    const active = href === "/" ? router.pathname === "/" || router.pathname === "/store" : router.asPath.startsWith(href);
    return <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><Icon size={21} /><span>{label}</span></Link>;
  })}</nav>;
}
