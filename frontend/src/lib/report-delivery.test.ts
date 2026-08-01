import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadReportArtifact,
  fetchReportVersion,
  fetchReportVersions,
  rollbackReportVersion,
} from "./report-delivery";

describe("report delivery adapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("normalizes the complete version index without inventing metadata", async () => {
    const request = vi.fn(async () => ({
      task_id: "task-1",
      title: "结构报告",
      current_version_id: "version-2",
      versions: [
        {
          id: "version-1",
          version_no: 1,
          kind: "original",
          edited_by: "ai",
          summary: "初始生成",
          note: null,
          editor: null,
          created_at: "2026-08-01T10:00:00",
          is_current: false,
        },
        {
          id: "version-2",
          version_no: 2,
          kind: "revised",
          edited_by: "human",
          summary: "补充证据边界",
          note: "补充证据边界",
          editor: "林知远",
          created_at: "2026-08-02T10:00:00",
          is_current: true,
        },
      ],
    }));

    await expect(fetchReportVersions("task-1", request)).resolves.toEqual({
      taskId: "task-1",
      title: "结构报告",
      currentVersionId: "version-2",
      versions: [
        expect.objectContaining({ id: "version-1", version: 1, kind: "original", isCurrent: false }),
        expect.objectContaining({ id: "version-2", version: 2, kind: "revised", editedBy: "human", editor: "林知远", isCurrent: true }),
      ],
    });
  });

  it("loads a requested historical version with its content", async () => {
    const request = vi.fn(async () => ({
      id: "version-1",
      version_no: 1,
      kind: "original",
      edited_by: "ai",
      summary: "初始生成",
      note: null,
      editor: null,
      created_at: "2026-08-01T10:00:00",
      is_current: false,
      content_markdown: "# 第一版\n\n## 一、结论\n\n原始内容",
      content_html: null,
    }));

    const version = await fetchReportVersion("task-1", "version-1", request);

    expect(request).toHaveBeenCalledWith("/api/reports/task-1/versions/version-1");
    expect(version).toMatchObject({ id: "version-1", version: 1, markdown: expect.stringContaining("原始内容") });
  });

  it("rejects incomplete version metadata instead of inventing history", async () => {
    const request = vi.fn(async () => ({
      task_id: "task-1",
      current_version_id: "version-1",
      versions: [{ id: "version-1", created_at: null }],
    }));

    await expect(fetchReportVersions("task-1", request)).rejects.toThrow("版本元数据不完整");
  });

  it("posts rollback to the selected version", async () => {
    const request = vi.fn(async () => ({ ok: true, current_version_id: "version-1", version_no: 1 }));

    await expect(rollbackReportVersion("version-1", request)).resolves.toMatchObject({ currentVersionId: "version-1", version: 1 });
    expect(request).toHaveBeenCalledWith("/api/versions/version-1/rollback", { method: "POST" });
  });

  it("downloads a binary artifact using the response filename", async () => {
    const click = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({ click } as unknown as HTMLAnchorElement);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:report") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const response = new Response(new Blob(["word"]), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": "attachment; filename*=UTF-8''%E7%BB%93%E6%9E%84%E6%8A%A5%E5%91%8A.docx",
      },
    });
    const fetcher = vi.fn(async () => response);

    await expect(downloadReportArtifact("task-1", "word", "version-2", fetcher)).resolves.toBe("结构报告.docx");
    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8000/api/download/task-1?kind=word&version=version-2");
    expect(click).toHaveBeenCalledOnce();
  });

  it("turns both HTTP errors and 200 JSON error payloads into useful failures", async () => {
    const unavailable = vi.fn(async () => new Response(JSON.stringify({ error: "pdf_unavailable", message: "PDF 暂不可用。可下载 Word 版本。" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    }));
    const missing = vi.fn(async () => new Response(JSON.stringify({ error: "file_missing" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(downloadReportArtifact("task-1", "pdf", "version-2", unavailable)).rejects.toThrow("PDF 暂不可用");
    await expect(downloadReportArtifact("task-1", "word", "version-2", missing)).rejects.toThrow("报告文件不存在");
  });
});
