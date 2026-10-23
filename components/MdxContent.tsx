import { compileMDX } from "next-mdx-remote/rsc";
import rehypePrettyCode from "rehype-pretty-code";

// 编译结果只取决于源文本，缓存后可以在构建时预渲染
export default async function MdxContent({ source }: { source: string }) {
  "use cache";
  const { content } = await compileMDX({
    source,
    options: { mdxOptions: { rehypePlugins: [[rehypePrettyCode, { theme: "github-dark-dimmed" }]] } },
  });
  return content;
}
