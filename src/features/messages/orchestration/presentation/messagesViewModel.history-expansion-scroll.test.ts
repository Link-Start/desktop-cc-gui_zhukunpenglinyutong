import { describe, expect, it } from "vitest";
import {
  readHistoryExpansionScrollSnapshot,
  restoreHistoryExpansionScrollPosition,
} from "./messagesViewModel";

function createContainer(scrollHeight: number, scrollTop: number) {
  return {
    scrollHeight,
    scrollTop,
  } as HTMLDivElement;
}

describe("history expansion scroll restoration", () => {
  it("restores the reading slice after prepend grows scrollHeight", () => {
    const snapshot = readHistoryExpansionScrollSnapshot(
      createContainer(1000, 200),
    );
    expect(snapshot).toEqual({ scrollHeight: 1000, scrollTop: 200 });

    const container = createContainer(1400, 0);
    expect(restoreHistoryExpansionScrollPosition(container, snapshot!)).toBe(
      true,
    );
    expect(container.scrollTop).toBe(600);
  });

  it("ignores non-finite metrics instead of inventing a jump", () => {
    expect(
      readHistoryExpansionScrollSnapshot(
        createContainer(Number.NaN, 20) as HTMLDivElement,
      ),
    ).toBeNull();
  });
});
