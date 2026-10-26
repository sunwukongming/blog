import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, hasLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

/**
 * 访客语言：先看手动选过的（cookie），再看浏览器的 Accept-Language。
 * 浏览器语言里没有中文 / 日文 / 英文时进英文版；没有这个请求头（多半是爬虫）时进中文版
 */
function detect(req: NextRequest): Locale {
  const saved = req.cookies.get(LOCALE_COOKIE)?.value;
  if (hasLocale(saved)) return saved;
  const header = req.headers.get("accept-language");
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q === undefined ? 1 : Number(q) || 0 };
    })
    .filter((x) => x.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.map((x) => x.lang).find(hasLocale) ?? "en";
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (hasLocale(pathname.split("/")[1])) return;
  const url = req.nextUrl.clone();
  if (pathname === "/") {
    // 根路径按访客语言临时跳转（307），不能被永久缓存
    url.pathname = `/${detect(req)}`;
    return NextResponse.redirect(url, 307);
  }
  // 加语言前缀之前的旧链接都是中文页面，永久跳到中文版
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  // 跳过已带语言前缀的路径、Next 内部资源、带扩展名的文件（sitemap.xml、icon.svg 等）和 apple-icon
  matcher: ["/((?!_next/|(?:zh|en|ja)(?:/|$)|apple-icon|.*\\.[a-zA-Z0-9]+$).*)"],
};
