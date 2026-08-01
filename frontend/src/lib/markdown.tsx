import React from "react";

interface Block { type: "h1" | "h2" | "h3" | "p" | "ul"; text: string; }

function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith("### ")) blocks.push({ type: "h3", text: line.slice(4) });
    else if (line.startsWith("## ")) blocks.push({ type: "h2", text: line.slice(3) });
    else if (line.startsWith("# ")) blocks.push({ type: "h1", text: line.slice(2) });
    else if (/^[-*]\s+/.test(line)) {
      const item = line.replace(/^[-*]\s+/, "");
      const last = blocks[blocks.length - 1];
      if (last && last.type === "ul") last.text += `\n${item}`;
      else blocks.push({ type: "ul", text: item });
    } else {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "p") last.text += `\n${line}`;
      else blocks.push({ type: "p", text: line });
    }
  }
  return blocks;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function MarkdownReport({ markdown }: { markdown: string }) {
  const blocks = parseMarkdown(markdown);
  return (
    <article className="markdown-report">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "h1") return <h1 key={key} className="report-h1">{renderInline(block.text)}</h1>;
        if (block.type === "h2") return <h2 key={key} className="report-h2">{renderInline(block.text)}</h2>;
        if (block.type === "h3") return <h3 key={key} className="report-h3">{renderInline(block.text)}</h3>;
        if (block.type === "ul") return <ul key={key}>{block.text.split("\n").map((li, j) => <li key={j}>{renderInline(li)}</li>)}</ul>;
        return <p key={key}>{renderInline(block.text)}</p>;
      })}
    </article>
  );
}
