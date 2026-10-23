# GM Lab

一个有 3D 世界的个人博客。每个页面是一个独立的 3D 场景，全站共用一个常驻的 WebGL Canvas，换页时场景淡入淡出切换，不会重建 WebGL 上下文。

| 路由 | 世界 | 交互 |
|---|---|---|
| `/` | 夜读小屋（Low-poly 书房）+ 个人介绍 | 点电脑 → 文章，书架 → 读书笔记，地球仪 → 分类，墙上的画 → 归档，窗户 → 随笔 |
| `/categories` | 轨道索引（星系） | 行星是分类，卫星是文章，点击行星飞过去 |
| `/categories/[slug]` | 同上，镜头聚焦到该行星 | |
| `/blog` | 卡片环 | 文章卡片环形排列，悬停浮起，点击阅读 |
| `/blog/[slug]` | 信号场（点阵） | 向下滚动时点阵被压平、变暗 |
| `/about` | 跳转到首页 | |
| `/games` | 夜行（霓虹线框地形） | 游戏相关条目 |
| `/games/[slug]` | 同上 | 能直接玩的小游戏：贪吃蛇、2048、扫雷 |
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
category: frontend   # frontend | graphics | essays | tools | reading
summary: 一句话摘要
---

正文，支持 MDX 和代码高亮。
```

现有的 6 篇文章都是示例内容，可以直接删掉。

## 改成你自己的

- 站点名称：`lib/site.ts` 里的 `SITE`
- 分类（名称、颜色、行星顺序）：`lib/categories.ts`
- 路由和世界的对应关系：`lib/worlds.ts`
- 每个世界的配色和标题字体：`app/globals.css` 顶部
- 首页的个人介绍（名字、简介、技术栈、链接）：`lib/site.ts` 里的 `PROFILE`

## 结构

```
components/three/
  SceneCanvas.tsx   常驻 Canvas，根据路由挂载世界，负责换页淡入淡出
  utils.ts          世界时钟、宽屏右移、事件穿透判断等
  worlds/           五个世界：Room / Orbit / Ring / Field / Drive
components/WorldTheme.tsx   把当前世界写到 <html data-world>，驱动页面配色
lib/posts.ts                读取 MDX（"use cache"，构建时预渲染）
```

正文 DOM 盖在 Canvas 上面。`main` 默认不接收鼠标事件，只有标了 `data-ui` 的面板和链接、按钮会接收，其余区域的鼠标事件交给 3D 场景。

系统开启“减少动态效果”时，所有世界的动画会停止，只保留鼠标交互。
