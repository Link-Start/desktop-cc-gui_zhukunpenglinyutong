import { describe, expect, it } from "vitest";
import { resolveActiveMessageAnchor } from "./messagesViewModel";

function mockRectNode(top: number): HTMLDivElement {
  return {
    getBoundingClientRect: () => ({ top }),
  } as HTMLDivElement;
}

describe("resolveActiveMessageAnchor", () => {
  it("uses scroller-relative client rects instead of offsetTop", () => {
    const container = {
      clientHeight: 720,
      getBoundingClientRect: () => ({ top: 80 }),
    } as HTMLDivElement;
    const messageNodeById = new Map<string, HTMLDivElement>([
      ["user-old", mockRectNode(80 + 1_760 - 400)],
      ["user-visible", mockRectNode(80 + 96)],
    ]);

    expect(resolveActiveMessageAnchor(container, messageNodeById)).toBe(
      "user-visible",
    );
  });

  it("returns null when the scroller is missing", () => {
    expect(resolveActiveMessageAnchor(null, new Map())).toBeNull();
  });
});
