import { getCategory } from "@/lib/categories";
import { ogImage, OG_SIZE } from "@/lib/og";
import { getAllPosts, getPost } from "@/lib/posts";

export const alt = "文章分享图";
export const size = OG_SIZE;
export const contentType = "image/png";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug);
  if (!post) return ogImage({ title: "GM Lab" });
  const tag = getCategory(post.category)?.name;
  const subtitle = post.summary
    ? `约 ${post.readingMinutes} 分钟 · ${post.summary}`
    : `约 ${post.readingMinutes} 分钟`;
  return ogImage({ title: post.title, subtitle, tag });
}
