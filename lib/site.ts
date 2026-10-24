// 站点信息和首页的个人介绍

// 正式环境地址：优先用 NEXT_PUBLIC_SITE_URL，其次用 Vercel 构建时提供的生产域名。
// 都拿不到时为 null，这时不输出 canonical，sitemap 也留空，避免把错误的地址交给搜索引擎
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
export const SITE_URL = siteUrl ? siteUrl.replace(/\/$/, "") : null;

export const SITE = {
  name: "GM Lab",
  description:
    "GM Lab：一间可点的书房，里面是 Go / 云原生 / OpenTelemetry 与前端笔记，桌上还有几个能直接玩的小游戏。",
  author: "GM",
};

export const PROFILE = {
  name: "GM",
  role: "15 年研发老兵 · Go 架构师 · 前端同样是主场",
  bio: [
    "15 年一线研发，主力语言 Go。从单体到微服务、从机房到云原生，亲历过几代架构更替，知道每种方案会在什么地方出问题。",
    "擅长高并发与复杂业务的系统设计：服务拆分、存储选型、性能调优、稳定性治理；出了问题，从系统调用一路查到 Kubernetes 集群。",
    "前端同样精通，一个人就能把产品从服务端做到用户眼前；也乐于带团队、定规范，让一群人写出风格一致、好维护的代码。",
    "做事求稳：先想清楚系统和网络层面会发生什么，再小步上线，每一步都能回滚。",
    "这个站本身也是实验场：左边是书房里的文章与观测笔记，右边桌上的小游戏用来验证交互与前端工程——边写架构，边把玩法做完整。",
  ],
  skills: ["Go", "gRPC", "MySQL", "Redis", "Kubernetes", "OpenTelemetry", "Linux", "TypeScript", "Vue 3", "React"],
  links: [
    { label: "GitHub", href: "https://github.com/sunwukongming" },
    { label: "邮箱", href: "mailto:gm420642207@gmail.com" },
    { label: "RSS", href: "/feed.xml" },
  ],
};
