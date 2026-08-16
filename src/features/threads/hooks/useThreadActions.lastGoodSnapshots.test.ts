import { describe, expect, it } from "vitest";
import type { ThreadSummary } from "../../../types";
import {
  THREAD_ENGINE_SOURCES,
  flattenLastGoodEngineSnapshots,
} from "./useThreadActions.lastGoodSnapshots";

function summary(
  id: string,
  engineSource: ThreadSummary["engineSource"],
  updatedAt: number,
): ThreadSummary {
  return {
    id,
    name: id,
    createdAt: updatedAt,
    updatedAt,
    engineSource,
  } as ThreadSummary;
}

describe("last-good engine snapshots", () => {
  it("keeps PI in the continuity engine set", () => {
    expect(THREAD_ENGINE_SOURCES).toContain("pi");
  });

  it("flattens PI last-good rows instead of dropping them", () => {
    const flattened = flattenLastGoodEngineSnapshots({
      claude: [summary("claude:1", "claude", 10)],
      pi: [summary("pi:1", "pi", 20)],
    });

    expect(flattened.map((entry) => entry.id)).toEqual(["pi:1", "claude:1"]);
  });
});
