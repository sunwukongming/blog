import { lang as rootLang } from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale, type Locale } from "./i18n";

/** 服务端组件里取当前语言（来自 app/[lang]）；不认识的语言直接 404 */
export async function getLang(): Promise<Locale> {
  const lang = await rootLang();
  if (!hasLocale(lang)) notFound();
  return lang;
}
