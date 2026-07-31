import { redirect } from "next/navigation";

// 数据源页已合并到输入材料，统一入口避免两套界面。
export default function DataRedirect() {
  redirect("/materials");
}
