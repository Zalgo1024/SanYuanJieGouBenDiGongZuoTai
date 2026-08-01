"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

export function NavigationBackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const classes = ["navigation-back", className].filter(Boolean).join(" ");

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  return (
    <button className={classes} type="button" onClick={goBack} aria-label="返回上一页" title="返回上一页">
      <ArrowLeft size={16} aria-hidden="true" />
      <span>返回</span>
    </button>
  );
}
