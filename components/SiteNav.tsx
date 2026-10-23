import { Suspense } from "react";
import Link from "next/link";
import NavLinks from "@/components/NavLinks";
import { NAV_LINKS } from "@/lib/nav";
import { SITE } from "@/lib/site";

export default function SiteNav() {
  const plain = NAV_LINKS.map((l) => (
    <Link key={l.href} href={l.href}>
      {l.label}
    </Link>
  ));
  return (
    <header className="site-nav">
      <Link href="/" className="site-nav__name">
        {SITE.name}
      </Link>
      <nav aria-label="主导航">
        <Suspense fallback={plain}>
          <NavLinks />
        </Suspense>
      </nav>
    </header>
  );
}
