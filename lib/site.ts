import type { Locale, Messages } from "./i18n";

// 站点信息和首页的个人介绍

// 正式环境地址：优先用 NEXT_PUBLIC_SITE_URL，其次用 Vercel 构建时提供的生产域名。
// 都拿不到时为 null，这时不输出 canonical，sitemap 也留空，避免把错误的地址交给搜索引擎
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
export const SITE_URL = siteUrl ? siteUrl.replace(/\/$/, "") : null;

const DESCRIPTION: Messages<string> = {
  zh: "GM Lab：可点的 3D 书房——电脑进 Go / 云原生 / OpenTelemetry 与前端笔记，手柄打开桌上小游戏，书架与地球仪通往分类与归档。",
  en: "GM Lab: a clickable 3D study. The computer opens notes on Go, cloud native, OpenTelemetry and frontend; the controller starts the desk games; the bookshelf and globe lead to categories and the archive.",
  ja: "GM Lab：クリックできる 3D の書斎。パソコンから Go・クラウドネイティブ・OpenTelemetry・フロントエンドのノートへ、コントローラーから机の上のミニゲームへ、本棚と地球儀からカテゴリーとアーカイブへ。",
};

export function getSite(lang: Locale) {
  return { name: "GM Lab", author: "GM", description: DESCRIPTION[lang] };
}

type Profile = {
  name: string;
  role: string;
  bio: string[];
  skills: string[];
  links: { label: string; href: string }[];
};

const SKILLS = ["Go", "gRPC", "MySQL", "Redis", "Kubernetes", "OpenTelemetry", "Linux", "TypeScript", "Vue 3", "React"];
const GITHUB = "https://github.com/sunwukongming";
const EMAIL = "mailto:gm420642207@gmail.com";

const PROFILES: Messages<Profile> = {
  zh: {
    name: "GM",
    role: "15 年研发老兵 · Go 架构师 · 前端同样是主场",
    bio: [
      "15 年一线研发，主力语言 Go。从单体到微服务、从机房到云原生，亲历过几代架构更替，知道每种方案会在什么地方出问题。",
      "擅长高并发与复杂业务的系统设计：服务拆分、存储选型、性能调优、稳定性治理；出了问题，从系统调用一路查到 Kubernetes 集群。",
      "前端同样精通，一个人就能把产品从服务端做到用户眼前；也乐于带团队、定规范，让一群人写出风格一致、好维护的代码。",
      "做事求稳：先想清楚系统和网络层面会发生什么，再小步上线，每一步都能回滚。",
      "这个站本身也是实验场：左边是书房里的文章与观测笔记，右边桌上的小游戏用来验证交互与前端工程——边写架构，边把玩法做完整。",
    ],
    skills: SKILLS,
    links: [
      { label: "GitHub", href: GITHUB },
      { label: "邮箱", href: EMAIL },
      { label: "RSS", href: "/zh/feed.xml" },
    ],
  },
  en: {
    name: "GM",
    role: "15 years in engineering · Go architect · equally at home on the frontend",
    bio: [
      "Fifteen years of hands-on engineering, mostly in Go. I've lived through several generations of architecture, from monoliths to microservices and from server rooms to cloud native, and I know where each approach tends to break.",
      "I design systems for high concurrency and complex business logic: service boundaries, storage choices, performance tuning and reliability. When something goes wrong, I trace it from system calls all the way up to the Kubernetes cluster.",
      "I'm just as fluent on the frontend and can take a product from the server to the user's screen on my own. I also enjoy leading teams and setting conventions so that many people write consistent, maintainable code.",
      "I value stability: think through what will happen at the system and network level first, then ship in small steps that can each be rolled back.",
      "This site is a lab too: the articles and observability notes live in the study, and the games on the desk are where I test interaction and frontend engineering, finishing the gameplay while writing about architecture.",
    ],
    skills: SKILLS,
    links: [
      { label: "GitHub", href: GITHUB },
      { label: "Email", href: EMAIL },
      { label: "RSS", href: "/en/feed.xml" },
    ],
  },
  ja: {
    name: "GM",
    role: "開発歴 15 年 · Go アーキテクト · フロントエンドも得意分野",
    bio: [
      "開発の第一線で 15 年、メイン言語は Go。モノリスからマイクロサービスへ、オンプレミスからクラウドネイティブへと、何世代ものアーキテクチャの移り変わりを経験し、それぞれの方式がどこでつまずくかを知っています。",
      "高並行・複雑な業務ロジックのシステム設計が得意です。サービス分割、ストレージ選定、性能チューニング、安定性の改善。問題が起きれば、システムコールから Kubernetes クラスターまで追いかけます。",
      "フロントエンドにも精通しており、サーバーからユーザーの画面までひとりで作り上げられます。チームを率いて規約を整え、みんなが一貫した保守しやすいコードを書けるようにするのも好きです。",
      "安定第一。まずシステムとネットワークのレベルで何が起きるかを考え抜き、それからロールバックできる小さなステップでリリースします。",
      "このサイト自体も実験場です。書斎には記事と可観測性のノートを、机の上のミニゲームではインタラクションとフロントエンドの検証を。アーキテクチャを書きながら、遊びもきちんと作り込んでいます。",
    ],
    skills: SKILLS,
    links: [
      { label: "GitHub", href: GITHUB },
      { label: "メール", href: EMAIL },
      { label: "RSS", href: "/ja/feed.xml" },
    ],
  },
};

export const getProfile = (lang: Locale) => PROFILES[lang];
