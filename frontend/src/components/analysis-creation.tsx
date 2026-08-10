"use client";

import { ArrowRight, FileText, Globe2, Paperclip, Send, Sparkles, X } from "lucide-react";
import React, { useRef, useState } from "react";
import { analysisTypes, type AnalysisType, type EngineMode, type MaterialRecord, type NewAnalysisInput, type Project } from "@/lib/domain";

// 与后端 backend/app/routers/materials.py parse_uploaded_file 支持的格式保持一致；
// 图片/PPT 等二进制格式后端无法解析为文本，前端直接拒绝，避免入库乱码素材。
const acceptedFileTypes = ".pdf,.docx,.txt,.md";
const SUPPORTED_EXTENSIONS = ["pdf", "docx", "txt", "md"];

type ComposeMode = "write" | "assist"; // 直接撰写 | AI 辅助

interface AnalysisCreationProps {
  onCreate: (input: NewAnalysisInput) => void | Promise<void>;
  onUpload?: (files: File[]) => Promise<MaterialRecord[]>;
  materials?: MaterialRecord[];
  projects?: Project[];
  defaultEngine?: EngineMode;
  initialType?: AnalysisType;
  initialPrompt?: string;
  reportTitle?: string;
}

export function AnalysisCreation({
  onCreate,
  onUpload,
  initialType = "case",
  initialPrompt = "",
  reportTitle,
}: AnalysisCreationProps) {
  const [mode, setMode] = useState<ComposeMode>("assist"); // 默认：AI 辅助（后端联网搜+拆解，你只填极简输入）
  const [message, setMessage] = useState(initialPrompt);
  const [type, setType] = useState<AnalysisType>(initialType);
  const [useWeb, setUseWeb] = useState(true); // AI 辅助默认联网（平台自动搜素材，无需用户手动喂）
  const [attachments, setAttachments] = useState<MaterialRecord[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    // 双保险：绕过 input accept 拖入的文件也要按扩展名拦截（后端只支持文本类格式）
    const unsupported = selected.find((file) => {
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      return !SUPPORTED_EXTENSIONS.includes(ext);
    });
    if (unsupported) { setError(`"${unsupported.name}" 格式暂不支持，请上传 txt / md / docx / pdf 文件。`); return; }
    const oversized = selected.find((file) => file.size > 50 * 1024 * 1024);
    if (oversized) { setError(`"${oversized.name}"超过 50MB 限制。`); return; }
    if (!onUpload) { setError("材料上传功能暂不可用，请稍后重试。"); return; }
    setBusy(true); setError("");
    try {
      const uploaded = await onUpload(selected);
      setAttachments((current) => [...current, ...uploaded.filter((item) => !current.some((existing) => existing.id === item.id))]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "材料上传失败，请稍后重试。");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function submit() {
    const input = message.trim();
    if (!input) {
      setError(mode === "write" ? "请先粘贴你的分析正文（Markdown，含 ## 章节与 DIAGRAM 代码块）。" : "请先输入你想分析的问题、线索或链接。");
      return;
    }
    setBusy(true); setError("");
    try {
      const title = `${analysisTypes.find((item) => item.id === type)?.label ?? "结构分析"}：${input.slice(0, 42)}`;
      if (mode === "write") {
        // A 方案：确定性渲染，不调 LLM / 不联网，程序只负责排版 + 生成利益关系网络
        await onCreate({
          type,
          title,
          context: input,
          engine: "rule",
          inputMode: "freeform",
          renderOnly: true,
          materialIds: [],
          web: false,
        });
      } else {
        // AI 辅助：联网检索 + 起草（空素材时后端拒绝生成空壳，回提示）
        await onCreate({
          type,
          title,
          context: input,
          engine: "auto",
          inputMode: "freeform",
          materialIds: attachments.map((item) => item.id),
          web: useWeb,
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "创建分析失败，请稍后重试。");
    } finally { setBusy(false); }
  }

  return <section className="conversation-entry" aria-labelledby="analysis-create-title">
    <header className="conversation-entry__heading">
      <span className="eyebrow">新的分析对话</span>
      <h1 id="analysis-create-title">从你的问题开始</h1>
      <p>{reportTitle ? `这段新对话将关联报告「${reportTitle}」。` : "描述事件、粘贴链接，或直接提出你希望验证的判断。"}</p>
    </header>
    <div className="conversation-entry__body">
      <section className="conversation-composer" aria-label="新建分析对话">
        {reportTitle && <div className="conversation-context"><FileText size={15} /><span>关联报告：{reportTitle}</span></div>}
        <textarea aria-label="分析输入" value={message} onChange={(event) => setMessage(event.target.value)} rows={mode === "write" ? 12 : 7} placeholder={mode === "write"
          ? "在此粘贴你的分析正文（Markdown）。用 ## 一、情况概述 / ## 二、... 组织章节；关系图用 ```DIAGRAM {...} ``` 代码块。程序只负责排版与生成利益关系网络，不改写你的内容。"
          : "用一句话描述你想分析的对象或问题，例如：分析恋与深空制作人事件。后端会自动联网检索并拆解成报告。"} />
        {attachments.length > 0 && <div className="conversation-attachments" aria-label="已附加材料">{attachments.map((item) => <span key={item.id}><FileText size={14} />{item.name}<button type="button" onClick={() => setAttachments((current) => current.filter((attachment) => attachment.id !== item.id))} aria-label={`移除 ${item.name}`}><X size={13} /></button></span>)}</div>}
        <div className="conversation-composer__footer">
          <div className="conversation-tools">
            <button className={mode === "write" ? "composer-tool composer-tool--active" : "composer-tool"} type="button" onClick={() => setMode("write")} disabled={busy} title="直接撰写"><FileText size={17} /><span>直接撰写</span></button>
            <button className={mode === "assist" ? "composer-tool composer-tool--active" : "composer-tool"} type="button" onClick={() => setMode("assist")} disabled={busy} title="AI 辅助生成"><Sparkles size={17} /><span>AI 辅助</span></button>
            {mode === "assist" && (
              <>
                <input ref={fileInputRef} className="visually-hidden" type="file" multiple accept={acceptedFileTypes} onChange={(event) => void upload(event.target.files)} />
                <button className="composer-tool" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} title="添加材料"><Paperclip size={17} /><span>添加材料</span></button>
                <button className={useWeb ? "composer-tool composer-tool--active" : "composer-tool"} type="button" onClick={() => setUseWeb((current) => !current)} disabled={busy} title="联网检索"><Globe2 size={17} /><span>联网检索</span></button>
              </>
            )}
            <label className="composer-purpose"><Sparkles size={16} /><span>分析用途</span><select aria-label="分析用途" value={type} onChange={(event) => setType(event.target.value as AnalysisType)}>{analysisTypes.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
          </div>
          <button className="composer-send" type="button" onClick={() => void submit()} disabled={busy}>{busy ? "处理中" : (mode === "write" ? "生成报告" : "开始分析")}<Send size={16} /></button>
        </div>
      </section>
      <aside className="conversation-entry__aside">
        <strong>{mode === "write" ? "直接撰写：粘贴即出报告" : "AI 辅助：输入即出报告"}</strong>
        <p>{mode === "write"
          ? "你写分析正文，程序负责排版并生成利益关系网络（network/org/flow 三态）。不依赖 AI，稳定可复现。"
          : "你只填一句话，后端自动联网检索公开来源、拆解主体与利益、生成完整报告。检索不到素材时会直接提示，不会生成空壳。"}</p>
        <div><Globe2 size={17} /><span>联网检索默认开启：后端自动检索公开来源并写入报告证据基础。</span></div>
      </aside>
    </div>
    {error && <p className="form-error conversation-entry__error" role="alert">{error}</p>}
  </section>;
}
