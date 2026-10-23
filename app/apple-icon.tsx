import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// iOS 主屏幕不认 SVG，把 app/icon.svg 画成 180×180 的 PNG
const svg = await readFile(join(process.cwd(), "app/icon.svg"), "base64");

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#14021f" }}>
        <img src={`data:image/svg+xml;base64,${svg}`} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
