"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// 本地单用户门禁：
// - 未设置本机身份访问非 /login 页面 -> 跳转到 /login
// - 已设置身份访问 /login -> 跳回 /dashboard
// 这是明确的本地单用户模式（数据仅存本机），并非"模拟登录"占位。
const LOCAL_MODE = "tsap_local_mode";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const authed =
      typeof window !== "undefined" && localStorage.getItem(LOCAL_MODE) === "on";
    const isLogin = pathname === "/login";
    if (!authed && !isLogin) {
      router.replace("/login");
    } else if (authed && isLogin) {
      router.replace("/dashboard");
    }
    setReady(true);
  }, [pathname, router]);

  // 就绪前不渲染受保护内容，避免未登录用户一闪而过看到内部页面
  if (!ready) return null;
  return <>{children}</>;
}
