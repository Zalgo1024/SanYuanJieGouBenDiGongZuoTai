import { redirect } from "next/navigation";

// 网络图已整合进报告展示页，统一入口避免两套界面。
export default function NetworkRedirect() {
  redirect("/report");
}
