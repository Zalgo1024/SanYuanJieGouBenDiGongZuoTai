"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { useProjects } from "@/lib/hooks";
import { deleteProject, deleteProjects, type ProjectDTO } from "@/lib/api";
import FormattedDate from "@/components/FormattedDate";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: projects, isLoading, isError, error, refetch } = useProjects();
  const all: ProjectDTO[] = projects ?? [];

  // 已删除（乐观隐藏）的 id —— 删除请求发出后立即从列表移除，后台无效化后由服务端数据兜底
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  // 选中态：用 id 集合，跨分页/翻页保留（当前无分页，select-all 作用于当前可见全部）
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const list = all.filter((p) => !deletedIds.has(p.id));
  const selectedCount = selected.size;

  // 表头全选复选框状态：当前可见全部选中 -> 勾选；部分选中 -> 半选
  const selectAllRef = useRef<HTMLInputElement>(null);
  const allChecked = list.length > 0 && list.every((p) => selected.has(p.id));
  const someChecked = list.some((p) => selected.has(p.id));
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) list.forEach((p) => next.delete(p.id));
      else list.forEach((p) => next.add(p.id));
      return next;
    });
  }

  async function handleSingleDelete(e: React.MouseEvent, p: ProjectDTO) {
    e.preventDefault();
    e.stopPropagation();
    if (
      !window.confirm(
        `确定删除项目「${p.name}」？\n项目下的所有分析报告、版本记录与产物文件将被一并删除，且不可恢复。`
      )
    ) {
      return;
    }
    try {
      await deleteProject(p.id);
      setDeletedIds((prev) => new Set(prev).add(p.id));
      setSelected((prev) => {
        if (!prev.has(p.id)) return prev;
        const n = new Set(prev);
        n.delete(p.id);
        return n;
      });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.refresh();
    } catch (err) {
      window.alert("删除失败：" + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function confirmBatchDelete() {
    if (selectedCount === 0) return;
    const ids = [...selected];
    setBusy(true);
    try {
      const res = await deleteProjects(ids);
      // 乐观移除 + 重置选中
      setDeletedIds((prev) => new Set([...prev, ...ids]));
      setSelected(new Set());
      setShowConfirm(false);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.refresh();
      if (res.failed.length > 0) {
        window.alert(
          `已删除 ${res.deleted_count} 个项目，${res.failed.length} 个删除失败（可能已被删除或不存在）。`
        );
      }
    } catch (err) {
      window.alert("批量删除失败：" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="项目">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-ink">项目</h1>
            <p className="text-[13px] text-sub mt-1">管理你的全部分析项目（实时数据）</p>
          </div>
          <Link href="/analysis" className="btn-primary h-9 px-4 text-[13px]">
            + 新建分析
          </Link>
        </div>

        {isLoading && <LoadingState text="正在加载项目…" />}

        {isError && (
          <ErrorState
            message={(error as Error)?.message || "项目加载失败"}
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && all.length === 0 && (
          <EmptyState
            title="暂无项目"
            hint="去「分析引擎」运行一次分析即可生成报告与项目；也可在「项目」中新建并归档管理。"
          />
        )}

        {!isLoading && !isError && all.length > 0 && (
          <>
            {/* 批量操作工具条：全选 + 已选计数 + 删除按钮 */}
            <div className="flex items-center justify-between gap-4 mb-4 rounded-xl border border-line bg-surface px-4 py-2.5">
              <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer select-none">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 accent-[#1B3A5C] cursor-pointer"
                  aria-label="全选 / 取消全选"
                />
                全选
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-sub">
                  已选 <span className="font-semibold text-ink">{selectedCount}</span> 项
                </span>
                <button
                  type="button"
                  disabled={selectedCount === 0 || busy}
                  onClick={() => setShowConfirm(true)}
                  className={
                    "h-8 px-4 rounded-md text-[13px] font-medium transition-colors " +
                    (selectedCount === 0 || busy
                      ? "bg-[#F2D7D2] text-[#E74C3C]/50 cursor-not-allowed"
                      : "bg-[#E74C3C] text-white hover:bg-[#C62828]")
                  }
                >
                  {busy ? "删除中…" : `删除${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {list.map((p) => {
                const pct = parseInt(p.progress, 10) || 0;
                const isDone = p.status === "已完成";
                const checked = selected.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={
                      "card p-5 flex flex-col transition-shadow group " +
                      (checked ? "ring-2 ring-[#1B3A5C]/40" : "hover:shadow-md")
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(p.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 h-4 w-4 rounded border-gray-300 accent-[#1B3A5C] cursor-pointer shrink-0"
                          aria-label={`选择项目 ${p.name}`}
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/projects/${p.id}`}
                            className="text-[15px] font-semibold text-ink hover:text-[#1B3A5C] break-words"
                          >
                            {p.name}
                          </Link>
                          <div className="mt-1.5">
                            <span
                              className="text-[11px] px-2 py-0.5 rounded-pill"
                              style={{
                                background: isDone ? "#E8F5E9" : "#FFF3E0",
                                color: isDone ? "#2E7D32" : "#E65100",
                              }}
                            >
                              {p.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleSingleDelete(e, p)}
                        className="text-[11px] text-[#E74C3C] hover:text-[#C62828] px-2 py-0.5 rounded-md hover:bg-[#FDECEA] shrink-0"
                        title="删除项目"
                      >
                        删除
                      </button>
                    </div>
                    <p className="text-[12px] text-sub mt-3 leading-relaxed flex-1 line-clamp-3">
                      {p.description}
                    </p>
                    <div className="mt-4 h-1.5 rounded-full bg-track overflow-hidden">
                      <div
                        className="h-full rounded-full bg-navy"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-muted">
                      <span>完成度 {p.progress}</span>
                      <span>
                        {p.owner_name || "—"} · <FormattedDate iso={p.updated_at} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {list.length === 0 && (
              <EmptyState
                title="选中的项目已删除"
                hint="所有项目均已移除，去「分析引擎」运行一次分析即可重新生成。"
              />
            )}
          </>
        )}
      </div>

      {/* 批量删除确认弹框 */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !busy && setShowConfirm(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[17px] font-bold text-ink">确认批量删除</h3>
            <p className="mt-3 text-[13px] text-sub leading-relaxed">
              即将删除 <span className="font-semibold text-[#E74C3C]">{selectedCount}</span> 个项目。
              其下的全部分析报告、版本记录与产物文件将一并删除，且<span className="font-semibold">不可恢复</span>。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowConfirm(false)}
                className="h-9 px-4 rounded-md text-[13px] text-ink bg-[#EEF1F5] hover:bg-[#E2E7EE] disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmBatchDelete}
                className="h-9 px-4 rounded-md text-[13px] font-medium text-white bg-[#E74C3C] hover:bg-[#C62828] disabled:opacity-50"
              >
                {busy ? "删除中…" : `确认删除 ${selectedCount} 项`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
