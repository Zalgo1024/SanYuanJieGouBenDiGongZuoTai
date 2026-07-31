"use client";

import { useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import ReportPicker from "@/components/ReportPicker";
import { useTasks, useDiagram } from "@/lib/hooks";
import { nodeColor, edgeColor, nodeTypeLabel, type DiagramNode, type DiagramEdge } from "@/lib/network";

/**
 * 独立「利益分析」模块 —— 多主体利益分析工作台。
 *
 * 职责边界（与分析引擎 /analysis 完全分离）：
 * - 本模块是基于「已完成报告的 DIAGRAM」做利益结构拆解的只读分析视图，
 *   不负责提交分析任务（那由 /analysis 分析引擎承担）；
 * - 输入 = 选择一份已完成报告；处理 = 解析该报告识别出的主体(actor)与利益节点；
 *   输出 = 主体清单、利益配置、利益流动、多视角、可导出结果；
 * - 与分析引擎共用底层数据（DIAGRAM 解析 / 网络图配色），但界面、入口、交互各自独立，
 *   不存在「点开又跳回分析引擎」的耦合。
 */

const VIEWS = ["物质利益", "安全利益", "政治利益", "身份文化利益", "制度性未来利益", "公共利益"];
const OUTPUTS = ["利益关系网络图", "影响评估矩阵", "博弈终局推演", "报告章节"];

export default function InterestAnalysisPage() {
  const { data: done } = useTasks({ status: "done", limit: 50 });
  const [sel, setSel] = useState<string | null>(null);
  const taskId = sel ?? done?.[0]?.task_id ?? null;
  const { diagram, isLoading } = useDiagram(taskId);

  const labelOf = (id: string) =>
    diagram?.nodes.find((n) => n.id === id)?.label ?? id;

  // 主体 = actor 类型节点；无 actor 时回退为全部节点
  const actors: DiagramNode[] = diagram
    ? diagram.nodes.filter((n) => n.type === "actor").length
      ? diagram.nodes.filter((n) => n.type === "actor")
      : diagram.nodes
    : [];

  // 每个主体关联的利益节点
  const interestsOf = (id: string): DiagramNode[] => {
    if (!diagram) return [];
    const ids = new Set<string>();
    for (const e of diagram.edges) {
      if (e.source === id) ids.add(e.target);
      else if (e.target === id) ids.add(e.source);
    }
    return diagram.nodes.filter((n) => ids.has(n.id) && n.type !== "actor");
  };

  const flows: { from: string; to: string; label?: string; color: string }[] =
    diagram?.edges.map((e: DiagramEdge) => ({
      from: labelOf(e.source),
      to: labelOf(e.target),
      label: e.label,
      color: edgeColor(e.type),
    })) ?? [];

  return (
    <AppShell title="利益分析工作台">
      <div className="max-w-[820px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[20px] font-bold text-ink">多主体利益分析工作台</h1>
            <p className="text-[13px] text-sub mt-1">
              基于真实报告 DIAGRAM 拆解参与主体与利益流动
            </p>
          </div>
          <ReportPicker value={taskId} onChange={setSel} />
        </div>

        {isLoading && (
          <div className="card p-8 text-center text-[13px] text-muted">加载中…</div>
        )}

        {!isLoading && !diagram && (
          <div className="card p-10 text-center">
            <div className="text-[14px] text-ink mb-2">暂无可用报告</div>
            <div className="text-[12px] text-muted mb-4">
              运行分析生成报告后，这里会展示该报告识别出的真实主体与利益流动。
            </div>
            <Link href="/analysis" className="btn-primary h-9 px-4 text-[13px]">
              去分析引擎
            </Link>
          </div>
        )}

        {diagram && (
          <div className="bg-white rounded-card border border-cardborder shadow-card p-6 flex flex-col gap-7">
            <Step n={1} title="输入事件">
              <div className="rounded-input bg-inputbg border border-cardborder px-3 py-2.5 text-[13px] text-ink">
                {diagram.title}
              </div>
            </Step>

            <Step n={2} title="识别主体">
              {actors.length === 0 ? (
                <div className="text-[13px] text-muted">该报告未识别到主体节点</div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {actors.map((e) => {
                    const ints = interestsOf(e.id);
                    return (
                      <div
                        key={e.id}
                        className="border border-cardborder rounded-card p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: nodeColor(e.type) }}
                          />
                          <span className="text-[13px] font-semibold text-ink">
                            {e.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted mb-2">
                          {nodeTypeLabel(e.type)}
                        </div>
                        <div className="text-[11px] text-sub">
                          关联利益：
                          {ints.length ? ints.map((i) => i.label).join("、") : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Step>

            <Step n={3} title="利益配置">
              <div className="flex gap-3 flex-wrap">
                {actors.map((e) => {
                  const ints = interestsOf(e.id);
                  return (
                    <div
                      key={e.id}
                      className="flex-1 min-w-[160px] border border-cardborder rounded-card p-3"
                    >
                      <div className="text-[12px] font-medium text-ink mb-2">
                        {e.label}
                      </div>
                      <div className="text-[11px] text-sub">
                        <span className="text-muted">拥有 ▸ </span>
                        {ints.map((i) => i.label).join("、") || "—"}
                      </div>
                      <div className="text-[11px] text-sub mt-1">
                        <span className="text-muted">追求 ▸ </span>
                        {ints.length ? `${ints.length} 项利益` : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Step>

            <Step n={4} title="利益流动">
              <div className="flex flex-col gap-2">
                {flows.length === 0 && (
                  <div className="text-[13px] text-muted">无利益流动关系</div>
                )}
                {flows.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border border-cardborder rounded-input px-3 py-2"
                  >
                    <span className="text-[12px] font-medium text-ink">{f.from}</span>
                    <span
                      className="h-[2px] flex-1 rounded-full"
                      style={{ background: f.color, opacity: 0.6 }}
                    />
                    <span className="text-[12px] text-sub">{f.label || "关联"}</span>
                    <span className="text-[12px] font-medium text-ink">{f.to}</span>
                  </div>
                ))}
              </div>
            </Step>

            <Step n={5} title="多视角">
              <div className="flex flex-wrap gap-2">
                {VIEWS.map((v) => (
                  <span
                    key={v}
                    className="text-[12px] px-3 py-1 rounded-pill bg-[#F3F4F6] text-sub"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </Step>

            <Step n={6} title="输出">
              <div className="grid grid-cols-4 gap-3">
                {OUTPUTS.map((o) => (
                  <div
                    key={o}
                    className="h-16 rounded-card border border-cardborder flex items-center justify-center text-[12px] text-ink bg-[#FAFBFC]"
                  >
                    {o}
                  </div>
                ))}
              </div>
            </Step>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 shrink-0 rounded-full bg-navy text-white text-[13px] font-semibold flex items-center justify-center">
        {n}
      </div>
      <div className="flex-1">
        <div className="text-[14px] font-semibold text-ink mb-2">{title}</div>
        {children}
      </div>
    </div>
  );
}
