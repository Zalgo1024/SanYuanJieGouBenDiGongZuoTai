"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  IconDashboard,
  IconProject,
  IconEngine,
  IconReport,
  IconMaterial,
  IconInterest,
  IconCase,
  IconData,
  IconSettings,
} from "@/components/icons";

const NAV = [
  { href: "/dashboard", label: "工作台", Icon: IconDashboard },
  { href: "/projects", label: "项目", Icon: IconProject },
  { href: "/analysis", label: "分析引擎", Icon: IconEngine },
  { href: "/report", label: "报告", Icon: IconReport },
  { href: "/cases", label: "案例库", Icon: IconCase },
  { href: "/interest-analysis", label: "利益分析", Icon: IconInterest },
  { href: "/materials", label: "输入材料", Icon: IconMaterial },
  { href: "/settings", label: "设置", Icon: IconSettings },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-sidebar shrink-0 h-screen bg-navy flex flex-col text-navtext">
      {/* Logo row */}
      <div className="h-16 flex items-center px-[33px] gap-[10px]">
        <div className="w-9 h-9 rounded-md bg-logo flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-[18px] leading-none">三</span>
        </div>
        <span className="text-white font-semibold text-[16px] whitespace-nowrap">
          三元结构分析平台
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 mt-2 flex flex-col gap-0.5">
        {NAV.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "h-11 rounded-md flex items-center gap-3 px-3 transition-colors",
                active
                  ? "bg-white/10 text-white"
                  : "text-navtext hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon size={18} />
              <span className="text-[14px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User chip */}
      <div className="px-3 pb-3">
        <div className="h-[60px] rounded-lg bg-white/10 flex items-center gap-2.5 px-3">
          <div className="w-9 h-9 rounded-full bg-avatar flex items-center justify-center shrink-0">
            <span className="text-white text-[14px] font-medium">李</span>
          </div>
          <div className="leading-tight">
            <div className="text-white text-[14px] font-medium">李政恒</div>
            <div className="text-navtext text-[11px]">分析师 · 智库工作组</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
