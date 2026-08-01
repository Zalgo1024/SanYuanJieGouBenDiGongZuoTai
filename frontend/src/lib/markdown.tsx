import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export interface ReportOutlineItem {
  id: string;
  label: string;
}

const diagramPattern = /^[ \t]{0,3}(`{3,}|~{3,})[ \t]*DIAGRAM[^\r\n]*\r?\n[\s\S]*?^[ \t]{0,3}\1[ \t]*$/gim;

interface MarkdownNode {
  type?: string;
  lang?: string | null;
  children?: MarkdownNode[];
}

function remarkStripDiagram() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (!node.children) return;
      node.children = node.children.filter((child) => !(child.type === "code" && child.lang?.toLowerCase() === "diagram"));
      node.children.forEach(visit);
    };
    visit(tree);
  };
}

export function stripDiagramBlocks(markdown: string): string {
  return markdown.replace(diagramPattern, "").replace(/\n{3,}/g, "\n\n").trim();
}

function plainHeading(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .trim();
}

export function extractReportOutline(markdown: string): ReportOutlineItem[] {
  return stripDiagramBlocks(markdown)
    .split(/\r?\n/)
    .filter((line) => /^##\s+/.test(line))
    .map((line, index) => ({
      id: `report-section-${index + 1}`,
      label: plainHeading(line.replace(/^##\s+/, "")),
    }));
}

export function MarkdownReport({ markdown, hideTitle = false }: { markdown: string; hideTitle?: boolean }) {
  let sectionIndex = 0;
  const components: Components = {
    h1: ({ children }) => hideTitle ? null : <h1 className="report-h1">{children}</h1>,
    h2: ({ children }) => {
      sectionIndex += 1;
      return <h2 id={`report-section-${sectionIndex}`} className="report-h2">{children}</h2>;
    },
    h3: ({ children }) => <h3 className="report-h3">{children}</h3>,
    a: ({ href, children }) => {
      const external = Boolean(href && /^https?:\/\//i.test(href));
      return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{children}</a>;
    },
    table: ({ children }) => <div className="markdown-table-wrap"><table>{children}</table></div>,
  };

  return (
    <article className="markdown-report">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkStripDiagram]} components={components} skipHtml>
        {stripDiagramBlocks(markdown)}
      </ReactMarkdown>
    </article>
  );
}
