import type { Locale, Messages } from "./i18n";

export type Category = {
  slug: string;
  name: string;
  color: string;
  blurb: string;
};

type CategoryDef = { slug: string; color: string; name: Messages<string>; blurb: Messages<string> };

// 顺序即星系里由内到外的轨道顺序
const DEFS: CategoryDef[] = [
  {
    slug: "frontend",
    color: "#6fa8ff",
    name: { zh: "前端", en: "Frontend", ja: "フロントエンド" },
    blurb: {
      zh: "TypeScript、Vue 3、React 与工程化",
      en: "TypeScript, Vue 3, React and frontend engineering",
      ja: "TypeScript、Vue 3、React とフロントエンド開発基盤",
    },
  },
  {
    slug: "backend",
    color: "#ff8a7a",
    name: { zh: "后端", en: "Backend", ja: "バックエンド" },
    blurb: {
      zh: "Go 服务端、架构与基础服务",
      en: "Go services, architecture and core infrastructure",
      ja: "Go のサーバーサイド、アーキテクチャと基盤サービス",
    },
  },
  {
    slug: "essays",
    color: "#9be0b8",
    name: { zh: "随笔", en: "Essays", ja: "エッセイ" },
    blurb: {
      zh: "做事方式、灰度改造与一些旁白",
      en: "How I work, gradual rollouts and a few asides",
      ja: "仕事の進め方、段階的な移行、ちょっとした余談",
    },
  },
  {
    slug: "tools",
    color: "#e2c46a",
    name: { zh: "工具", en: "Tools", ja: "ツール" },
    blurb: {
      zh: "沙箱、CI/CD、排障与顺手的东西",
      en: "Sandboxes, CI/CD, debugging and handy utilities",
      ja: "サンドボックス、CI/CD、トラブルシューティングと便利な道具",
    },
  },
  {
    slug: "cloud",
    color: "#c49bff",
    name: { zh: "云与可观测", en: "Cloud & Observability", ja: "クラウドと可観測性" },
    blurb: {
      zh: "K8s、OpenTelemetry、稳定性",
      en: "Kubernetes, OpenTelemetry and reliability",
      ja: "Kubernetes、OpenTelemetry、安定性",
    },
  },
];

export const CATEGORY_SLUGS = DEFS.map((d) => d.slug);

const localize = (d: CategoryDef, lang: Locale): Category => ({
  slug: d.slug,
  color: d.color,
  name: d.name[lang],
  blurb: d.blurb[lang],
});

export function getCategories(lang: Locale): Category[] {
  return DEFS.map((d) => localize(d, lang));
}

export function getCategory(slug: string, lang: Locale = "zh") {
  const d = DEFS.find((c) => c.slug === slug);
  return d ? localize(d, lang) : undefined;
}
