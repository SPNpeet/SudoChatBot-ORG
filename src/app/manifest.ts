import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SudoChatBot — ระบบบัญชี + ผู้ช่วย AI",
    short_name: "SudoChatBot",
    description: "ระบบบัญชีและออกเอกสารครบวงจร พร้อมผู้ช่วย AI สำหรับธุรกิจไทย",
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
