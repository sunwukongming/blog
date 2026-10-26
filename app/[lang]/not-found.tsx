import Link from "next/link";

export default function NotFound() {
  return (
    <main data-world="field" className="page" style={{ justifyContent: "center" }}>
      <div className="hero">
        <p className="eyebrow">404</p>
        <h1 className="display">这里只有噪声，没有信号</h1>
        <p className="lede">你要找的页面不存在。</p>
        <p>
          <Link href="/" className="back">
            ← 回到书房
          </Link>
        </p>
      </div>
    </main>
  );
}
