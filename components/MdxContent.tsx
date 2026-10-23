import { compileMDX } from "next-mdx-remote/rsc";
import rehypePrettyCode from "rehype-pretty-code";
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
function rehypeHeadingIds() {
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
            properties: { href: `#${id}`, className: ["heading-anchor"], ariaLabel: "本节链接" },
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

// 编译结果只取决于源文本，缓存后可以在构建时预渲染
export default async function MdxContent({ source }: { source: string }) {
  "use cache";
  const { content } = await compileMDX({
    source,
    options: {
      mdxOptions: { rehypePlugins: [[rehypePrettyCode, { theme: "github-dark-dimmed" }], rehypeHeadingIds] },
    },
  });
  return content;
}
