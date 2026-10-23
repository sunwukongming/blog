// 每个路由对应一个 3D 世界，全站共用一个常驻 Canvas
export type World = "room" | "orbit" | "ring" | "field" | "drive";

export const WORLD_BG: Record<World, string> = {
  room: "#1b2236",
  orbit: "#04050c",
  ring: "#dde2ea",
  field: "#0a0c10",
  drive: "#14021f",
};

export function worldFor(pathname: string): World {
  if (pathname === "/") return "room";
  if (pathname.startsWith("/categories")) return "orbit";
  if (pathname === "/blog") return "ring";
  if (pathname.startsWith("/blog/")) return "field";
  if (pathname.startsWith("/games")) return "drive";
  if (pathname.startsWith("/archive")) return "drive";
  return "field";
}

// /categories/[slug] 时让星系镜头聚焦到对应行星
export function focusedCategory(pathname: string) {
  const m = pathname.match(/^\/categories\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
