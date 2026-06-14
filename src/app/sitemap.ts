import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/login`, lastModified: new Date() },
    { url: `${base}/register`, lastModified: new Date() },
  ];
}
