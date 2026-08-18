import { describe, expect, it } from "vitest";
import {
  requestOlderHistory,
  setOlderHistoryRequester,
} from "./olderHistoryRequestBridge";

describe("olderHistoryRequestBridge", () => {
  it("returns false when no requester is bound", () => {
    setOlderHistoryRequester(null);
    expect(requestOlderHistory("shared:1")).toBe(false);
  });

  it("forwards to the bound requester", () => {
    const seen: string[] = [];
    setOlderHistoryRequester((threadId) => {
      seen.push(threadId);
      return true;
    });
    expect(requestOlderHistory("shared:2")).toBe(true);
    expect(seen).toEqual(["shared:2"]);
    setOlderHistoryRequester(null);
  });

  it("forwards the All drain option", () => {
    const seen: Array<{ threadId: string; drainAll?: boolean }> = [];
    setOlderHistoryRequester((threadId, options) => {
      seen.push({ threadId, drainAll: options?.drainAll });
      return true;
    });
    expect(requestOlderHistory("shared:3", { drainAll: true })).toBe(true);
    expect(seen).toEqual([{ threadId: "shared:3", drainAll: true }]);
    setOlderHistoryRequester(null);
  });
});
