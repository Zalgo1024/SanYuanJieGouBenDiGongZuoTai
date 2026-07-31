import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("合并多个类名", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("tailwind-merge 去重冲突类（后者优先）", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("忽略假值（false / null / undefined / 空串）", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });
});
