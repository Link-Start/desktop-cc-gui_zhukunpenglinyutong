import { describe, expect, it } from "vitest";
import {
  buildNativeHistoryHydrateProgress,
  buildNativeHistoryParseProgress,
  buildNativeHistoryPrepareProgress,
  buildNativeHistorySessionWaitingProgress,
  isSharedHistoryLoadingProgress,
  mapDshHistoryLoadProgressEvent,
  matchesDshHistoryLoadSession,
  sameHistoryLoadingProgress,
} from "./historyLoadingProgress";

describe("sameHistoryLoadingProgress", () => {
  it("treats identical detailParams as the same write", () => {
    const progress = mapDshHistoryLoadProgressEvent({
      sessionId: "sess-1",
      pageIndex: 3,
      maxPages: 40,
      pageEventCount: 200,
      totalEventCount: 600,
      hasMore: true,
    });
    expect(sameHistoryLoadingProgress(progress, { ...progress })).toBe(true);
  });

  it("updates when only the page detail changes", () => {
    const pageThree = {
      phase: "session" as const,
      percent: 24,
      titleKey: "restoringHistory",
      detailKey: "restoringHistorySessionPage",
      detailParams: { page: 3, maxPages: 40, pageEvents: 200, totalEvents: 600 },
    };
    const pageFour = {
      ...pageThree,
      detailParams: { page: 4, maxPages: 40, pageEvents: 200, totalEvents: 800 },
    };
    expect(sameHistoryLoadingProgress(pageThree, pageFour)).toBe(false);
  });
});

describe("mapDshHistoryLoadProgressEvent", () => {
  it("maps page 0 to the waiting snapshot stage", () => {
    expect(
      mapDshHistoryLoadProgressEvent({
        sessionId: "sess-1",
        pageIndex: 0,
        maxPages: 40,
        pageEventCount: 0,
        totalEventCount: 0,
        hasMore: true,
      }),
    ).toEqual(buildNativeHistorySessionWaitingProgress());
  });

  it("moves percent and page details as host pages arrive", () => {
    const pageThree = mapDshHistoryLoadProgressEvent({
      sessionId: "sess-1",
      pageIndex: 3,
      maxPages: 40,
      pageEventCount: 200,
      totalEventCount: 600,
      hasMore: true,
    });
    const pageFour = mapDshHistoryLoadProgressEvent({
      sessionId: "sess-1",
      pageIndex: 4,
      maxPages: 40,
      pageEventCount: 200,
      totalEventCount: 800,
      hasMore: true,
    });
    expect(pageThree.phase).toBe("session");
    expect(pageThree.detailKey).toBe("restoringHistorySessionPage");
    expect(pageThree.detailParams).toEqual({
      page: 3,
      maxPages: 40,
      pageEvents: 200,
      totalEvents: 600,
    });
    expect(pageFour.percent).toBeGreaterThan(pageThree.percent);
    expect(pageFour.detailParams?.page).toBe(4);
    expect(sameHistoryLoadingProgress(pageThree, pageFour)).toBe(false);
  });

  it("keeps the requested page budget when the open path asked for one page", () => {
    expect(
      mapDshHistoryLoadProgressEvent({
        sessionId: "sess-1",
        pageIndex: 1,
        maxPages: 1,
        pageEventCount: 180,
        totalEventCount: 180,
        hasMore: true,
      }).detailParams,
    ).toEqual({
      page: 1,
      maxPages: 1,
      pageEvents: 180,
      totalEvents: 180,
    });
  });
});

describe("native history progress identity", () => {
  it("is not treated as Shared restore copy", () => {
    expect(isSharedHistoryLoadingProgress(buildNativeHistoryPrepareProgress())).toBe(
      false,
    );
    expect(isSharedHistoryLoadingProgress(buildNativeHistoryParseProgress(12))).toBe(
      false,
    );
    expect(isSharedHistoryLoadingProgress(buildNativeHistoryHydrateProgress("start", 12))).toBe(
      false,
    );
  });

  it("matches host session ids with or without the dsh prefix", () => {
    expect(matchesDshHistoryLoadSession("abc", "dsh:abc", "abc")).toBe(true);
    expect(matchesDshHistoryLoadSession("dsh:abc", "dsh:abc", "abc")).toBe(true);
    expect(matchesDshHistoryLoadSession("other", "dsh:abc", "abc")).toBe(false);
  });
});
