import Link from "next/link";
import { useRouter } from "next/router";
import { LogOut, PackageSearch, ShieldCheck, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function AdminHeader({ userName }: { userName?: string }) {
  const router = useRouter();
  const [name, setName] = useState(userName ?? "Administrator");

  useEffect(() => {
    if (userName) return;
    apiFetch("/auth/me").then((response) => response.json()).then((data) => {
      if (data.user?.role === "admin") setName(data.user.name);
    }).catch(() => undefined);
  }, [userName]);

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    await router.push("/login");
  }

  return (
    <header className="admin-header">
      <Link href="/admin" className="admin-header-brand" aria-label="Dhanova admin dashboard"><img src="/brand/dhanova-logo.png" alt="" /><span><strong>Dhanova</strong><small>Admin console</small></span></Link>
      <nav aria-label="Administrator navigation">
        <Link href="/admin" className={router.pathname === "/admin" ? "active" : ""}><PackageSearch size={19} />Products</Link>
        <Link href="/" target="_blank"><Store size={19} />Store preview</Link>
      </nav>
      <div className="admin-header-account"><span><ShieldCheck size={18} /><small>Signed in as</small><strong>{name}</strong></span><button type="button" onClick={() => void logout()}><LogOut size={18} />Log out</button></div>
    </header>
  );
}
