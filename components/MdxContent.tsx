import { compileMDX } from "next-mdx-remote/rsc";
import rehypePrettyCode from "rehype-pretty-code";
import { hasLocale, type Locale } from "@/lib/i18n";
import { UI } from "@/lib/messages";
import { createSlugger } from "@/lib/toc";

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const textOf = (n: HastNode): string => (n.type === "text" ? (n.value ?? "") : (n.children ?? []).map(textOf).join(""));

/** 给 h2/h3 加 id 和一个 # 锚点链接；id 规则和 lib/toc.ts 的 extractHeadings 一致，目录才能跳过来 */
function rehypeHeadingIds({ anchorLabel }: { anchorLabel: string }) {
  return (tree: HastNode) => {
    const slug = createSlugger();
    const visit = (n: HastNode) => {
      if (n.type === "element" && (n.tagName === "h2" || n.tagName === "h3")) {
        const id = slug(textOf(n));
        n.properties = { ...n.properties, id };
        n.children = [
          ...(n.children ?? []),
          {
            type: "element",
            tagName: "a",
            properties: { href: `#${id}`, className: ["heading-anchor"], ariaLabel: anchorLabel },
            children: [{ type: "text", value: "#" }],
          },
        ];
        return;
      }
      n.children?.forEach(visit);
    };
    visit(tree);
  };
}

/** 文章里写的站内链接（/blog/xxx）加上当前语言前缀，读者留在同一种语言里 */
function rehypeLocaleLinks({ lang }: { lang: Locale }) {
  return (tree: HastNode) => {
    const visit = (n: HastNode) => {
      const href = n.tagName === "a" ? n.properties?.href : undefined;
      if (
        typeof href === "string" &&
        href.startsWith("/") &&
        !href.startsWith("//") &&
        !hasLocale(href.split("/")[1])
      ) {
        n.properties = { ...n.properties, href: `/${lang}${href}` };
      }
      n.children?.forEach(visit);
    };
    visit(tree);
  };
}

// 编译结果只取决于源文本和语言，缓存后可以在构建时预渲染
export default async function MdxContent({ source, lang }: { source: string; lang: Locale }) {
  "use cache";
  const { content } = await compileMDX({
    source,
    options: {
      mdxOptions: {
        rehypePlugins: [
          [rehypePrettyCode, { theme: "github-dark-dimmed" }],
          [rehypeHeadingIds, { anchorLabel: UI[lang].article.anchor }],
          [rehypeLocaleLinks, { lang }],
        ],
      },
    },
  });
  return content;
}
