# GM Lab

一个有 3D 世界的个人博客。每个页面是一个独立的 3D 场景，全站共用一个常驻的 WebGL Canvas，换页时场景淡入淡出切换，不会重建 WebGL 上下文。

| 路由 | 世界 | 交互 |
|---|---|---|
| `/` | 夜读小屋（Low-poly 书房）+ 个人介绍 | 点电脑 → 文章，手柄 → 游戏，书架 → 云与可观测，地球仪 → 分类，墙上的画 → 归档，窗户 → 随笔 |
| `/categories` | 轨道索引（星系） | 行星是分类，卫星是文章，点击行星飞过去 |
| `/categories/[slug]` | 同上，镜头聚焦到该行星 | |
| `/blog` | 卡片环 | 文章卡片环形排列，悬停浮起，点击阅读 |
| `/blog/[slug]` | 信号场（点阵） | 向下滚动时点阵被压平、变暗 |
| `/about` | 跳转到首页 | |
| `/games` | 夜行（霓虹线框地形） | 游戏相关条目 |
| `/games/[slug]` | 同上（背景静止，省电） | 能直接玩的小游戏：贪吃蛇、俄罗斯方块、2048、打砖块、扫雷 |
| `/archive` | 夜行（霓虹线框地形） | |

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
- 站点正式地址：在 Vercel 项目的环境变量里设置 `NEXT_PUBLIC_SITE_URL`（例如 `https://example.com`）。不设置时会用 Vercel 提供的生产域名；两个都没有时不输出 canonical，sitemap 为空

## SEO 与订阅

- `/feed.xml`：RSS 订阅
- `/sitemap.xml`、`/robots.txt`：给搜索引擎
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
  Snake / Tetris / Game2048 / Breakout / Minesweeper
components/ArticleTools.tsx 文章目录、阅读进度条、代码复制按钮
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
