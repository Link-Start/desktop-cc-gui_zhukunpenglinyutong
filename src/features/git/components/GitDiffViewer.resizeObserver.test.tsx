/** @vitest-environment jsdom */
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitDiffViewer } from "./GitDiffViewer";

vi.mock("../../../services/tauri", () => ({
  getGitFileFullDiff: vi.fn(async () => "full diff"),
}));

type ResizeEntryLike = { target: Element };
type ResizeCallbackLike = (entries: ResizeEntryLike[], observer: unknown) => void;

/** 可计数的 ResizeObserver fake：只记录实例与观察集合，不主动派发（同步派发会与 virtualizer 的 measure→notify 形成递归）。 */
class ResizeObserverSpy {
  static instances: ResizeObserverSpy[] = [];
  readonly callback: ResizeCallbackLike;
  readonly observed = new Set<Element>();
  disconnected = false;

  constructor(callback: ResizeCallbackLike) {
    this.callback = callback;
    ResizeObserverSpy.instances.push(this);
  }

  observe(element: Element) {
    this.observed.add(element);
  }

  unobserve(element: Element) {
    this.observed.delete(element);
  }

  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }
}

function rowObservers(): ResizeObserverSpy[] {
  return ResizeObserverSpy.instances.filter((instance) =>
    [...instance.observed].some(
      (element) => element instanceof HTMLElement && element.classList.contains("diff-viewer-row"),
    ),
  );
}

function imageDiffs(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    path: `image-${index}.png`,
    status: "M" as const,
    diff: "",
    isImage: true,
    oldImageData: "old",
    newImageData: "new",
    oldImageMime: "image/png",
    newImageMime: "image/png",
  }));
}

beforeEach(() => {
  ResizeObserverSpy.instances = [];
  vi.stubGlobal("ResizeObserver", ResizeObserverSpy);
  // jsdom 无布局：virtual-core 用 offsetWidth/offsetHeight 取容器尺寸，给非零值才会产出可见行。
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("GitDiffViewer 行 ResizeObserver 收敛", () => {
  it("多行可见时行只被单个共享 observer 观察（virtual-core 内置），无每行各建实例", async () => {
    render(
      <GitDiffViewer
        workspaceId="workspace-1"
        diffs={imageDiffs(4)}
        selectedPath={null}
        isLoading={false}
        error={null}
      />,
    );

    let rows: HTMLElement[] = [];
    await waitFor(() => {
      rows = Array.from(document.querySelectorAll<HTMLElement>(".diff-viewer-row"));
      expect(rows.length).toBeGreaterThan(0);
    });

    const observers = rowObservers();
    expect(observers).toHaveLength(1);
    for (const row of rows) {
      expect(observers[0].observed.has(row)).toBe(true);
    }
  });

  it("行数增加时不新增 observer 实例", async () => {
    const { rerender } = render(
      <GitDiffViewer
        workspaceId="workspace-1"
        diffs={imageDiffs(2)}
        selectedPath={null}
        isLoading={false}
        error={null}
      />,
    );
    await waitFor(() => {
      expect(document.querySelectorAll(".diff-viewer-row").length).toBeGreaterThan(0);
    });
    expect(rowObservers()).toHaveLength(1);

    rerender(
      <GitDiffViewer
        workspaceId="workspace-1"
        diffs={imageDiffs(6)}
        selectedPath={null}
        isLoading={false}
        error={null}
      />,
    );
    await waitFor(() => {
      expect(document.querySelectorAll(".diff-viewer-row").length).toBeGreaterThan(1);
    });
    expect(rowObservers()).toHaveLength(1);
  });

  it("卸载时共享 observer disconnect", async () => {
    const { unmount } = render(
      <GitDiffViewer
        workspaceId="workspace-1"
        diffs={imageDiffs(3)}
        selectedPath={null}
        isLoading={false}
        error={null}
      />,
    );
    await waitFor(() => {
      expect(document.querySelectorAll(".diff-viewer-row").length).toBeGreaterThan(0);
    });
    const [observer] = rowObservers();
    expect(observer).toBeDefined();
    expect(observer.disconnected).toBe(false);

    unmount();
    expect(observer.disconnected).toBe(true);
  });
});
