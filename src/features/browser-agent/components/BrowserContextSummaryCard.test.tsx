// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserContextSummaryCard } from "./BrowserContextSummaryCard";

describe("BrowserContextSummaryCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows primary content, readable blocks, and visual evidence in expanded details", () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => undefined),
      },
    });

    render(
      <BrowserContextSummaryCard
        attachment={{
          title: "文件改动对比显示不正确 · Issue #642",
          url: "https://github.com/example/repo/issues/642",
          capturedAt: 100,
          stale: false,
          summary: "Issue #642 summary",
          pageType: "issue",
          primaryContent: "Issue body says deleted files should use strikethrough and new files are missing.",
          visibleTextExcerpt: "Issue body says deleted files should use strikethrough.",
          readableBlocks: [
            {
              blockId: "issue-body",
              role: "issue_body",
              text: "图一属于删除文件，是否可参考其他 IDE 的显示划线方式。图二其实是有新增文件，应用没有显示出来。",
              score: 960,
              truncated: false,
            },
          ],
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
          privacy: {
            redactionApplied: false,
            redactedKinds: [],
            omittedKinds: ["raw_dom", "cookies", "headers"],
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
        }}
      />,
    );

    fireEvent.click(screen.getByText("messages.browserContextShowDetails"));

    expect(screen.getByText(/Primary content|messages\.browserContextPrimaryContent/)).toBeTruthy();
    expect(
      screen.getByText(
        "Issue body says deleted files should use strikethrough and new files are missing.",
      ),
    ).toBeTruthy();
    expect(screen.getByText(/图一属于删除文件/)).toBeTruthy();
    expect(screen.getByText(/issue screenshot/)).toBeTruthy();
    expect(screen.getByText(/diff display screenshot/)).toBeTruthy();
  });

  it("shows selected element evidence before full-page browser summary", () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => undefined),
      },
    });

    render(
      <BrowserContextSummaryCard
        attachment={{
          title: "Codex GPT 模型降智雷达",
          url: "https://ai.17nas.com/tools/codex-iq/",
          capturedAt: 100,
          stale: false,
          summary: "LATEST DETECTION · 2026-07-07 下午 135 IQ 正常",
          primaryContent: "LATEST DETECTION · 2026-07-07 下午 135 IQ 正常",
          visibleTextExcerpt: "LATEST DETECTION · 2026-07-07 下午 135 IQ 正常",
          annotations: [
            {
              annotationId: "selection-1",
              observationId: "browser-observation-1",
              browserSessionId: "browser-session-1",
              workspaceId: "workspace-1",
              createdAt: 120,
              url: "https://ai.17nas.com/tools/codex-iq/",
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
              privacy: {
                redactionApplied: false,
                redactedKinds: [],
                omittedKinds: ["raw_dom"],
              },
              staleReasons: [],
              diagnostics: [],
            },
          ],
          elementCounts: {
            headings: 5,
            links: 6,
            buttons: 1,
            forms: 0,
            landmarks: 0,
            codeCandidates: 0,
            annotations: 1,
          },
        }}
      />,
    );

    expect(screen.getByText("Selected page element")).toBeTruthy();
    expect(screen.getByText("刷新数据")).toBeTruthy();
    expect(screen.getByText("button · role=button · 78x36")).toBeTruthy();
    expect(screen.getByText("x=1557 y=537 w=78 h=36")).toBeTruthy();
    expect(screen.getByText("Selector button")).toBeTruthy();
    expect(screen.queryByText(/LATEST DETECTION/)).toBeNull();
    expect(screen.queryByText("Headings 5")).toBeNull();

    fireEvent.click(screen.getByText("messages.browserContextShowDetails"));

    expect(screen.getByText(/Selected browser element/)).toBeTruthy();
    expect(screen.getAllByText(/LATEST DETECTION/).length).toBeGreaterThan(0);
  });

  it("renders multiple selected element evidence items in selection order", () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => undefined),
      },
    });

    render(
      <BrowserContextSummaryCard
        attachment={{
          title: "Codex GPT 模型降智雷达",
          url: "https://ai.17nas.com/tools/codex-iq/",
          capturedAt: 100,
          stale: false,
          summary: "LATEST DETECTION · hidden full page summary",
          visibleTextExcerpt: "LATEST DETECTION · hidden full page summary",
          annotations: [
            {
              annotationId: "selection-1",
              observationId: "browser-observation-1",
              browserSessionId: "browser-session-1",
              workspaceId: "workspace-1",
              createdAt: 120,
              url: "https://ai.17nas.com/tools/codex-iq/",
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
              privacy: {
                redactionApplied: false,
                redactedKinds: [],
                omittedKinds: ["raw_dom"],
              },
              staleReasons: [],
              diagnostics: [],
            },
            {
              annotationId: "selection-2",
              observationId: "browser-observation-1",
              browserSessionId: "browser-session-1",
              workspaceId: "workspace-1",
              createdAt: 130,
              url: "https://ai.17nas.com/tools/codex-iq/",
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
              privacy: {
                redactionApplied: false,
                redactedKinds: [],
                omittedKinds: ["raw_dom"],
              },
              staleReasons: [],
              diagnostics: [],
            },
          ],
          elementCounts: {
            headings: 5,
            links: 6,
            buttons: 2,
            forms: 0,
            landmarks: 0,
            codeCandidates: 0,
            annotations: 2,
          },
        }}
      />,
    );

    expect(screen.getByText("2 selected page elements")).toBeTruthy();
    expect(screen.getByText(/1\. 刷新数据 · button · role=button · 78x36/)).toBeTruthy();
    expect(screen.getByText(/2\. JSON · button · role=button · 86x36/)).toBeTruthy();
    expect(screen.queryByText(/LATEST DETECTION/)).toBeNull();

    fireEvent.click(screen.getByText("messages.browserContextShowDetails"));

    expect(screen.getAllByText(/Selected browser element/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/selector: button/).length).toBeGreaterThan(0);
    expect(screen.getByText(/selector: button\.json/)).toBeTruthy();
  });

  it("uses the explicit expired observation state when rendering the summary badge", () => {
    render(
      <BrowserContextSummaryCard
        attachment={{
          title: "Example Domain",
          url: "https://example.com/",
          capturedAt: 100,
          stale: true,
          summary: "Example summary",
          observation: {
            schemaVersion: 1,
            observationId: "browser-observation-expired",
            browserSessionId: "browser-session-1",
            workspaceId: "workspace-1",
            capturedAt: 100,
            state: "expired",
            staleReasons: ["ttl_expired"],
            transport: "webview_dom",
            rendererBinding: "matched",
            source: {
              url: "https://example.com/",
              normalizedUrl: "https://example.com/",
              origin: "https://example.com",
              title: "Example Domain",
              tabLabel: "Example",
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
              omittedKinds: ["raw_dom"],
            },
            diagnostics: [],
            omittedCapabilities: [],
          },
        }}
      />,
    );

    const stateBadge = screen.getByText("expired");

    expect(stateBadge.classList.contains("is-expired")).toBe(true);
    expect(
      stateBadge.closest(".browser-context-summary-card")?.classList.contains("is-expired"),
    ).toBe(true);
  });
});
