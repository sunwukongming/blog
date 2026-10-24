# GM Lab

一个有 3D 世界的个人博客。书房里写 Go / 云原生 / 可观测与前端笔记，桌上的小游戏用来验证交互。每个页面是一个独立的 3D 场景，全站共用一个常驻的 WebGL Canvas，换页时场景淡入淡出切换，不会重建 WebGL 上下文。

| 路由 | 世界 | 交互 |
|---|---|---|
| `/` | Low-poly 书房（GM Lab）+ 个人介绍 | 点电脑 → 文章，手柄 → 游戏，书架 → 云与可观测，地球仪 → 分类，墙上的画 → 归档，窗户 → 随笔 |
| `/categories` | 轨道索引（星系） | 行星是分类，卫星是文章，点击行星飞过去 |
| `/categories/[slug]` | 同上，镜头聚焦到该行星 | 分类摘要、篇数与阅读时长 |
| `/blog` | 卡片环 | 文章列表；标题/摘要搜索与分类筛选 |
| `/blog/[slug]` | 信号场（点阵） | 正文、目录 TOC、复制链接、分享到 X、阅读时长、相关推荐与进度点 |
| `/about` | 跳转到首页 | |
| `/games` | 夜行（霓虹线框地形） | 游戏入口、本机纪录汇总与相关条目 |
| `/games/[slug]` | 同上（背景静止，省电） | 能直接玩的小游戏：贪吃蛇（穿墙关 HUD）、俄罗斯方块（Hold / 幽灵 / T-Spin 与消行提示）、2048、打砖块、扫雷、德州扑克、记忆翻牌 |
| `/archive` | 夜行（彼虹线框地形） | 按年折叠的文章归档 |

## 开发

```bash
pnpm install
pnpm dev
```

## 写文章

在 `content/posts/` 下新建 `.mdx` 文件，文件名就是 URL（只能用小写字母、数字和 `-`）：

```mdx
---
title: 文章标题
date: "2026-10-23"
category: backend    # frontend | backend | essays | tools | cloud
summary: 一句话摘要
---

正文，支持 MDX 和代码高亮。
```

`title`、`date`（YYYY-MM-DD）和 `category` 必填，分类必须是 `lib/categories.ts` 里有的，写错了 `pnpm build` 会直接报错，不会带着问题上线。

## 改成你自己的

- 站点名称：`lib/site.ts` 里的 `SITE`
- 分类（名称、颜色、行星顺序）：`lib/categories.ts`
- 路由和世界的对应关系：`lib/worlds.ts`
- 每个世界的配色和标题字体：`app/globals.css` 顶部
- 首页的个人介绍（名字、简介、技术栈、链接）：`lib/site.ts` 里的 `PROFILE`
- 看板娘“梦子”（《狂赌之渊》蛇喰梦子的同人形象）的台词（按页面、按时间、被戳时）：`lib/mascot.ts`；形象和交互在 `components/mascot/Mascot.tsx`
- 站点正式地址：在 Vercel 项目的环境变量里设置 `NEXT_PUBLIC_SITE_URL`（例如 `https://example.com`）。不设置时会用 Vercel 提供的生产域名；两个都没有时不输出 canonical，sitemap 为空

## 内容进度

本地持续 enrichment。第十二批：Redis Streams vs Kafka、Go slog、Next PPR、Tetris T-Spin / Snake 穿墙 HUD。第十三批：CSS Anchor、EXPLAIN ANALYZE、errgroup；Breakout/Poker/Memory HUD。第十四批：HTTP 再验证、表驱动夹具、Vue Suspense；扫雷/2048 HUD。第十五批：OTel baggage、CSS scroll-driven、NetworkPolicy；Tetris B2B/连消、Snake 加速档；首页 description 对齐与 feed lastBuildDate。 第十六批：pnpm workspace、Postgres VACUUM/膨胀、React useEffectEvent；Breakout 生命/多球状态条、Poker 边池说明、Memory 各难度最佳步对比；分类页 OG 与 robots host。 第十七批：Go fuzz、CSS View Transitions、K8s PDB；扫雷首击安全区、Tetris 预览/Hold tip、Snake 穿墙+加速合并 tip；归档 OG 与 feed managingEditor。 第十八批：Go singleflight、Web Vitals attribution、K8s HPA 稳定窗；Breakout 道具说明、Poker 盲注级别 tip、2048 下一档目标强化；文章列表 OG 与 sitemap 游戏 lastmod 对齐。 第十九批：Go JSON 取舍、useDeferredValue、Postgres 分区裁剪；Memory 连击+最少步同屏、扫雷剩余雷强调、Tetris Hold 可用状态；游戏列表 OG 与首页 WebSite JSON-LD。 第二十批：ClickHouse MergeTree、Go Wire DI 边界、Vue3 keep-alive；Snake 下一速度档 tip、Breakout 连击 HUD、Poker 盲注+边池同屏；文章 OG/Twitter 补全与 RSS atom:link/生成器复核。 第二十一批：useTransition 搜索、ResourceQuota/LimitRange、net/http 中间件栈；Memory 难度切换保留连击最高、Mines Chord 可用数强调、Tetris 幽灵/Hold 同条 tip；归档 ItemList JSON-LD 与单游戏 OG。 第二十二批：context.WithValue 误用、satisfies、OTel Event vs Attribute；Snake 金色食物倒计时、Breakout 球速/拍宽同屏、Poker 跟注胜率+边池并存；文章列表 ItemList JSON-LD 与 sitemap 纳入 feed。 第二十三批：SQL NULL、watchEffect/effectScope、PriorityClass；Memory 残局+连击同条、Mines 首击后 tip、Tetris B2B/幽灵同屏；分类 ItemList JSON-LD 与首页 OG。 第二十四批：LISTEN/NOTIFY、cache tag/revalidateTag、Testcontainers；Snake 金食+穿墙同条、Breakout 生命/球速同屏、Poker 需胜率 HUD；单分类 CollectionPage JSON-LD 与 robots feed。 第二十五批：Ingress 超时、atomic vs Mutex、React Compiler；Memory 残局焦点、Mines 中盘旗密、Tetris 连消×B2B；游戏列表 ItemList 与 manifest theme_color。 第二十六批：BRIN、defineModel、slog Handler 流水线；Snake 速度档+金食 HUD、Breakout 多球/残命同条、Poker 盲注闪提示；单游戏 JSON-LD 与 manifest background_color。 第二十七批：Redis Stream 消费组、Teleport SSR、Zod API 边界；Memory 连击条、Mines 计时分段、Tetris 预览格 tip；文章 Article JSON-LD 与 feed docs/ttl/copyright。 第二十八批：部分索引、context Timeout/Deadline、ephemeral-storage；Snake 穿墙边缘预警、Breakout 关卡进度条、Poker 底池|边池同条；相关推荐 ItemList 与 sitemap priority。 第二十九批：React key 重挂载、Redis keyspace 通知、Vue provide/inject 类型；Memory 残局进度条、Mines 开图分段色、Tetris Hold 冷却；博客列表 description 与 robots 注释对齐。 第三十批：覆盖索引、HTTP Transport、CSS :has；Snake 金食+速度强化、Breakout 道具剩余时间、Poker 需胜率色阶；归档 OG 与 manifest shortcuts。 第三十一批：表达式索引、CSS subgrid、Go t.Parallel；Memory 残局+连击同条、Mines 开图/旗密同条、Tetris Hold+预览同条；游戏列表 OG/ItemList 与 feed image。 第三十二批：可辨识联合、GIN/JSONB、K8s Sidecar；Snake 穿墙预警+金食、Breakout 进度|道具、Poker 盲注|需胜率；首页 WebSite SearchAction 与分类 CollectionPage。 第三十三批：go embed、Hash 索引、OTel Exemplars；Memory 双高+最少步、Mines Chord|开图、Tetris 连消|Hold；Article/related JSON-LD 与 sitemap 分类 priority。 第三十四批：Vue 异步组件、HTTP/3·QUIC、Go RawMessage；Snake 距金 ETA、Breakout 连击|进度|空降、Poker 筹码/BB；feed 条目 enclosure+author、manifest shortcuts icons。 第三十五批：K8s Topology Spread、CSS Cascade Layers、TS 模板字面量路由；Memory 步差、Mines 可翻、Tetris 距升级；分类/归档/文章 OG images 对齐、feed media:content。 第三十六批：slog Attr 助手、K8s Job backoff、Vue script setup 宏；Snake 无尽距金强化、Breakout 金属砖、Poker 涨盲进度；游戏页 OG images、首页 WebSite sameAs/hasPart。 第三十七批：Redis Lua 原子、Next after()、Postgres 咨询锁；Memory 步差色阶、Mines 收官可翻、Tetris Hold 冷却条；单游戏 Twitter/OG images、feed media:thumbnail。 第三十八批：Go reflect 便宜检查、Vue defineSlots、HTTP Vary；Snake 穿墙近缘色阶、Breakout 金属|空降同条、Poker 涨盲 ETA；归档 Twitter images、robots 注释对齐。 第三十九批：Postgres Skip Scan、React Activity、K8s Resource Claims；Memory 步差条脉冲、Mines 可翻峰值、Tetris 距升级色阶；分类 Twitter images、GAMES_UPDATED/sitemap 注释复核。 第四十批：Go slog LogValuer、RedisBloom、Postgres Hash Join；Snake 金食/距金双色阶、Breakout 连击峰条、Poker 底池/BB 同屏；博客列表 Twitter images、manifest shortcuts 注释。 第四十一批：TS satisfies vs as、K8s Gateway API、Redis Cuckoo；Memory 连击峰条、Mines 可翻峰条、Tetris 升级进度条；首页 OG/Twitter images、feed media 注释。 第四十二批：Go synctest、OTel Span Links、覆盖 vs 部分索引；Snake 金食/距金进度条、Breakout 金属|空降条、Poker SPR；游戏列表 Twitter images、robots/sitemap 注释。 第四十三批：Vue effectScope、K8s 原生 Sidecar、Redis 概率结构选型；Memory 破纪录余量、Mines 用时/最快条、Tetris 幽灵色阶；分类 Twitter images。 第四十四批：Postgres XID wraparound、after vs useEffect、Anchor vs Popover；Snake 速度条、Breakout 生命条、Poker 跟注BB/需胜率条；归档 JSON-LD、feed generator、manifest theme。 第四十五批：errgroup vs WaitGroup、Pub/Sub vs Streams、View Transitions SPA；Memory 效率条、Mines 开图条、Tetris 连消峰条；robots/sitemap/首页 JSON-LD 复核。

## SEO 与订阅

- `/feed.xml`：RSS（条目 author 邮箱形、enclosure + media:content、CDATA 摘要、channel lastBuildDate）
- `/archive`：按年折叠归档，带 SEO description
- `/sitemap.xml`、`/robots.txt`：给搜索引擎（文章 lastmod 用发布日，列表页用最新文章日）
- 首页、分类（含分类详情）、归档、文章列表与游戏列表页带 description 与 OG；分类/归档/文章列表/游戏详情 OG/Twitter；robots 含 host；feed 含 managingEditor 与 atom:link；sitemap 中 /games 用 GAMES_UPDATED
- 可玩游戏路由 sitemap lastmod 使用 `GAMES_UPDATED`
- 每篇文章自动生成 1200×630 的分享图（`app/blog/[slug]/opengraph-image.tsx`），中文字体在构建时从 Google Fonts 按需下载

## 结构

```
components/three/
  SceneCanvas.tsx   常驻 Canvas，根据路由挂载世界，负责换页淡入淡出；游戏页和看不见书房时暂停渲染
  utils.ts          世界时钟、宽屏右移 / 窄屏跟随占位元素、事件穿透判断等
  worlds/           五个世界：Room / Orbit / Ring / Field / Drive
components/games/
  GamePlayer.tsx    按 slug 只在客户端加载对应游戏
  input.ts          键盘、滑动、震动、本机最高分（localStorage）
  Snake / Tetris / Game2048 / Breakout / Minesweeper / Poker / Memory
components/ArticleTools.tsx 文章目录、阅读进度条、相关推荐旁进度点、代码复制、复制链接、分享到 X
components/MdxContent.tsx   编译 MDX，给 h2/h3 加锚点 id（规则和 lib/toc.ts 一致）
components/WorldTheme.tsx   把当前世界写到 <html data-world>，驱动页面配色和地址栏颜色
lib/posts.ts                读取 MDX 并校验 frontmatter（"use cache"，构建时预渲染）
lib/games.ts                游戏列表和玩法说明
lib/og.tsx                  分享图模板
```

手机上首页的书房和分类页聚焦的行星不是固定在屏幕上，而是对准页面里的占位元素（`.room-stage`、`.orbit-stage`），跟着页面一起滚动，不会和正文叠在一起。

正文 DOM 盖在 Canvas 上面。`main` 默认不接收鼠标事件，只有标了 `data-ui` 的面板和链接、按钮会接收，其余区域的鼠标事件交给 3D 场景。

系统开启“减少动态效果”时，所有世界的动画会停止，只保留鼠标交互。

## 加一个小游戏

1. 在 `components/games/` 下写一个默认导出的客户端组件
2. 在 `components/games/GamePlayer.tsx` 里按 slug 注册
3. 在 `lib/games.ts` 的 `GAMES` 里加一条，`playable: true`，写好 `controls` 和 `touchControls`
4. 想在列表卡片上显示图标和最高分，再改 `GameIcon.tsx` 和 `GameBest.tsx`

## 加关卡

贪吃蛇和打砖块的关卡都是字符画，改完刷新就能玩：

- 记忆翻牌：连击 + 残局（剩 ≤3 对）提示
- 扫雷：chord；安全格开图 % + 收官 tip；剩余雷少时高亮
- 德州扑克：盲注翻倍提示；底池占筹码比例与跟注打平胜率提示
- 打砖块：多球（M）、剩余砖/完成度 HUD、关卡难度提示（球速/拍宽）
- 俄罗斯方块：锁定延迟 + Hold/幽灵；T-Spin、连消与 Back-to-Back 提示
- 贪吃蛇：穿墙 HUD + 加速档（步进 ms）提示；关卡/无尽均显示
- `components/games/snakeLevels.ts`：20×20 地图，`#` 墙，`S` 蛇头（左边两格要空着，开局向右走）；`goal` 吃够多少过关，`speed` 开局速度，`wrap` 能否穿墙，`bonus` 是否刷金色食物
- `components/games/breakoutLevels.ts`：每行 10 格，`1` 普通砖，`2` / `3` 硬砖，`#` 金属块（打不碎），`W` / `S` / `L` / `M` 带道具的砖（M=多球）

注意别让地图里有蛇到不了的空地，也别把砖块整个用金属块围死，否则会打不完。
