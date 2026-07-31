import { redirect } from "next/navigation";

// 旧版多主体工作台已重构为独立的「利益分析」模块，统一入口避免两套界面。
export default function MultiSubjectRedirect() {
  redirect("/interest-analysis");
}
