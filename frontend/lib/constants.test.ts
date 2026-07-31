import { describe, it, expect } from "vitest";
import { INTEREST, matrixCellStyle } from "@/lib/constants";

describe("matrixCellStyle", () => {
  it("正向 (>=2) 返回绿底深绿字", () => {
    expect(matrixCellStyle(2)).toEqual({ bg: "#E8F5E9", fg: "#2E7D32" });
    expect(matrixCellStyle(5)).toEqual({ bg: "#E8F5E9", fg: "#2E7D32" });
  });

  it("负向 (<=-2) 返回红底深红字", () => {
    expect(matrixCellStyle(-2)).toEqual({ bg: "#FFEBEE", fg: "#C62828" });
    expect(matrixCellStyle(-5)).toEqual({ bg: "#FFEBEE", fg: "#C62828" });
  });

  it("中性 (-1..1) 返回琥珀底橙字", () => {
    expect(matrixCellStyle(-1)).toEqual({ bg: "#FFF2E0", fg: "#E65100" });
    expect(matrixCellStyle(0)).toEqual({ bg: "#FFF2E0", fg: "#E65100" });
    expect(matrixCellStyle(1)).toEqual({ bg: "#FFF2E0", fg: "#E65100" });
  });
});

describe("INTEREST 配色（审查红线：六类利益配色不得随意更改）", () => {
  it("键齐全且为设计稿规定的七色", () => {
    expect(Object.keys(INTEREST)).toEqual([
      "material",
      "safety",
      "political",
      "identity",
      "future",
      "public",
      "subject",
    ]);
    expect(INTEREST.material).toBe("#E74C3C");
    expect(INTEREST.public).toBe("#27AE60");
  });
});
