"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { useProject, useTasks } from "@/lib/hooks";
import { deleteProject, downloadUrl, type TaskDTO } from "@/lib/api";
import FormattedDate from "@/components/FormattedDate";

const TASK_STATUS: Record<string, { label: string; color: string }> = {
  queued: { label: "已入队", color: "#2E86C1" },
  generating: { label: "生成中", color: "#F49C12" },
  done: { label: "已完成", color: "#27AE60" },
  error: { label: "失败", color: "#E74C3C" },
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = typeof params.id === "string" ? params.id : String(params.id);
  const { data: project, isLoading } = useProject(id);
  const { data: tasks } = useTasks({ project_id: id, limit: 50 });

  async function handleDelete() {
    if (!project) return;
    if (
      !window.confirm(
        `确定删除项目「${project.name}」？\n项目下的所有分析报告、版本记录与产物文件将被一并删除，且不可恢复。`
      )
    ) {
      return;
    }
    try {
      await deleteProject(id);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.push("/projects");
    } catch (err) {
      window.alert("删除失败：" + (err instanceof Error ? err.message : String(err)));
    }
  }

  if (isLoading) {
    return (
      <AppShell title="加载中…">
        <div className="max-w-[1200px] mx-auto text-[13px] text-muted">
          加载项目数据…
        </div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell title="未找到项目">
        <div className="max-w-[1200px] mx-auto">
          <div className="card p-8 text-center">
            <div className="text-[15px] text-ink mb-2">未找到该项目</div>
            <Link href="/projects" className="text-[13px] text-navy hover:underline">
              ← 返回项目列表
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const pct = parseInt(project.progress, 10) || 0;
  const isDone = project.status === "已完成";
  const stats = [
    { label: "利益主体", value: project.subjects, color: "#343E5E" },
    { label: "利益项", value: project.interests, color: "#E74C3C" },
    { label: "报告章节", value: project.chapters, color: "#2E86C1" },
    { label: "完成度", value: project.progress, color: "#27AE60" },
  ];
  const taskList: TaskDTO[] = tasks ?? [];

  return (
    <AppShell title={project.name}>
      <div className="max-w-[1200px] mx-auto">
        {/* Title */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-[22px] font-bold text-ink">{project.name}</h1>
              <span
                className="text-[11px] px-2 py-0.5 rounded-pill"
                style={{
                  background: isDone ? "#E8F5E9" : "#FFF3E0",
                  color: isDone ? "#2E7D32" : "#E65100",
                }}
              >
                {project.status}
              </span>
            </div>
            <p className="text-[13px] text-sub mt-1">{project.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/analysis"
              className="btn-primary h-10 px-4 text-[13px]"
            >
              开始分析
            </Link>
            <button
              onClick={handleDelete}
              className="h-10 px-4 rounded-md text-[13px] font-medium text-[#E74C3C] bg-[#FDECEA] hover:bg-[#FAD9D5] flex items-center"
            >
              删除项目
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-1.5 h-6 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="text-[13px] text-sub">{s.label}</span>
              </div>
              <div className="text-[26px] font-bold text-ink">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="card p-5 mb-6">
          <div className="text-[15px] font-semibold text-ink mb-4">快速操作</div>
          <div className="flex gap-3">
            <Link href="/analysis" className="btn-primary h-10 px-4 text-[13px]">
              开始分析
            </Link>
            <Link href="/report" className="btn-ghost h-10 px-4 text-[13px]">
              查看报告
            </Link>
            <Link href="/materials" className="btn-ghost h-10 px-4 text-[13px]">
              输入材料
            </Link>
          </div>
        </div>

        {/* Tasks for this project */}
        <div className="card p-5">
          <div className="text-[15px] font-semibold text-ink mb-4">
            本项目分析报告（{taskList.length}）
          </div>
          {taskList.length === 0 ? (
            <div className="text-[13px] text-muted">
              该项目暂无分析报告。去「分析引擎」提交分析并选择本项目即可。
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {taskList.map((t) => {
                const st = TASK_STATUS[t.status] ?? TASK_STATUS.queued;
                return (
                  <div
                    key={t.task_id}
                    className="flex items-center justify-between border-b border-cardborder pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[13px] text-ink truncate">
                        {t.title}
                      </span>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-pill shrink-0"
                        style={{ background: `${st.color}1A`, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-muted">
                        <FormattedDate iso={t.created_at} />
                      </span>
                      <Link
                        href={`/report/${t.task_id}`}
                        className="text-[12px] text-navy hover:underline"
                      >
                        查看
                      </Link>
                      {t.status === "done" && (
                        <a
                          href={downloadUrl(t.task_id, "word")}
                          className="text-[12px] text-navy hover:underline"
                        >
                          下载
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-[12px] text-muted mt-4">
          负责人：{project.owner_name || "—"} · 更新于{" "}
          <FormattedDate iso={project.updated_at} />
        </div>
      </div>
    </AppShell>
  );
}
