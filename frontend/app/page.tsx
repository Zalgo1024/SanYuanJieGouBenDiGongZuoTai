"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 根路径入口：与 AuthGate 保持一致，改用客户端导航，
 * 避免服务端 redirect() 与布局内 AuthGate 的客户端 router.replace()
 * 在 hydration 阶段冲突，导致 Next.js 报
 * "Rendered more hooks than during the previous render" 而整页崩溃。
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("tsap_token") : null;
    router.replace(token ? "/dashboard" : "/login");
  }, [router]);

  return null;
}
