import { describe, it, expect } from "vitest";
import { describeErrorPhase } from "@/lib/constants";

describe("describeErrorPhase（阶段七：错误步骤精确定位）", () => {
  it("把 6 步 phase 映射为「第 X 步 + 名称」", () => {
    expect(describeErrorPhase("inspect")).toEqual({
      stepNo: 1,
      label: "检查分析目标",
    });
    expect(describeErrorPhase("search")).toEqual({
      stepNo: 2,
      label: "全网搜索相关信息",
    });
    expect(describeErrorPhase("decompose")).toEqual({
      stepNo: 3,
      label: "对目标进行拆解分析",
    });
    expect(describeErrorPhase("network")).toEqual({
      stepNo: 4,
      label: "利益关系网络拆解",
    });
    expect(describeErrorPhase("organize")).toEqual({
      stepNo: 5,
      label: "整理分析结果",
    });
    expect(describeErrorPhase("output")).toEqual({
      stepNo: 6,
      label: "输出分析结果",
    });
  });

  it("search_skipped 不在 6 步展示表中，回退为笼统失败", () => {
    expect(describeErrorPhase("search_skipped")).toEqual({
      stepNo: null,
      label: null,
    });
  });

  it("空值/未知 phase 回退为 null，由组件显示「分析失败」", () => {
    expect(describeErrorPhase(undefined)).toEqual({ stepNo: null, label: null });
    expect(describeErrorPhase(null)).toEqual({ stepNo: null, label: null });
    expect(describeErrorPhase("")).toEqual({ stepNo: null, label: null });
    expect(describeErrorPhase("nonsense")).toEqual({ stepNo: null, label: null });
  });

  it("命名演进说明：代码统一用 inspect/decompose，而非方案初稿的 target_check/breakdown", () => {
    // 文档化当前约定，避免未来误用方案初稿命名
    expect(describeErrorPhase("target_check")).toEqual({ stepNo: null, label: null });
    expect(describeErrorPhase("breakdown")).toEqual({ stepNo: null, label: null });
  });
});
