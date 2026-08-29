import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReportOutline } from "./report-outline";

let intersectionCallback: IntersectionObserverCallback;
const observe = vi.fn();
const disconnect = vi.fn();

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
  observe = observe;
  disconnect = disconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = "";
  thresholds = [];
}

describe("ReportOutline", () => {
  beforeEach(() => {
    observe.mockClear();
    disconnect.mockClear();
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("keeps the current report section exposed to assistive and visual navigation", async () => {
    render(<>
      <ReportOutline sections={[{ id: "section-one", label: "情况概述" }, { id: "section-two", label: "利益主体" }]} />
      <main><section id="section-one" /><section id="section-two" /></main>
    </>);

    expect(screen.getByRole("link", { name: "01 情况概述" })).toHaveAttribute("aria-current", "location");
    await waitFor(() => expect(observe).toHaveBeenCalledTimes(2));

    act(() => intersectionCallback([
      { isIntersecting: true, intersectionRatio: 0.9, target: document.getElementById("section-two") } as unknown as IntersectionObserverEntry,
    ], {} as IntersectionObserver));

    expect(screen.getByRole("link", { name: "02 利益主体" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("link", { name: "01 情况概述" })).not.toHaveAttribute("aria-current");
  });
});
