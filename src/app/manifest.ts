import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SentinelForge",
    short_name: "SentinelForge",
    description: "Cybersecurity training platform for SOC teams.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#059669",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
