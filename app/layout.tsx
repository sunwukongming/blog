import type { Metadata } from "next";
import { Suspense } from "react";
import { Instrument_Serif, JetBrains_Mono, Newsreader, Noto_Sans_SC, Nunito, Orbitron, Syne } from "next/font/google";
import Background from "@/components/Background";
import SiteNav from "@/components/SiteNav";
import WorldTheme from "@/components/WorldTheme";
import { getAllPosts } from "@/lib/posts";
import { SITE } from "@/lib/site";
import "./globals.css";

// 正文统一用 Noto Sans SC，各个世界有自己的标题字体
const body = Noto_Sans_SC({ variable: "--font-body", weight: ["400", "500", "700"], preload: false });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "600"] });
const syne = Syne({ variable: "--font-syne", subsets: ["latin"], weight: ["600", "800"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["700", "900"] });
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const orbitron = Orbitron({ variable: "--font-orbitron", subsets: ["latin"], weight: ["600", "900"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const posts = await getAllPosts();
  const fonts = [body, mono, syne, nunito, instrument, orbitron, newsreader].map((f) => f.variable).join(" ");
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
