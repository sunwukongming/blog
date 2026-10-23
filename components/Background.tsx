"use client";

import dynamic from "next/dynamic";
import type { PostMeta } from "@/lib/posts";

// three.js 只在客户端加载，不阻塞首屏 HTML
const SceneCanvas = dynamic(() => import("./three/SceneCanvas"), { ssr: false });

export default function Background({ posts }: { posts: PostMeta[] }) {
  return <SceneCanvas posts={posts} />;
}
