import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#0a0c10",
    theme_color: "#0a0c10",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    // batch40 shortcuts：与主导航对齐——文章 / 游戏 / 归档（3 项；勿加未上线路由）
    shortcuts: [
      {
        name: "文章",
        short_name: "文章",
        url: "/blog",
        description: "卡片环文章列表",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      {
        name: "游戏",
        short_name: "游戏",
        url: "/games",
        description: "桌上小游戏",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      {
        name: "归档",
        short_name: "归档",
        url: "/archive",
        description: "按年归档",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
    ],
  };
}
