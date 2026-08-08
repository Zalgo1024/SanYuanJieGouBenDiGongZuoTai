import { describe, expect, it } from "vitest";
import { parseReportPresentation } from "./report-presentation";

describe("parseReportPresentation", () => {
  it("extracts a conclusion while keeping scraped material out of the default body", () => {
    const model = parseReportPresentation(
      "# 测试报告\n\n## 核心结论\n\n结论原文。\n\n## 证据与依据\n\n[联网抓取素材]\n\nhttps://example.com/source\n\n抓取原文。",
      "回退标题",
    );

    expect(model.title).toBe("测试报告");
    expect(model.summary.label).toBe("核心判断");
    expect(model.summary.text).toBe("结论原文。");
    expect(model.sections.flatMap((section) => section.markdown)).not.toContain("抓取原文。");
    expect(model.sourceBlocks[0]?.markdown).toContain("抓取原文。");
    expect(model.sourceCount).toBe(1);
  });

  it("uses the first readable body paragraph when no conclusion section exists", () => {
    const model = parseReportPresentation(
      "# 测试报告\n\n## 事件事实\n\n这是第一段事实。\n\n这是第二段事实。",
      "回退标题",
    );

    expect(model.summary.label).toBe("阅读起点");
    expect(model.summary.text).toBe("这是第一段事实。");
    expect(model.sections).toHaveLength(1);
  });

  it("preserves diagram availability without rendering the diagram source in a section", () => {
    const model = parseReportPresentation(
      "# 测试报告\n\n## 正文\n\n正文内容。\n\n```DIAGRAM\n{\"nodes\": []}\n```",
      "回退标题",
    );

    expect(model.hasDiagram).toBe(true);
    expect(model.sections[0]?.markdown).not.toContain("DIAGRAM");
  });
});
