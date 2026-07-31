"use client";

import { useEffect, useState } from "react";
import { fmtDate } from "@/lib/api";

/**
 * 水合安全的日期显示组件。
 *
 * 问题背景：原 fmtDate 在渲染期间调用 Date.now() 计算「X 分钟前」，
 * 并用 getHours() 取本地时区。服务端（UTC、渲染时刻 T1）与浏览器
 * （本地时区、渲染时刻 T2）算出的文字不同，导致 React 水合不一致，
 * 在 Next.js App Router 下直接表现为
 * "Application error: a client-side exception has occurred"。
 *
 * 修复：SSR 与首次客户端渲染都输出「确定性」的 UTC 绝对日期（两端一致）；
 * 挂载后再切换为 fmtDate 的友好相对/本地格式（此时已脱离水合阶段，合法）。
 */
export default function FormattedDate({
  iso,
  className,
}: {
  iso?: string | null;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <span className={className}>
      {mounted ? fmtDate(iso) : fmtDateUTC(iso)}
    </span>
  );
}

/** 仅用于 SSR / 首次渲染的确定性占位（UTC，无相对时间，无本地时区）。 */
function fmtDateUTC(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(
    d.getUTCDate()
  )} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
