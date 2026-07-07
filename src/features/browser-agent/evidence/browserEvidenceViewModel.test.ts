import { describe, expect, it } from "vitest";
import { buildBrowserContextAttachment } from "../utils/attachment";
import { buildBrowserEvidenceViewModel } from "./browserEvidenceViewModel";
import type { BrowserContextSnapshot } from "../types";

function makeSnapshot(overrides: Partial<BrowserContextSnapshot> = {}): BrowserContextSnapshot {
  return {
    snapshotId: "snapshot-1",
    browserSessionId: "session-1",
    workspaceId: "workspace-1",
    capturedAt: 1000,
    freshness: "fresh",
    source: {
      url: "https://example.com/page",
      normalizedUrl: "https://example.com/page",
      title: "Example Page",
      origin: "https://example.com",
      tabLabel: "Example Page",
      captureReason: "manual_attach",
      workspaceLocalAllowed: false,
    },
    viewport: {
      width: null,
      height: null,
      scrollX: null,
      scrollY: null,
      scrollHeight: null,
      scrollWidth: null,
      devicePixelRatio: null,
    },
    page: {
      visibleText: "Primary readable body text.",
      pageType: "article",
      primaryContent: null,
      readableBlocks: [],
      noiseDiagnostics: [],
      visualEvidence: [],
      textTruncated: false,
      headings: [],
      landmarks: [],
      elementLandmarks: [],
      contentRegions: [],
      links: [],
      buttons: [],
      forms: [],
      selectedText: null,
      languageHint: null,
    },
    codeCandidates: [],
    diagnostics: {
      console: [],
      network: null,
      captureWarnings: [],
    },
    evidence: {
      screenshotRef: null,
      htmlExcerptRef: "browser-evidence-snapshot-1",
    },
    privacy: {
      redactionApplied: false,
      redactedKinds: [],
      omittedKinds: ["raw_dom", "cookies", "headers", "scripts", "styles", "hidden_nodes"],
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
    availability: "available",
    ...overrides,
  };
}

describe("buildBrowserEvidenceViewModel", () => {
  it("creates sectioned evidence from a browser context attachment", () => {
    const attachment = buildBrowserContextAttachment(makeSnapshot(), {
      now: 1100,
      staleAfterMs: 5000,
    });

    const viewModel = buildBrowserEvidenceViewModel(attachment);

    expect(viewModel.observationState).toBe("available");
    expect(viewModel.overview.items).toContain("Observation: available");
    expect(viewModel.primaryContent.items[0]).toContain("Primary readable body text.");
    expect(viewModel.interactiveElements.items).toContain("Buttons: 0");
    expect(viewModel.privacyBudget.items).toContain("Transport: webview_dom");
  });

  it("exposes user annotations as structured evidence sections", () => {
    const attachment = buildBrowserContextAttachment(makeSnapshot(), {
      now: 1100,
      staleAfterMs: 5000,
    });
    attachment.annotations = [
      {
        annotationId: "annotation-1",
        observationId: attachment.observation.observationId,
        browserSessionId: attachment.browserSessionId,
        workspaceId: attachment.workspaceId,
        createdAt: 1200,
        url: attachment.url,
        title: attachment.title,
        anchor: "region",
        userNote: "这里按钮文案不对",
        viewport: {
          width: 1280,
          height: 720,
          scrollX: 0,
          scrollY: 0,
          devicePixelRatio: 2,
        },
        region: {
          x: 420,
          y: 180,
          width: 160,
          height: 48,
        },
        nearbyText: "Start your first task",
        nearestElement: {
          role: "button",
          label: "Start",
          placeholder: null,
          hrefOrigin: null,
          selectorHint: "button[data-testid=start]",
          sensitive: false,
        },
        privacy: attachment.privacy,
        staleReasons: [],
        diagnostics: [],
      },
    ];

    const viewModel = buildBrowserEvidenceViewModel(attachment);

    expect(viewModel.annotations.items[0]).toContain("这里按钮文案不对");
    expect(viewModel.annotations.items[0]).toContain("nearby=Start your first task");
  });

  it("promotes selector-created element annotations as selected element preview", () => {
    const attachment = buildBrowserContextAttachment(makeSnapshot({
      page: {
        ...makeSnapshot().page,
        visibleText:
          "Large unrelated page summary that should stay out of the primary selected preview.",
      },
    }), {
      now: 1100,
      staleAfterMs: 5000,
    });
    attachment.annotations = [
      {
        annotationId: "selection-1",
        observationId: attachment.observation.observationId,
        browserSessionId: attachment.browserSessionId,
        workspaceId: attachment.workspaceId,
        createdAt: 1200,
        url: attachment.url,
        title: "Codex GPT 模型降智雷达",
        anchor: "element",
        userNote: "刷新数据",
        viewport: {
          width: 1280,
          height: 720,
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
      {
        annotationId: "selection-2",
        observationId: attachment.observation.observationId,
        browserSessionId: attachment.browserSessionId,
        workspaceId: attachment.workspaceId,
        createdAt: 1300,
        url: attachment.url,
        title: "Codex GPT 模型降智雷达",
        anchor: "element",
        userNote: "JSON",
        viewport: {
          width: 1280,
          height: 720,
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
    ];

    const viewModel = buildBrowserEvidenceViewModel(attachment);

    expect(viewModel.selectedElements).toHaveLength(2);
    expect(viewModel.selectedElement).toMatchObject({
      title: "刷新数据",
      elementName: "button",
      role: "button",
      meta: "button · role=button · 78x36",
      boundsLabel: "x=1557 y=537 w=78 h=36",
      sourceTitle: "Codex GPT 模型降智雷达",
    });
    expect(viewModel.selectedElements[1]).toMatchObject({
      title: "JSON",
      elementName: "button",
      role: "button",
      meta: "button · role=button · 86x36",
      boundsLabel: "x=1675 y=537 w=86 h=36",
      sourceTitle: "Codex GPT 模型降智雷达",
    });
    expect(viewModel.selectedElement?.copySafeText).toContain("- selector: button");
    expect(viewModel.selectedElement?.copySafeText).not.toContain("Large unrelated");
  });

  it("keeps degraded diagnostics visible instead of hiding limitations", () => {
    const attachment = buildBrowserContextAttachment(
      makeSnapshot({
        availability: "partial",
        freshness: "degraded",
        diagnostics: {
          console: [],
          network: null,
          captureWarnings: [
            {
              diagnosticId: "capture-warning-1",
              kind: "capture_warning",
              severity: "warning",
              message: "Capture fell back to metadata only.",
              source: "browser-agent",
              redacted: false,
            },
          ],
        },
      }),
      { now: 1100, staleAfterMs: 5000 },
    );

    const viewModel = buildBrowserEvidenceViewModel(attachment);

    expect(viewModel.observationState).toBe("degraded");
    expect(viewModel.staleReasons).toContain("capture_degraded");
    expect(viewModel.diagnostics.items.join("\n")).toContain("Capture fell back to metadata only.");
    expect(viewModel.privacyBudget.items).toContain("Transport: metadata_fallback");
  });
});
