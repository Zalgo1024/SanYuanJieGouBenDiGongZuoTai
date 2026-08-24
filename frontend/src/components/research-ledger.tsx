"use client";

import { AlertTriangle, ExternalLink, FilePlus2, FileQuestion, ShieldCheck } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import type { ResearchBundle, ResearchClaim, ResearchSnapshotStatus, ResearchSource } from "@/lib/domain";

const claimTypeLabels: Record<ResearchClaim["claimType"], string> = {
  fact: "事实",
  source_view: "来源观点",
  inference: "系统推断",
  user_input: "用户提供",
};

const confidenceLabels = { high: "高置信度", medium: "中置信度", low: "低置信度", unknown: "置信度未知" } as const;
const sourceTypeLabels: Record<string, string> = {
  official: "官方文件", company: "公司公告", mainstream_media: "主流媒体", self_media: "自媒体",
  forum: "论坛", social_media: "社交媒体", user_material: "用户材料", unknown: "来源类型待识别",
};
const qualityTierLabels = { A: "A级来源", B: "B级来源", C: "C级来源", D: "D级来源", unknown: "待评级" } as const;
const gapPriorityLabels = { critical: "最高优先级", high: "高优先级", medium: "中优先级", low: "低优先级" } as const;

function percent(value?: number) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function SourceRow({ source, opposing = false }: { source: ResearchSource; opposing?: boolean }) {
  const tier = source.qualityTier ?? "unknown";
  const content = <><span><strong>{source.title}</strong><small>{sourceTypeLabels[source.sourceType] ?? source.sourceType}{source.publishedAt ? ` · ${source.publishedAt}` : ""}</small><span className={`research-source__tier research-source__tier--${tier.toLowerCase()}`}>{qualityTierLabels[tier]}</span>{source.duplicateOf && <span className="research-source__duplicate">重复转载，不计为独立证据</span>}{source.excerpt && <p>{source.excerpt}</p>}{source.qualityReasons?.map((reason) => <small className="research-source__reason" key={reason}>{reason}</small>)}</span>{source.url && <ExternalLink size={14} />}</>;
  return source.url
    ? <a className={opposing ? "research-source research-source--opposing" : "research-source"} href={source.url} target="_blank" rel="noreferrer" aria-label={`${source.title}，打开来源`}>{content}</a>
    : <div className={opposing ? "research-source research-source--opposing" : "research-source"}>{content}</div>;
}

export function ResearchLedger({ research, status = "unavailable", onEnrich }: { research?: ResearchBundle; status?: ResearchSnapshotStatus; onEnrich?: () => void }) {
  const keyClaims = useMemo(() => research?.claims.filter((claim) => claim.significance === "key").slice(0, 6) ?? [], [research]);
  const [selectedId, setSelectedId] = useState(keyClaims[0]?.id ?? "");

  useEffect(() => setSelectedId(keyClaims[0]?.id ?? ""), [research, keyClaims]);

  if (!research || keyClaims.length === 0) {
    return <section className="research-ledger research-ledger--empty"><FileQuestion size={20} /><div><span className="eyebrow">证据—判断账本</span><h2>这个历史报告还没有逐条证据绑定</h2><p>正文仍可正常阅读；可以在本报告内上传材料或再次联网检索，生成一个可追溯的新版本。</p>{onEnrich && <button className="secondary-button research-enrich-trigger" type="button" onClick={onEnrich}><FilePlus2 size={16} />补充信息与证据</button>}</div></section>;
  }

  const selected = keyClaims.find((claim) => claim.id === selectedId) ?? keyClaims[0];
  const sourceMap = new Map(research.sources.map((source) => [source.id, source]));
  const supporting = selected.evidenceIds.map((id) => sourceMap.get(id)).filter((source): source is ResearchSource => Boolean(source));
  const opposing = selected.counterEvidenceIds.map((id) => sourceMap.get(id)).filter((source): source is ResearchSource => Boolean(source));
  const metrics = research.metrics;
  const reliabilityMetrics = [
    { label: "关键结论证据覆盖", value: percent(metrics.keyClaimEvidenceCoverage), detail: `${metrics.keyClaimCount} 个关键判断` },
    { label: "事实引用率", value: percent(metrics.directFactCitationRate), detail: "事实是否绑定直接来源" },
    { label: "关系证据覆盖", value: percent(metrics.relationEvidenceCoverage), detail: "图谱关系是否可追溯" },
    { label: "来源独立性", value: percent(metrics.sourceIndependenceRate), detail: `${metrics.independentSourceGroupCount} 组独立来源` },
    { label: "时间完整度", value: percent(metrics.temporalCompleteness), detail: "关键事实是否具备时间锚点" },
    { label: "高质量来源", value: String(metrics.highQualitySourceCount ?? 0), detail: "A/B 级来源" },
    { label: "重复来源", value: String(metrics.duplicateSourceCount ?? 0), detail: "转载折叠，不重复计数" },
    { label: "未证实推断", value: String(metrics.unsupportedInferenceCount), detail: `${metrics.conflictCount} 项信息冲突` },
  ];

  return <section className="research-ledger">
    <header><div><span className="eyebrow">研究核验</span><h2>关键判断与证据</h2></div><div className="research-ledger__metrics"><span><strong>{research.metrics.keyClaimCount || keyClaims.length}</strong> 个关键判断</span><span><strong>{research.metrics.conflictCount}</strong> 项冲突</span><span><strong>{research.metrics.gapCount}</strong> 项缺口</span></div></header>
    {status === "stale" && <p className="research-ledger__warning" role="status"><AlertTriangle size={15} />正文已经修改，当前证据绑定继承自上一版本，需重新核验后才能视为最新结论。</p>}
    {status === "fallback" && <p className="research-ledger__warning" role="status"><AlertTriangle size={15} />本次只建立了降级账本；用户输入与报告来源已经保留，但关键判断尚未完成逐条提取。</p>}
    {onEnrich && (status === "fallback" || status === "stale") && <button className="secondary-button research-enrich-trigger" type="button" onClick={onEnrich}><FilePlus2 size={16} />补充信息与证据</button>}
    <section className="research-reliability" aria-label="研究可靠性指标"><div><span className="eyebrow">可解释质量评估</span><h3>资料与分析可靠性</h3><p>各指标分别反映证据条件，不合成为无法解释的总分。</p></div><dl>{reliabilityMetrics.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd><small>{metric.detail}</small></div>)}</dl></section>
    <div className="research-ledger__body">
      <div className="research-claim-list" aria-label="关键判断列表">
        {keyClaims.map((claim) => <button type="button" className={claim.id === selected.id ? "research-claim research-claim--active" : "research-claim"} aria-label={`${claimTypeLabels[claim.claimType]}：${claim.text}`} aria-pressed={claim.id === selected.id} onClick={() => setSelectedId(claim.id)} key={claim.id}><span><i>{claimTypeLabels[claim.claimType]}</i><em className={`research-confidence research-confidence--${claim.confidence}`}>{confidenceLabels[claim.confidence].replace("置信度", "")}</em></span><strong>{claim.text}</strong><small>{claim.evidenceIds.length} 条支持证据{claim.counterEvidenceIds.length ? ` · ${claim.counterEvidenceIds.length} 条反向证据` : ""}</small></button>)}
      </div>
      <article className="research-claim-detail">
        <div className="research-claim-detail__heading"><ShieldCheck size={19} /><div><span className={`research-confidence research-confidence--${selected.confidence}`}>{confidenceLabels[selected.confidence]}</span><h3>判断依据</h3></div></div>
        {selected.confidenceReasons.length > 0 && <div className="research-reasons"><strong>置信度说明</strong>{selected.confidenceReasons.map((reason) => <p key={reason}>{reason}</p>)}</div>}
        <div className="research-sources"><h4>支持证据</h4>{supporting.length ? supporting.map((source) => <SourceRow source={source} key={source.id} />) : <p>当前没有可核验的直接来源，这项判断不能作为已确认事实使用。</p>}</div>
        {opposing.length > 0 && <div className="research-sources"><h4>反向或冲突证据</h4>{opposing.map((source) => <SourceRow source={source} opposing key={source.id} />)}</div>}
      </article>
    </div>
    {research.gaps.length > 0 && <footer className="research-gaps"><div><FileQuestion size={17} /><span><strong>下一轮调查优先补什么</strong><small>按影响程度列出最多 5 项资料缺口</small></span></div>{research.gaps.slice(0, 5).map((gap) => <div className="research-gap" key={gap.id}><div className="research-gap__meta"><i>{gapPriorityLabels[gap.priority ?? "medium"]}</i>{gap.materialType && <span>{gap.materialType}</span>}</div><strong>{gap.question}</strong><span>{gap.reason}</span>{gap.impact.length > 0 && <small>影响判断：{gap.impact.join("、")}</small>}{gap.recommendedMaterials.length > 0 && <small>建议补充：{gap.recommendedMaterials.join("、")}</small>}</div>)}</footer>}
  </section>;
}
