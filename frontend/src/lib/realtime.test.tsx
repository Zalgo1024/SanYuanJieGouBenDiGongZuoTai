import { act, render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTaskProgress } from "./realtime";

const storeMocks = vi.hoisted(() => ({
  updateTaskProgress: vi.fn(),
  loadReport: vi.fn(async () => null),
}));

vi.mock("./store", () => ({
  useAppStore: () => storeMocks,
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
  close = vi.fn();
}

function Probe({ enabled = true }: { enabled?: boolean }) {
  useTaskProgress("task-1", enabled);
  return null;
}

describe("useTaskProgress", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    storeMocks.updateTaskProgress.mockReset();
    storeMocks.loadReport.mockReset();
    storeMocks.loadReport.mockResolvedValue(null);
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  it("loads the backend report immediately after a done event", async () => {
    render(<Probe />);
    const socket = MockWebSocket.instances[0];

    await act(async () => {
      socket.onmessage?.({ data: JSON.stringify({ status: "done", phase: "output", progress_pct: 100 }) } as MessageEvent<string>);
    });

    expect(storeMocks.updateTaskProgress).toHaveBeenCalledWith("task-1", {
      status: "done",
      phase: "output",
      progress: 100,
    });
    expect(storeMocks.loadReport).toHaveBeenCalledWith("task-1");
  });

  it("maps backend search subphases into the six-step frontend model", async () => {
    render(<Probe />);
    const socket = MockWebSocket.instances[0];

    await act(async () => {
      socket.onmessage?.({ data: JSON.stringify({ status: "generating", phase: "fetch", progress_pct: 18 }) } as MessageEvent<string>);
    });

    expect(storeMocks.updateTaskProgress).toHaveBeenCalledWith("task-1", {
      status: "generating",
      phase: "search",
      progress: 18,
    });
  });

  it("closes the progress socket after a terminal error without loading a report", async () => {
    render(<Probe />);
    const socket = MockWebSocket.instances[0];

    await act(async () => {
      socket.onmessage?.({ data: JSON.stringify({ status: "error", phase: "output", progress_pct: 85 }) } as MessageEvent<string>);
    });

    expect(socket.close).toHaveBeenCalledOnce();
    expect(storeMocks.loadReport).not.toHaveBeenCalled();
  });

  it("does not open a backend socket when realtime is disabled", () => {
    render(<Probe enabled={false} />);
    expect(MockWebSocket.instances).toHaveLength(0);
  });
});
