export type Heading = { id: string; text: string; depth: 2 | 3 };

/** 标题文字转成锚点 id；中文直接保留，空白和标点换成 - */
export function slugify(text: string) {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[\s\p{P}\p{S}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

/** 同名标题依次加 -2、-3，正文和目录按同样的顺序调用，所以 id 一致 */
export function createSlugger() {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base = slugify(text);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
}

/** 从 MDX 源码里取出 ## 和 ### 标题（跳过代码块），去掉行内的 Markdown 标记 */
export function extractHeadings(source: string): Heading[] {
  const slug = createSlugger();
  const out: Heading[] = [];
  let fenced = false;
  for (const line of source.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const m = !fenced && line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const text = m[2]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[`*_~]/g, "")
      .trim();
    out.push({ id: slug(text), text, depth: m[1].length as 2 | 3 });
  }
  return out;
}
