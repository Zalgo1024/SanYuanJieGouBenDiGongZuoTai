"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch, IconBell, IconTheme } from "@/components/icons";

export default function TopBar({ title = "页面名称" }: { title?: string }) {
  const router = useRouter();
  const [user, setUser] = useState("李");

  useEffect(() => {
    const u = localStorage.getItem("tsap_user");
    if (u) setUser(u);
  }, []);

  const logout = () => {
    localStorage.removeItem("tsap_token");
    localStorage.removeItem("tsap_user");
    router.replace("/login");
  };

  return (
    <header className="h-topbar shrink-0 bg-white flex items-center px-6 gap-2 border-b border-cardborder">
      <span className="text-[13px] text-sub">{title}</span>

      <div className="flex-1" />

      {/* Search */}
      <div className="w-[260px] h-9 rounded-input bg-[#F3F4F6] flex items-center px-3 gap-2 text-muted">
        <IconSearch size={16} />
        <span className="text-[13px]">搜索…</span>
      </div>

      {/* Bell */}
      <button className="w-9 h-9 rounded-input flex items-center justify-center text-sub hover:bg-[#F3F4F6]">
        <IconBell size={18} />
      </button>
      {/* Theme */}
      <button className="w-9 h-9 rounded-input flex items-center justify-center text-sub hover:bg-[#F3F4F6]">
        <IconTheme size={18} />
      </button>

      <div className="w-px h-6 bg-cardborder mx-1" />

      <div className="w-9 h-9 rounded-full bg-avatar flex items-center justify-center cursor-pointer" title="退出登录" onClick={logout}>
        <span className="text-white text-[14px] font-medium">{user.slice(0, 1)}</span>
      </div>
      <button
        onClick={logout}
        className="text-[12px] text-sub hover:text-ink ml-1"
        title="退出登录"
      >
        退出
      </button>
    </header>
  );
}
