// @vitest-environment jsdom
/**
 * Regression: open terminal → leave host mounted out of tree (settings / memory)
 * while terminalOpen stays true → remount host.
 * Before the fix, xterm stayed attached to the detached node and the remounted
 * panel stayed blank (white).
 */
import { act, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTerminalSession } from "./useTerminalSession";

const openMock = vi.fn();
const disposeMock = vi.fn();
const fitMock = vi.fn();
const writeMock = vi.fn();
const resetMock = vi.fn();
const refreshMock = vi.fn();
const focusMock = vi.fn();
const loadAddonMock = vi.fn();
const onDataMock = vi.fn(() => ({ dispose: vi.fn() }));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("../../../services/events", () => ({
  subscribeTerminalOutput: vi.fn(() => () => {}),
}));

vi.mock("../../../services/tauri", () => ({
  openTerminalSession: vi.fn(async () => undefined),
  resizeTerminalSession: vi.fn(async () => undefined),
  writeTerminalSession: vi.fn(async () => undefined),
}));

vi.mock("@xterm/xterm", () => {
  class Terminal {
    cols = 80;
    rows = 24;
    options: Record<string, unknown> = {};
    open = openMock;
    dispose = disposeMock;
    write = writeMock;
    reset = resetMock;
    refresh = refreshMock;
    focus = focusMock;
    loadAddon = loadAddonMock;
    onData = onDataMock;
    hasSelection = () => false;
    getSelection = () => "";
  }
  return { Terminal };
});

vi.mock("@xterm/addon-fit", () => {
  class FitAddon {
    fit = fitMock;
  }
  return { FitAddon };
});

vi.mock("@xterm/addon-search", () => {
  class SearchAddon {
    findNext = vi.fn(() => false);
    findPrevious = vi.fn(() => false);
  }
  return { SearchAddon };
});

vi.mock("@xterm/addon-web-links", () => {
  class WebLinksAddon {}
  return { WebLinksAddon };
});

vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

function Host({
  containerRef,
  mounted,
}: {
  containerRef: (node: HTMLDivElement | null) => void;
  mounted: boolean;
}) {
  if (!mounted) {
    return null;
  }
  return <div data-testid="terminal-host" ref={containerRef} />;
}

describe("useTerminalSession remount after host unmount", () => {
  beforeEach(() => {
    openMock.mockClear();
    disposeMock.mockClear();
    fitMock.mockClear();
    writeMock.mockClear();
    resetMock.mockClear();
    refreshMock.mockClear();
    focusMock.mockClear();
    loadAddonMock.mockClear();
    onDataMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("disposes and reopens xterm when the host node remounts while still visible", async () => {
    const workspace = {
      id: "ws-1",
      name: "ws",
      path: "/tmp/ws",
    } as const;

    const { result } = renderHook(() =>
      useTerminalSession({
        activeWorkspace: workspace as never,
        activeTerminalId: "term-1",
        isVisible: true,
      }),
    );

    const view = render(
      <Host
        containerRef={result.current.containerRef as (node: HTMLDivElement | null) => void}
        mounted
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(openMock).toHaveBeenCalledTimes(1);
    const firstHost = openMock.mock.calls[0]?.[0] as HTMLElement;
    expect(firstHost).toBeTruthy();
    expect(firstHost.isConnected).toBe(true);

    // Simulate settings open: layout unmounts the terminal dock, isVisible stays true.
    view.rerender(
      <Host
        containerRef={result.current.containerRef as (node: HTMLDivElement | null) => void}
        mounted={false}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(disposeMock).toHaveBeenCalledTimes(1);

    // Simulate leave settings: dock remounts under a new host node.
    view.rerender(
      <Host
        containerRef={result.current.containerRef as (node: HTMLDivElement | null) => void}
        mounted
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(openMock).toHaveBeenCalledTimes(2);
    const secondHost = openMock.mock.calls[1]?.[0] as HTMLElement;
    expect(secondHost).toBeTruthy();
    expect(secondHost.isConnected).toBe(true);
    expect(secondHost).not.toBe(firstHost);
  });
});
