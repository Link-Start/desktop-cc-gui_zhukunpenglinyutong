// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SemanticDiffEntry, TurnSemanticReview } from "../../git/utils/semanticDiffSummary";
import { useTurnSemanticReview } from "./useTurnSemanticReview";

const { requestTurnSemanticReviewMock } = vi.hoisted(() => ({
  requestTurnSemanticReviewMock:
    vi.fn<(options: { workspaceId: string; entries: SemanticDiffEntry[]; language: string }) => Promise<TurnSemanticReview | null>>(),
}));

vi.mock("../utils/turnSemanticReview", () => ({
  requestTurnSemanticReview: requestTurnSemanticReviewMock,
}));

const ENTRIES: SemanticDiffEntry[] = [
  { path: "src/App.tsx", status: "M", diff: "@@ -1 +1 @@\n-old\n+new" },
];

const REVIEW: TurnSemanticReview = {
  source: "ai",
  generatedAt: 1,
  facts: [
    {
      category: "intent",
      text: "Adds a review surface entry.",
      confidence: "high",
      evidenceRefs: [{ type: "file", id: "src/App.tsx", path: "src/App.tsx" }],
    },
  ],
};

function renderReviewHook(options?: {
  enabled?: boolean;
  workspaceId?: string | null;
  turnKey?: string;
}) {
  return renderHook(() =>
    useTurnSemanticReview({
      enabled: options?.enabled ?? true,
      workspaceId: options?.workspaceId === undefined ? "ws-1" : options.workspaceId,
      turnKey: options?.turnKey ?? "turn-1",
      entries: ENTRIES,
      language: "en",
    }),
  );
}

describe("useTurnSemanticReview", () => {
  beforeEach(() => {
    requestTurnSemanticReviewMock.mockReset();
  });

  it("generates a review once when enabled and exposes it", async () => {
    requestTurnSemanticReviewMock.mockResolvedValue(REVIEW);
    const { result, unmount } = renderReviewHook({ turnKey: "turn-generate" });

    expect(result.current.isGenerating).toBe(true);
    await waitFor(() => {
      expect(result.current.review).toEqual(REVIEW);
    });
    expect(result.current.isGenerating).toBe(false);
    expect(requestTurnSemanticReviewMock).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("does not generate while disabled", async () => {
    const { result, unmount } = renderReviewHook({ enabled: false, turnKey: "turn-disabled" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.review).toBeNull();
    expect(result.current.isGenerating).toBe(false);
    expect(requestTurnSemanticReviewMock).not.toHaveBeenCalled();
    unmount();
  });

  it("serves the cached review on remount without calling the engine again", async () => {
    requestTurnSemanticReviewMock.mockResolvedValue(REVIEW);
    const first = renderReviewHook({ turnKey: "turn-cached" });
    await waitFor(() => {
      expect(first.result.current.review).toEqual(REVIEW);
    });
    first.unmount();

    const second = renderReviewHook({ turnKey: "turn-cached" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(second.result.current.review).toEqual(REVIEW);
    expect(second.result.current.isGenerating).toBe(false);
    expect(requestTurnSemanticReviewMock).toHaveBeenCalledTimes(1);
    second.unmount();
  });

  it("degrades silently to null on failure and caches the failure", async () => {
    requestTurnSemanticReviewMock.mockRejectedValue(new Error("engine unavailable"));
    const first = renderReviewHook({ turnKey: "turn-failed" });
    await waitFor(() => {
      expect(first.result.current.isGenerating).toBe(false);
    });
    expect(first.result.current.review).toBeNull();
    first.unmount();

    const second = renderReviewHook({ turnKey: "turn-failed" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(second.result.current.review).toBeNull();
    expect(second.result.current.isGenerating).toBe(false);
    expect(requestTurnSemanticReviewMock).toHaveBeenCalledTimes(1);
    second.unmount();
  });

  it("scopes the cache per workspace and turn key", async () => {
    requestTurnSemanticReviewMock.mockResolvedValue(REVIEW);
    const first = renderReviewHook({ workspaceId: "ws-scope-a", turnKey: "turn-scoped" });
    await waitFor(() => {
      expect(first.result.current.review).toEqual(REVIEW);
    });
    first.unmount();

    const second = renderReviewHook({ workspaceId: "ws-scope-b", turnKey: "turn-scoped" });
    await waitFor(() => {
      expect(second.result.current.review).toEqual(REVIEW);
    });
    expect(requestTurnSemanticReviewMock).toHaveBeenCalledTimes(2);
    second.unmount();
  });
});
