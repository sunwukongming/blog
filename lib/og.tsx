import { ImageResponse } from "next/og";
import { SITE } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * 从 Google Fonts 只下载图里用到的字（不带 UA 时返回 TTF，satori 能直接用），整套中文字体太大。
 * 下载失败时返回 null，图照样生成，只是中文会用默认字体
 */
async function loadFont(text: string, weight: 400 | 700) {
  "use cache";
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@${weight}&text=${encodeURIComponent(text)}`,
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    return url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** 分享卡片：霓虹暗色底，左上站名，中间大标题，底部一行说明 */
export async function ogImage({ title, subtitle, tag }: { title: string; subtitle?: string; tag?: string }) {
  const [bold, regular] = await Promise.all([
    loadFont(SITE.name + title + (tag ?? ""), 700),
    loadFont(subtitle ?? "", 400),
  ]);
  const fonts = [
    bold && { name: "Noto Sans SC", data: bold, weight: 700 as const },
    regular && { name: "Noto Sans SC", data: regular, weight: 400 as const },
  ].filter((f) => !!f);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          color: "#ffd6f0",
          fontFamily: "Noto Sans SC",
          background: "radial-gradient(circle at 78% 110%, #ff3ea5 0%, #5a0b5e 32%, #14021f 70%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 700 }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: "#ff3ea5" }} />
          {SITE.name}
          {tag && (
            <div
              style={{
                marginLeft: 12,
                padding: "4px 16px",
                fontSize: 24,
                borderRadius: 999,
                border: "2px solid rgba(255, 62, 165, 0.6)",
                color: "#ff9ed2",
              }}
            >
              {tag}
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: title.length > 18 ? 62 : 76, fontWeight: 700, lineHeight: 1.2, color: "#fff" }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 400, color: "#d9a8c8", lineHeight: 1.5 }}>
          {subtitle ?? ""}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
