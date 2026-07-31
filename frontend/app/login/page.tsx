"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 本地单用户模式（明确、非占位）：
// 本程序为单机内部工具，无公网、无多用户隔离。进入工作台只需一个「本机显示名称」，
// 用于标注报告归属与界面展示；数据仅保存在本机及本地后端（127.0.0.1）。
// 这不是"任意账号密码即可进入的演示占位登录"，而是明确的单用户本地入口；
// 多用户/会员体系按设计预留、尚未启用。
const LOCAL_KEY = "tsap_local_user";
const LOCAL_MODE = "tsap_local_mode";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = name.trim();
    if (!user) {
      setErr("请填写本机显示名称");
      return;
    }
    // 仅写入本机显示身份（localStorage），不发送任何外部地址。
    localStorage.setItem(LOCAL_KEY, user);
    localStorage.setItem(LOCAL_MODE, "on");
    router.replace("/dashboard");
  };

  return (
    <div className="min-h-screen flex">
      {/* 左侧品牌区 */}
      <div className="hidden md:flex md:w-[44%] bg-navy text-white flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg2 bg-logo flex items-center justify-center text-navy text-[22px] font-bold">
            三
          </div>
          <span className="text-[18px] font-semibold">三元结构分析平台</span>
        </div>
        <div>
          <div className="text-[26px] font-bold leading-snug">
            基于三元结构理论
            <br />
            的多主体利益分析工作台
          </div>
          <p className="text-navtext text-[14px] mt-4 leading-relaxed max-w-[420px]">
            输入事件或关键词，自动识别主体、配置利益、构建关系网络并生成结构化分析报告。
          </p>
        </div>
        <div className="text-navtext text-[12px]">本地单用户模式 · 数据仅存于本机</div>
      </div>

      {/* 右侧表单 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-[360px]">
          <h1 className="text-[22px] font-bold text-ink">进入工作台</h1>
          <p className="text-[13px] text-sub mt-1 mb-7">
            本地单用户模式：填写本机显示名称即可使用
          </p>

          <label className="block text-[13px] font-medium text-ink mb-1.5">
            本机显示名称
          </label>
          <input
            className="w-full h-10 rounded-input bg-inputbg border border-cardborder px-3 text-[13px] text-ink outline-none focus:border-navy placeholder:text-muted mb-2"
            placeholder="例如：李政恒"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {err && <div className="text-[12px] text-interest-material mb-2">{err}</div>}

          <button
            type="submit"
            className="btn-primary h-11 w-full text-[14px] mt-3"
          >
            进入工作台
          </button>

          <p className="text-[12px] text-muted mt-5 leading-relaxed">
            说明：本程序为单机内部工具，数据仅保存在本机及本地后端，不进行网络登录、
            不验证密码、不区分多用户权限。多用户会员体系按设计预留、尚未启用。
          </p>
        </form>
      </div>
    </div>
  );
}
