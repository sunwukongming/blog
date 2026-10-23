export type Category = {
  slug: string;
  name: string;
  color: string;
  blurb: string;
};

// 顺序即星系里由内到外的轨道顺序
export const CATEGORIES: Category[] = [
  { slug: "frontend", name: "前端", color: "#6fa8ff", blurb: "TypeScript、Vue 3、React 与工程化" },
  { slug: "backend", name: "后端", color: "#ff8a7a", blurb: "Go 服务端、架构与基础服务" },
  { slug: "essays", name: "随笔", color: "#9be0b8", blurb: "做事方式、灰度改造与一些旁白" },
  { slug: "tools", name: "工具", color: "#e2c46a", blurb: "沙箱、CI/CD、排障与顺手的东西" },
  { slug: "cloud", name: "云与可观测", color: "#c49bff", blurb: "K8s、OpenTelemetry、稳定性" },
];

export function getCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}
