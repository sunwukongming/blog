export type Category = {
  slug: string;
  name: string;
  color: string;
  blurb: string;
};

// 顺序即星系里由内到外的轨道顺序
export const CATEGORIES: Category[] = [
  { slug: "frontend", name: "前端", color: "#6fa8ff", blurb: "React、Next.js 和浏览器里的一切" },
  { slug: "graphics", name: "图形学", color: "#ff8a7a", blurb: "着色器、WebGL 和 3D 的乐趣" },
  { slug: "essays", name: "随笔", color: "#9be0b8", blurb: "写代码以外的日子" },
  { slug: "tools", name: "工具", color: "#e2c46a", blurb: "编辑器、终端和顺手的东西" },
  { slug: "reading", name: "读书", color: "#c49bff", blurb: "读过的书和留下的笔记" },
];

export function getCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}
