import type { Metadata } from "next";
import { Suspense } from "react";
import { JetBrains_Mono, Newsreader, Nunito, Orbitron, Syne } from "next/font/google";
import Background from "@/components/Background";
import SiteNav from "@/components/SiteNav";
import WorldTheme from "@/components/WorldTheme";
import { getAllPosts } from "@/lib/posts";
import { SITE, SITE_URL } from "@/lib/site";
import "./globals.css";

// 正文用系统中文字体（见 globals.css 的 --font-body）：网页版思源黑体光 @font-face 声明就有约 100KB 阻塞渲染的 CSS。
// 各个世界有自己的标题字体，只在对应页面用到，所以只预加载首页的 Nunito 和全站都用的等宽字体
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "600"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["700", "900"] });
const syne = Syne({ variable: "--font-syne", subsets: ["latin"], weight: ["600", "800"], preload: false });
const orbitron = Orbitron({ variable: "--font-orbitron", subsets: ["latin"], weight: ["600", "900"], preload: false });
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  preload: false,
});

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
  metadataBase: new URL(SITE_URL ?? "http://localhost:3000"),
  openGraph: { siteName: SITE.name, locale: "zh_CN", type: "website" },
  alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: SITE.name }] } },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const posts = await getAllPosts();
  const fonts = [mono, syne, nunito, orbitron, newsreader].map((f) => f.variable).join(" ");
  return (
    <html lang="zh-CN" className={fonts}>
      <body>
        <Suspense fallback={null}>
          <WorldTheme />
        </Suspense>
        <Background posts={posts} />
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
