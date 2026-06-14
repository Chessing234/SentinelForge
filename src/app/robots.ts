import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/dashboard", "/api"] },
    ],
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
  };
}
