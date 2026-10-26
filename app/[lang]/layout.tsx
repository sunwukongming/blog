import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { JetBrains_Mono, Newsreader, Nunito, Orbitron, Syne } from "next/font/google";
import Background from "@/components/Background";
import { LangProvider } from "@/components/i18n/LangProvider";
import MascotSlot from "@/components/mascot/MascotSlot";
import SiteNav from "@/components/SiteNav";
import WorldTheme from "@/components/WorldTheme";
import { HTML_LANG, LOCALES, OG_LOCALE } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { getAllPosts } from "@/lib/posts";
import { getSite, SITE_URL } from "@/lib/site";
import "../globals.css";

// 正文用系统字体（见 globals.css 的 --font-body，按语言切换）：网页版思源黑体光 @font-face 声明就有约 100KB 阻塞渲染的 CSS。
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

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const site = getSite(await getLang());
  return {
    title: { default: site.name, template: `%s · ${site.name}` },
    description: site.description,
    // 没配置站点地址时交给 Next 推断：在 Vercel 上会用生产域名，本地用 localhost
    metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
    openGraph: { siteName: site.name, locale: OG_LOCALE[await getLang()], type: "website" },
  };
}

export const viewport: Viewport = { themeColor: "#0a0c10" };

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const lang = await getLang();
  const posts = await getAllPosts(lang);
  const fonts = [mono, syne, nunito, orbitron, newsreader].map((f) => f.variable).join(" ");
  return (
    <html lang={HTML_LANG[lang]} className={fonts}>
      <body>
        <LangProvider lang={lang}>
          <Suspense fallback={null}>
            <WorldTheme />
          </Suspense>
          <Background posts={posts} />
          <SiteNav />
          {children}
          <MascotSlot />
        </LangProvider>
      </body>
    </html>
  );
}
