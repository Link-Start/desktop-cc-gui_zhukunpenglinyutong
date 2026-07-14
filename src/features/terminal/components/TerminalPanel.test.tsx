// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTerminalSelection } from "./TerminalPanel";

function mockDomSelection(text: string, node: Node | null): void {
  vi.spyOn(window, "getSelection").mockReturnValue({
    rangeCount: text ? 1 : 0,
    anchorNode: node,
    focusNode: node,
    toString: () => text,
  } as unknown as Selection);
}

describe("resolveTerminalSelection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the native selection when it lives inside the terminal", () => {
    const container = document.createElement("div");
    const inner = document.createTextNode("desktop-cc-gui");
    container.appendChild(inner);
    mockDomSelection("desktop-cc-gui", inner);

    expect(resolveTerminalSelection(container)).toBe("desktop-cc-gui");
  });

  it("trims the native selection text", () => {
    const container = document.createElement("div");
    const inner = document.createTextNode("  hi  ");
    container.appendChild(inner);
    mockDomSelection("  hi  ", inner);

    expect(resolveTerminalSelection(container)).toBe("hi");
  });

  it("returns empty when the native selection is outside the terminal", () => {
    const container = document.createElement("div");
    const outside = document.createTextNode("elsewhere");
    mockDomSelection("elsewhere", outside);

    // 不回退 xterm 内部选区，越界一律视为无选中，避免误抓整屏。
    expect(resolveTerminalSelection(container)).toBe("");
  });

  it("returns empty when there is no native selection", () => {
    const container = document.createElement("div");
    mockDomSelection("", null);

    expect(resolveTerminalSelection(container)).toBe("");
  });
});
