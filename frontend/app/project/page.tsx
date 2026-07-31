import { redirect } from "next/navigation";

// 旧版静态项目页已替换为动态项目列表，保留向后兼容。
export default function ProjectRedirect() {
  redirect("/projects");
}
