import { redirect } from "next/navigation";

// 导出中心已合并到报告库，统一入口避免两套界面。
export default function ExportRedirect() {
  redirect("/report");
}
