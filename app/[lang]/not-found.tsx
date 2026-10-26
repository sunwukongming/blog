import Link from "next/link";
import { localePath } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { UI } from "@/lib/messages";

export default async function NotFound() {
  const lang = await getLang();
  const t = UI[lang].notFound;
  return (
    <main data-world="field" className="page" style={{ justifyContent: "center" }}>
      <div className="hero">
        <p className="eyebrow">404</p>
        <h1 className="display">{t.heading}</h1>
        <p className="lede">{t.lede}</p>
        <p>
          <Link href={localePath(lang, "/")} className="back">
            {t.back}
          </Link>
        </p>
      </div>
    </main>
  );
}
