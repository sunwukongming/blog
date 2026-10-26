import type { Metadata } from "next";
import Link from "next/link";
import GameBest from "@/components/games/GameBest";
import PostList from "@/components/PostList";
import { getGames } from "@/lib/games";
import { HTML_LANG, localePath } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { UI } from "@/lib/messages";
import { absUrl, pageMeta } from "@/lib/meta";
import { getAllPosts } from "@/lib/posts";
import { getProfile, getSite, SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return pageMeta({ lang, path: "/", description: getSite(lang).description });
}

export default async function Home() {
  const lang = await getLang();
  const t = UI[lang];
  const site = getSite(lang);
  const profile = getProfile(lang);
  const posts = await getAllPosts(lang);
  const playable = getGames(lang)
    .filter((g) => g.playable)
    .slice(0, 6);
  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    description: site.description,
    url: SITE_URL ? absUrl(lang, "/") : undefined,
    author: { "@type": "Person", name: site.author },
    publisher: { "@type": "Organization", name: site.name },
    inLanguage: HTML_LANG[lang],
    sameAs: profile.links.map((l) => l.href).filter((h) => h.startsWith("http")),
    hasPart: SITE_URL
      ? [
          { "@type": "CollectionPage", name: t.blog.title, url: absUrl(lang, "/blog") },
          { "@type": "CollectionPage", name: t.categories.title, url: absUrl(lang, "/categories") },
          { "@type": "CollectionPage", name: t.games.title, url: absUrl(lang, "/games") },
          { "@type": "CollectionPage", name: t.archive.title, url: absUrl(lang, "/archive") },
        ]
      : undefined,
    potentialAction: SITE_URL
      ? {
          "@type": "SearchAction",
          target: `${absUrl(lang, "/blog")}?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        }
      : undefined,
  };
  return (
    <main data-world="room" className="page page--split">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }} />
      <section className="hero" aria-labelledby="intro">
        <p className="eyebrow">{t.home.hello}</p>
        <h1 id="intro" className="display">
          {profile.name}
        </h1>
        <p className="role">{profile.role}</p>
        {profile.bio.map((p) => (
          <p key={p} className="lede">
            {p}
          </p>
        ))}
        <ul className="tags" aria-label={t.home.skills}>
          {profile.skills.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="profile-links">
          {profile.links.map((l) => (
            <a key={l.href} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              {l.label} ↗
            </a>
          ))}
        </p>
        <p className="hint">{t.home.hint}</p>
      </section>
      {/* 窄屏时书房画在这块空白里 */}
      <div className="room-stage" aria-hidden="true" />
      <section className="panel side" data-ui aria-labelledby="latest">
        <h2 id="latest">{t.home.latest}</h2>
        <PostList posts={posts.slice(0, 3)} lang={lang} />
        <div className="home-play" aria-labelledby="play-quick">
          <div className="home-play__head">
            <h2 id="play-quick">{t.home.play}</h2>
            <Link href={localePath(lang, "/games")} className="home-play__more">
              {t.home.playAll}
            </Link>
          </div>
          <p className="home-play__note">
            {t.home.playNote[0]}
            <Link href={localePath(lang, "/games")}>{t.home.playNote[1]}</Link>
            {t.home.playNote[2]}
          </p>
          <ul className="chips home-play__chips">
            {playable.map((g) => (
              <li key={g.slug}>
                <Link href={localePath(lang, g.href ?? `/games/${g.slug}`)}>
                  <span>{g.title}</span>
                  <GameBest slug={g.slug} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
