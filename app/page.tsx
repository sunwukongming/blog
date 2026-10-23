import PostList from "@/components/PostList";
import { getAllPosts } from "@/lib/posts";

export default async function Home() {
  const posts = await getAllPosts();
  return (
    <main data-world="room" className="page page--split">
      <div className="hero">
        <p className="eyebrow">夜读书房 · 深夜还亮着灯</p>
        <h1 className="display">今晚写点什么</h1>
        <p className="lede">
          这是我的书房。点电脑看文章，书架上是读书笔记，书架顶上的地球仪通往分类星系，墙上的画是归档，窗外是关于我。
        </p>
      </div>
      <section className="panel side" data-ui aria-labelledby="latest">
        <h2 id="latest">最近更新</h2>
        <PostList posts={posts.slice(0, 3)} />
      </section>
    </main>
  );
}
