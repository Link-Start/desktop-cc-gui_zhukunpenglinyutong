// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserContextPreview } from "./BrowserContextPreview";
import type { BrowserContextAttachment } from "../types";

function makeAttachment(): BrowserContextAttachment {
  return {
    kind: "browser_snapshot",
    attachmentId: "browser-attachment-1",
    browserSessionId: "browser-session-1",
    snapshotId: "browser-snapshot-1",
    workspaceId: "workspace-1",
    title: "文件改动对比显示不正确 · Issue #642",
    url: "https://github.com/example/repo/issues/642",
    capturedAt: 100,
    stale: false,
    freshness: "fresh",
    observation: {
      schemaVersion: 1,
      observationId: "browser-observation-1",
      browserSessionId: "browser-session-1",
      workspaceId: "workspace-1",
      capturedAt: 100,
      state: "available",
      staleReasons: [],
      transport: "webview_dom",
      rendererBinding: "matched",
      source: {
        url: "https://github.com/example/repo/issues/642",
        normalizedUrl: "https://github.com/example/repo/issues/642",
        origin: "https://github.com",
        title: "文件改动对比显示不正确 · Issue #642",
        tabLabel: "Issue #642",
        workspaceLocalAllowed: false,
      },
      budget: {
        charLimit: 12_000,
        visibleTextLimit: 8_000,
        elementLimit: 120,
        formFieldLimit: 80,
        diagnosticLimit: 50,
        tokenEstimate: null,
        truncated: false,
        omittedElementCount: 0,
      },
      privacy: {
        redactionApplied: false,
        redactedKinds: [],
        omittedKinds: ["raw_dom", "cookies", "headers"],
      },
      diagnostics: [],
      omittedCapabilities: [],
    },
    summary: "Issue #642 summary",
    visibleTextExcerpt: "Issue body says deleted files should use strikethrough.",
    pageType: "issue",
    primaryContent:
      "Issue body says deleted files should use strikethrough and new files are missing from the diff view.",
    readableBlocks: [
      {
        blockId: "issue-body",
        role: "issue_body",
        text: "图一属于删除文件，是否可参考其他 IDE 的显示划线方式。图二其实是有新增文件，应用没有显示出来。",
        score: 960,
        truncated: false,
      },
    ],
    noiseDiagnostics: [],
    visualEvidence: [
      {
        evidenceId: "issue-image-1",
        kind: "image",
        label: "issue screenshot",
        altText: "diff display screenshot",
        srcOrigin: "https://github.com",
        nearbyText: "图一：删除文件截图。图二：新增文件截图。",
        visible: true,
        sensitive: false,
      },
    ],
    elementCounts: {
      headings: 15,
      links: 27,
      buttons: 7,
      forms: 0,
      landmarks: 1,
      codeCandidates: 0,
      readableBlocks: 1,
      visualEvidence: 1,
    },
    diagnostics: [],
    budget: {
      charLimit: 12_000,
      visibleTextLimit: 8_000,
      elementLimit: 120,
      formFieldLimit: 80,
      diagnosticLimit: 50,
      tokenEstimate: null,
      truncated: false,
      omittedElementCount: 0,
    },
    codeCandidates: [],
    privacy: {
      redactionApplied: false,
      redactedKinds: [],
      omittedKinds: ["raw_dom", "cookies", "headers"],
    },
  };
}

function withSelectedButton(attachment: BrowserContextAttachment): BrowserContextAttachment {
  return {
    ...attachment,
    visibleTextExcerpt:
      "LATEST DETECTION · 2026-07-07 下午 135 IQ 正常 当前表现接近健康区间。",
    primaryContent:
      "LATEST DETECTION · 2026-07-07 下午 135 IQ 正常 当前表现接近健康区间。",
    annotations: [
      {
        annotationId: "selection-1",
        observationId: attachment.observation.observationId,
        browserSessionId: attachment.browserSessionId,
        workspaceId: attachment.workspaceId,
        createdAt: 120,
        url: attachment.url,
        title: "Codex GPT 模型降智雷达",
        anchor: "element",
        userNote: "刷新数据",
        viewport: {
          width: 2048,
          height: 920,
          scrollX: 0,
          scrollY: 0,
          devicePixelRatio: 2,
        },
        region: {
          x: 1557,
          y: 537,
          width: 78,
          height: 36,
        },
        nearbyText: "刷新数据",
        nearestElement: {
          role: "button",
          label: "刷新数据",
          placeholder: null,
          hrefOrigin: null,
          selectorHint: "button",
          sensitive: false,
        },
        privacy: attachment.privacy,
        staleReasons: [],
        diagnostics: [],
      },
    ],
    elementCounts: {
      ...attachment.elementCounts,
      annotations: 1,
    },
  };
}

function withSelectedButtonAndLink(attachment: BrowserContextAttachment): BrowserContextAttachment {
  const selectedButton = withSelectedButton(attachment);
  return {
    ...selectedButton,
    annotations: [
      ...(selectedButton.annotations ?? []),
      {
        annotationId: "selection-2",
        observationId: attachment.observation.observationId,
        browserSessionId: attachment.browserSessionId,
        workspaceId: attachment.workspaceId,
        createdAt: 130,
        url: attachment.url,
        title: "Codex GPT 模型降智雷达",
        anchor: "element",
        userNote: "JSON",
        viewport: {
          width: 2048,
          height: 920,
          scrollX: 0,
          scrollY: 0,
          devicePixelRatio: 2,
        },
        region: {
          x: 1675,
          y: 537,
          width: 86,
          height: 36,
        },
        nearbyText: "JSON",
        nearestElement: {
          role: "button",
          label: "JSON",
          placeholder: null,
          hrefOrigin: null,
          selectorHint: "button.json",
          sensitive: false,
        },
        privacy: attachment.privacy,
        staleReasons: [],
        diagnostics: [],
      },
    ],
    elementCounts: {
      ...selectedButton.elementCounts,
      annotations: 2,
    },
  };
}

describe("BrowserContextPreview", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows evidence details in the composer preview card", () => {
    render(
      <BrowserContextPreview
        attachment={makeAttachment()}
        busy={false}
        onRefresh={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("Visual clues 1")).toBeTruthy();
    expect(screen.queryByText(/Issue body says deleted files/)).toBeNull();
    fireEvent.click(screen.getByText("Show capture details"));

    expect(screen.getByText("Primary content")).toBeTruthy();
    expect(screen.getAllByText(/strikethrough/).length).toBeGreaterThan(0);
    expect(screen.getByText(/图一属于删除文件/)).toBeTruthy();
    expect(screen.getByText(/issue screenshot/)).toBeTruthy();
    expect(screen.getByText(/diff display screenshot/)).toBeTruthy();
  });

  it("prioritizes selected element evidence over full-page snapshot text", () => {
    render(
      <BrowserContextPreview
        attachment={withSelectedButton(makeAttachment())}
        busy={false}
        onRefresh={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("Selected page element")).toBeTruthy();
    expect(screen.getByText("刷新数据")).toBeTruthy();
    expect(screen.getByText("button · role=button · 78x36")).toBeTruthy();
    expect(screen.getByText("x=1557 y=537 w=78 h=36")).toBeTruthy();
    expect(screen.getByText("Selector button")).toBeTruthy();
    expect(screen.queryByText(/LATEST DETECTION/)).toBeNull();
    expect(screen.queryByText("Headings 15")).toBeNull();

    fireEvent.click(screen.getByText("Show capture details"));

    expect(screen.getByText(/Selected browser element/)).toBeTruthy();
    expect(screen.getAllByText(/LATEST DETECTION/).length).toBeGreaterThan(0);
  });

  it("shows multiple selected elements without replacing the earlier selection", () => {
    render(
      <BrowserContextPreview
        attachment={withSelectedButtonAndLink(makeAttachment())}
        busy={false}
        onRefresh={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("2 selected page elements")).toBeTruthy();
    expect(screen.getByText(/1\. 刷新数据 · button · role=button · 78x36/)).toBeTruthy();
    expect(screen.getByText(/2\. JSON · button · role=button · 86x36/)).toBeTruthy();
    expect(screen.queryByText(/LATEST DETECTION/)).toBeNull();

    fireEvent.click(screen.getByText("Show capture details"));

    expect(screen.getAllByText(/Selected browser element/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/selector: button/).length).toBeGreaterThan(0);
    expect(screen.getByText(/selector: button\.json/)).toBeTruthy();
  });

  it("marks expired browser snapshots with the high-contrast expired state", () => {
    const attachment = makeAttachment();
    attachment.stale = true;
    attachment.freshness = "expired";
    attachment.observation.state = "expired";
    attachment.observation.staleReasons = ["ttl_expired"];

    render(
      <BrowserContextPreview
        attachment={attachment}
        busy={false}
        onRefresh={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const stateBadge = screen.getByText("expired");

    expect(stateBadge.classList.contains("is-expired")).toBe(true);
    expect(
      stateBadge.closest(".composer-browser-context-card")?.classList.contains("is-expired"),
    ).toBe(true);
  });
});
