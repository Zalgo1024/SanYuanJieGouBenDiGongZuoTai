export interface ServerReportBlock {
  id?: string;
  block_type: "paragraph" | "heading" | "quote" | "finding";
  content: string;
  position: number;
  evidence_ids?: string[];
  conclusion_ids?: string[];
}

export interface ServerReportSection {
  id?: string;
  title: string;
  position: number;
  blocks: ServerReportBlock[];
}

export interface ServerReport {
  id: string;
  task_id: string;
  title: string;
  status: string;
  revision: number;
  sections: ServerReportSection[];
  updated_at: string;
}

export function serverReportToMarkdown(report: Pick<ServerReport, "title" | "sections">) {
  const sections = [...report.sections]
    .sort((left, right) => left.position - right.position)
    .map((section) => {
      const blocks = [...section.blocks]
        .sort((left, right) => left.position - right.position)
        .map((block) => block.content.trim())
        .filter(Boolean)
        .join("\n\n");
      return `## ${section.title}\n\n${blocks}`.trim();
    })
    .filter(Boolean);
  return [`# ${report.title}`, ...sections].join("\n\n").trim();
}

export function reportTitleFromMarkdown(markdown: string, fallback: string) {
  return markdown.split("\n").find((line) => line.startsWith("# "))?.slice(2).trim() || fallback;
}

export function markdownToReportSections(markdown: string): ServerReportSection[] {
  const body = markdown.replace(/^# .+\n?/, "").trim();
  const rawSections = body.split(/^## /m).filter(Boolean);
  const sections = rawSections.length ? rawSections : [`Analysis\n${body}`];
  return sections.map((rawSection, sectionIndex) => {
    const [titleLine = "Analysis", ...lines] = rawSection.trim().split("\n");
    const paragraphs = lines.join("\n").split(/\n{2,}/).map((content) => content.trim()).filter(Boolean);
    return {
      title: titleLine.trim() || `Section ${sectionIndex + 1}`,
      position: sectionIndex,
      blocks: paragraphs.map((content, blockIndex) => ({
        block_type: "paragraph" as const,
        content,
        position: blockIndex,
        evidence_ids: [],
        conclusion_ids: [],
      })),
    };
  });
}
