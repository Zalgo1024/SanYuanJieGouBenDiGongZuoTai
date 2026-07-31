import { redirect } from "next/navigation";

// 影响评估已整合进报告展示页，统一入口避免两套界面。
export default function ImpactRedirect() {
  redirect("/report");
}
