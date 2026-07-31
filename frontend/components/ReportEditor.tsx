"use client";

import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * 报告编辑区 —— Markdown 源码 + 实时预览（分屏）。
 *
 * 设计取舍：直接编辑「真实 Markdown 源码」，预览用与报告查看器同一套渲染器，
 * 保证 DIAGRAM 代码块、表格、公式等内容 100% 保真，不丢不改。
 * 工具栏插入的是标准 Markdown 语法标记（H1/H2/粗体/斜体/列表/引用/代码/分隔线）。
 *
 * 受控组件：value 为当前 Markdown 全文，onChange 回传最新文本，由父页面负责保存版本。
 */
export default function ReportEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (md: string) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  /** 在选中区域两侧包裹 before/after（无选中则插入占位并选中占位）。 */
  function wrap(before: string, after: string, placeholder = "文本") {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    onChange(next);
    // 选中括号内的文本，方便继续输入
    requestAnimationFrame(() => {
      ta.focus();
      const s = start + before.length;
      ta.setSelectionRange(s, s + sel.length);
    });
  }

  /** 在每一选中行（或当前行）行首插入前缀，如 "- " 或 "> "。 */
  function linePrefix(prefix: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const block = value.slice(lineStart, end);
    const prefixed = block
      .split("\n")
      .map((l) => (l.startsWith(prefix) ? l : prefix + l))
      .join("\n");
    const next = value.slice(0, lineStart) + prefixed + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => ta.focus());
  }

  function insertBlock(text: string) {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const needNl = start > 0 && value[start - 1] !== "\n";
    const next = value.slice(0, start) + (needNl ? "\n" : "") + text + value.slice(start);
    onChange(next);
    requestAnimationFrame(() => ta.focus());
  }

  return (
    <div className="flex-1 min-w-0 card flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div className="h-12 flex items-center gap-1 px-3 border-b border-cardborder flex-wrap bg-white">
        <Btn title="一级标题" onClick={() => linePrefix("# ")}>
          H1
        </Btn>
        <Btn title="二级标题" onClick={() => linePrefix("## ")}>
          H2
        </Btn>
        <Btn title="加粗" accent onClick={() => wrap("**", "**")}>
          B
        </Btn>
        <Btn title="斜体" onClick={() => wrap("*", "*")}>
          I
        </Btn>
        <div className="w-px h-5 bg-cardborder mx-1" />
        <Btn title="无序列表" onClick={() => linePrefix("- ")}>
          • 列表
        </Btn>
        <Btn title="引用" onClick={() => linePrefix("> ")}>
          ❝
        </Btn>
        <Btn title="代码块" onClick={() => wrap("\n```\n", "\n```\n", "代码")}>
          {"</>"}
        </Btn>
        <Btn
          title="分隔线"
          onClick={() => insertBlock("\n---\n")}
        >
          ――
        </Btn>
      </div>

      {/* 编辑 + 预览 分屏 */}
      <div className="flex-1 flex min-h-0">
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="flex-1 min-w-0 resize-none border-0 outline-none p-8 font-mono text-[13px] leading-relaxed text-ink bg-white"
          placeholder="在此编辑报告 Markdown…"
        />
        <div className="w-px bg-cardborder" />
        <div className="flex-1 min-w-0 overflow-y-auto p-8 bg-[#FBFCFE]">
          <div className="md-body max-w-[640px] mx-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value || "*（空白）*"}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

function Btn({
  onClick,
  children,
  title,
  accent,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`min-w-9 h-8 px-2 rounded-md text-[13px] font-medium ${
        accent ? "text-navy" : "text-sub"
      } hover:bg-[#F3F4F6]`}
    >
      {children}
    </button>
  );
}
