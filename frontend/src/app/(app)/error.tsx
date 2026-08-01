"use client";

import { RotateCcw } from "lucide-react";

export default function ApplicationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="route-state" role="alert">
      <span className="eyebrow">页面未能完成加载</span>
      <h1>分析空间遇到了问题</h1>
      <p>当前数据仍保留在工作空间中，可以重新加载此页面。</p>
      <button className="primary-button" type="button" onClick={reset}><RotateCcw size={16} />重新加载</button>
    </section>
  );
}
