import { afterEach, describe, expect, it } from "vitest";
import {
  notifyOlderHistoryBeforePrepend,
  setOlderHistoryBeforePrependListener,
} from "./olderHistoryScrollRestoreBridge";

describe("olderHistoryScrollRestoreBridge", () => {
  afterEach(() => {
    setOlderHistoryBeforePrependListener(null);
  });

  it("forwards prependedCount to the presentation listener", () => {
    const seen: Array<{ threadId: string; prependedCount?: number }> = [];
    setOlderHistoryBeforePrependListener((threadId, detail) => {
      seen.push({ threadId, prependedCount: detail?.prependedCount });
    });

    notifyOlderHistoryBeforePrepend("claude:sess", { prependedCount: 80 });

    expect(seen).toEqual([{ threadId: "claude:sess", prependedCount: 80 }]);
  });

  it("ignores empty thread ids", () => {
    const seen: string[] = [];
    setOlderHistoryBeforePrependListener((threadId) => {
      seen.push(threadId);
    });

    notifyOlderHistoryBeforePrepend("");

    expect(seen).toEqual([]);
  });
});
