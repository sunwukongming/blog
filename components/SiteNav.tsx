import Link from "next/link";
import { SITE } from "@/lib/site";

const LINKS = [
  { href: "/blog", label: "文章" },
  { href: "/categories", label: "分类" },
  { href: "/archive", label: "归档" },
];

export default function SiteNav() {
  return (
    <header className="site-nav">
      <Link href="/" className="site-nav__name">
        {SITE.name}
      </Link>
      <nav aria-label="主导航">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
