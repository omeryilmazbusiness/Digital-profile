import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sheraton Makkah Jabal Al Kaaba",
    short_name: "Sheraton Makkah",
    description: "Digital sales experience for travel agencies and tour operators.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
  };
}
