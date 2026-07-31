import { redirect } from "next/navigation";

// 旧版结构化向导已合并到分析引擎，统一入口避免两套界面。
export default function WizardRedirect() {
  redirect("/analysis");
}
