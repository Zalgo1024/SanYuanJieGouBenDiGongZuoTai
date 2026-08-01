import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="route-state">
      <span className="eyebrow">404 / 页面不存在</span>
      <h1>没有找到这个分析页面</h1>
      <p>链接可能已经失效，或对应内容不在当前工作空间中。</p>
      <Link className="primary-button" href="/dashboard"><ArrowLeft size={16} />返回工作台</Link>
    </main>
  );
}
