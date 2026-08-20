import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: frontendRoot,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [72],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: "https", hostname: "assets.amul.com" },
      { protocol: "https", hostname: "www.bbassets.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "wholesaledryfruits.in" },
      { protocol: "https", hostname: "store.storeimages.cdn-apple.com" },
      { protocol: "https", hostname: "images.samsung.com" },
      { protocol: "https", hostname: "i03.appmifile.com" },
      { protocol: "https", hostname: "www.hp.com" },
      { protocol: "https", hostname: "images.price.tools" },
    ],
  },
  async rewrites() {
    const productionApi = process.env.API_BACKEND_URL?.replace(/\/$/, "");
    if (process.env.NODE_ENV === "production") {
      return productionApi ? [{ source: "/api/:path*", destination: `${productionApi}/:path*` }] : [];
    }
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
