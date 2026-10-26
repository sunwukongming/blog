import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // 个人介绍已经放到首页；加语言前缀之前的 RSS 地址（带扩展名，proxy 不处理）跳到中文版
  async redirects() {
    return [
      { source: "/about", destination: "/zh", permanent: true },
      { source: "/:lang(zh|en|ja)/about", destination: "/:lang", permanent: true },
      { source: "/feed.xml", destination: "/zh/feed.xml", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
