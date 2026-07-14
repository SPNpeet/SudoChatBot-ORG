import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SudoChatBot — AI ปิดการขาย",
    short_name: "SudoChatBot",
    description: "แชทบอท AI ปิดการขายสำหรับร้านค้าบน Facebook / IG / LINE",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#059669",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
