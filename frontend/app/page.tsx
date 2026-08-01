"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 根路径 = 落地首页：直接整页跳转到静态展示页 showcase.html。
 * 展示页是独立 HTML 文档（含内联 CSS/JS 与 canvas 动画），
 * 用整页跳转而非 Next 客户端路由，避免把它当 route 处理导致资源加载异常。
 */
export default function Home() {
  useEffect(() => {
    window.location.href = "/showcase.html";
  }, []);

  return null;
}
