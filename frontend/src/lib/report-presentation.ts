import { stripDiagramBlocks } from "./markdown";

export interface ReportSection {
  id: string;
  heading: string;
  markdown: string;
  lead: string;
}

export interface ReportSourceBlock {
  id: string;
  title: string;
  markdown: string;
}

export interface ReportPresentationModel {
  title: string;
  summary: {
    label: "核心判断" | "阅读起点";
    text: string;
    sectionId: string;
  };
  sections: ReportSection[];
  sourceBlocks: ReportSourceBlock[];
  sourceCount: number;
  hasDiagram: boolean;
}

const headingPattern = /^(#{1,2})\s+(.+)$/;
const sourceMarkerPattern = /^\[(?:联网抓取)?素材\]/;
const sourceHeadingPattern = /(证据与依据|证据链|来源|参考资料|参考文献|附录)/;
const summaryHeadingPattern = /(核心结论|核心判断|结论|汇流|关键发现|核心发现|预判|结语)/;

function cleanHeading(value: string) {
  return value.replace(/[*_`]/g, "").trim();
}

function firstReadableParagraph(markdown: string) {
  return markdown
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/^#+\s+.*$/gm, "").trim())
    .map((paragraph) => paragraph.replace(/^>\s*/gm, "").trim())
    .find((paragraph) => paragraph && !/^[-|: ]+$/.test(paragraph))
    ?.replace(/\n+/g, " ")
    .replace(/[*_`]/g, "")
    .trim() ?? "报告正文待补充。";
}

function countSourceLinks(sourceBlocks: ReportSourceBlock[]) {
  const urls = sourceBlocks.flatMap((block) => block.markdown.match(/https?:\/\/[^\s)>\]]+/gi) ?? []);
  return new Set(urls).size;
}

export function parseReportPresentation(markdown: string, fallbackTitle: string): ReportPresentationModel {
  const hasDiagram = /^(?:`{3,}|~{3,})DIAGRAM\b/im.test(markdown);
  const lines = stripDiagramBlocks(markdown).split(/\r?\n/);
  const sections: ReportSection[] = [];
  const sourceBlocks: ReportSourceBlock[] = [];
  let title = fallbackTitle;
  let currentHeading = "报告正文";
  let currentLines: string[] = [];
  let sourceTitle = "证据与来源";
  let sourceLines: string[] | null = null;

  const flushSection = () => {
    const content = currentLines.join("\n").trim();
    if (!content) return;
    const id = `report-section-${sections.length + 1}`;
    sections.push({ id, heading: currentHeading, markdown: content, lead: firstReadableParagraph(content) });
    currentLines = [];
  };

  const flushSource = () => {
    const content = sourceLines?.join("\n").trim();
    if (!content) return;
    sourceBlocks.push({ id: `report-source-${sourceBlocks.length + 1}`, title: sourceTitle, markdown: content });
    sourceLines = null;
  };

  for (const line of lines) {
    const heading = line.match(headingPattern);
    const headingText = heading ? cleanHeading(heading[2]) : "";
    const isSourceHeading = Boolean(heading && sourceHeadingPattern.test(headingText));
    const isSourceMarker = sourceMarkerPattern.test(line.trim());

    if (heading?.[1].length === 1 && sections.length === 0 && currentLines.length === 0 && !sourceLines) {
      title = headingText || fallbackTitle;
      continue;
    }

    if (isSourceHeading || isSourceMarker) {
      flushSection();
      if (sourceLines && isSourceMarker) {
        sourceLines.push(line);
        continue;
      }
      if (sourceLines) flushSource();
      sourceTitle = isSourceHeading ? headingText : "联网抓取材料";
      sourceLines = [line];
      continue;
    }

    if (heading && sourceLines) {
      flushSource();
      currentHeading = headingText;
      currentLines = [];
      continue;
    }

    if (heading) {
      flushSection();
      currentHeading = headingText;
      continue;
    }

    if (sourceLines) sourceLines.push(line);
    else currentLines.push(line);
  }

  flushSection();
  flushSource();

  const preferredSection = sections.find((section) => summaryHeadingPattern.test(section.heading));
  const summarySection = preferredSection ?? sections[0];
  const summary = {
    label: preferredSection ? "核心判断" as const : "阅读起点" as const,
    text: summarySection?.lead ?? "报告正文待补充。",
    sectionId: summarySection?.id ?? "",
  };

  return {
    title,
    summary,
    sections,
    sourceBlocks,
    sourceCount: countSourceLinks(sourceBlocks),
    hasDiagram,
  };
}
