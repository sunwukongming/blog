"use client";

import dynamic from "next/dynamic";

// 看板娘只在客户端渲染：要读 localStorage 里“是否收起”，随机台词也不能参与服务端渲染
const Mascot = dynamic(() => import("./Mascot"), { ssr: false });

export default function MascotSlot() {
  return <Mascot />;
}
