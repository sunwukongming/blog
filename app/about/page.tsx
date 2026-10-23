import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "关于" };

export default function About() {
  return (
    <main data-world="blob" className="page">
      <div className="hero">
        <p className="eyebrow">About</p>
        <h1 className="display" style={{ fontSize: "clamp(44px, 8vw, 88px)" }}>
          Soft things, <i>written slowly.</i>
        </h1>
      </div>
      <section className="panel side prose" data-ui>
        <p>你好，我是{SITE.author}。白天写前端，晚上折腾图形学，偶尔读书、写点随笔。</p>
        <p>这个博客的每个页面都是一个小世界，它们共用同一块 WebGL 画布，换页的时候场景会平滑切换。</p>
        <p>
          站点用 Next.js、React Three Fiber 和 MDX 搭建。<strong>这段文字是占位内容</strong>，在{" "}
          <code>app/about/page.tsx</code> 里改成你自己的介绍。
        </p>
      </section>
    </main>
  );
}
