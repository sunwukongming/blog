import { notFound } from "next/navigation";
import { hasLocale } from "@/lib/i18n";
import { ogImage, OG_SIZE } from "@/lib/og";
import { getProfile, getSite } from "@/lib/site";

export const alt = "GM Lab";
export const size = OG_SIZE;
export const contentType = "image/png";

// 图片路由属于 Route Handler，拿不到 next/root-params，语言从 params 里取
export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const profile = getProfile(lang);
  return ogImage({ title: `${profile.name} · ${getSite(lang).name}`, subtitle: profile.role, lang });
}
