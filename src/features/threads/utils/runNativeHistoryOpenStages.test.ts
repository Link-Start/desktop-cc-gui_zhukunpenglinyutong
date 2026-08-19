import { describe, expect, it, vi } from "vitest";
import {
  runNativeHistoryFetchAndParse,
  runNativeHistoryOpenStages,
} from "./runNativeHistoryOpenStages";
import type { HistoryLoadingProgress } from "./historyLoadingProgress";

function createConversationItem(id: string) {
  return {
    id,
    kind: "message" as const,
    role: "user" as const,
    text: id,
  };
}

describe("runNativeHistoryFetchAndParse", () => {
  it("reports prepare, session, then parse before returning items", async () => {
    const reports: HistoryLoadingProgress[] = [];
    const parsed = [createConversationItem("u1")];

    const result = await runNativeHistoryFetchAndParse({
      report: (progress) => {
        reports.push(progress);
      },
      shouldContinue: () => true,
      load: async () => ({ messages: [{ id: "raw-1" }, { id: "raw-2" }] }),
      extractMessages: (payload) => payload.messages,
      parse: (messages) => {
        expect(messages).toEqual([{ id: "raw-1" }, { id: "raw-2" }]);
        return parsed;
      },
    });

    expect(result?.items).toBe(parsed);
    expect(reports.map((entry) => entry.detailKey)).toEqual([
      "restoringHistoryPrepare",
      "restoringHistorySession",
      "restoringHistoryParse",
    ]);
    expect(reports[2]?.detailParams).toEqual({ count: 2 });
  });

  it("stops before load when the resume generation is stale", async () => {
    const load = vi.fn();
    const result = await runNativeHistoryFetchAndParse({
      report: () => {},
      shouldContinue: () => false,
      load,
      extractMessages: () => [],
      parse: () => [],
    });

    expect(result).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});

describe("runNativeHistoryOpenStages", () => {
  it("hydrates after parse and finishes with finalize", async () => {
    const reports: string[] = [];
    const hydrate = vi.fn(async () => {});
    const items = [createConversationItem("u1")];

    const result = await runNativeHistoryOpenStages({
      report: (progress) => {
        reports.push(progress.detailKey);
      },
      shouldContinue: () => true,
      load: async () => ({ messages: [{ id: "raw-1" }] }),
      extractMessages: (payload) => payload.messages,
      parse: () => items,
      hydrate,
    });

    expect(result?.items).toBe(items);
    expect(hydrate).toHaveBeenCalledWith(items);
    expect(reports).toEqual([
      "restoringHistoryPrepare",
      "restoringHistorySession",
      "restoringHistoryParse",
      "restoringHistoryHydrate",
      "restoringHistoryFinalize",
    ]);
  });
});
