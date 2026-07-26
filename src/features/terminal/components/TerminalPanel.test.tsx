// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TerminalPanel } from "./TerminalPanel";
import { isSafeTerminalWebUrl } from "../hooks/useTerminalSession";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function renderPanel(
  getSelection: () => string,
  onInsertText = vi.fn(),
  findNext = vi.fn(() => true),
  findPrevious = vi.fn(() => true),
) {
  render(
    <TerminalPanel
      containerRef={createRef<HTMLDivElement>()}
      status="ready"
      message=""
      getSelection={getSelection}
      findNext={findNext}
      findPrevious={findPrevious}
      onInsertText={onInsertText}
    />,
  );
  return onInsertText;
}

function rightClickTerminal() {
  const surface = document.querySelector(".terminal-surface");
  expect(surface).not.toBeNull();
  fireEvent.contextMenu(surface as Element, { clientX: 40, clientY: 40 });
}

afterEach(() => {
  cleanup();
});

describe("TerminalPanel", () => {
  it("sends the xterm selection to the composer from the context menu", () => {
    const onInsertText = renderPanel(() => "desktop-cc-gui");

    rightClickTerminal();
    fireEvent.click(screen.getByText("terminal.sendSelectionToComposer"));

    expect(onInsertText).toHaveBeenCalledTimes(1);
    expect(onInsertText).toHaveBeenCalledWith("desktop-cc-gui");
  });

  it("sends the exact selection on every invocation without accumulating", () => {
    const onInsertText = renderPanel(() => "desktop-cc-gui");

    for (let i = 0; i < 3; i++) {
      rightClickTerminal();
      fireEvent.click(screen.getByText("terminal.sendSelectionToComposer"));
    }

    expect(onInsertText.mock.calls).toEqual([
      ["desktop-cc-gui"],
      ["desktop-cc-gui"],
      ["desktop-cc-gui"],
    ]);
  });

  it("does not open the menu when the terminal has no selection", () => {
    renderPanel(() => "");

    rightClickTerminal();

    expect(screen.queryByText("terminal.sendSelectionToComposer")).toBeNull();
  });

  it("does not cache a previous selection once it is cleared", () => {
    let selection = "desktop-cc-gui";
    renderPanel(() => selection);

    rightClickTerminal();
    // 关闭菜单但不发送。
    fireEvent.keyDown(window, { key: "Escape" });
    selection = "";

    rightClickTerminal();

    expect(screen.queryByText("terminal.sendSelectionToComposer")).toBeNull();
  });

  it("opens search with the platform shortcut and navigates matches", () => {
    const findNext = vi.fn(() => true);
    const findPrevious = vi.fn(() => true);
    renderPanel(() => "", vi.fn(), findNext, findPrevious);

    fireEvent.keyDown(document.querySelector(".terminal-shell") as Element, {
      key: "f",
      metaKey: true,
    });
    const input = screen.getByRole("textbox", { name: "terminal.searchInput" });
    fireEvent.change(input, { target: { value: "panic" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(findNext).toHaveBeenCalledWith("panic");
    expect(findPrevious).toHaveBeenCalledWith("panic");
  });

  it("closes search with Escape without changing Composer handoff", () => {
    renderPanel(() => "selected");
    const shell = document.querySelector(".terminal-shell") as Element;

    fireEvent.keyDown(shell, { key: "f", ctrlKey: true });
    expect(screen.getByRole("search")).toBeTruthy();
    fireEvent.keyDown(shell, { key: "Escape" });

    expect(screen.queryByRole("search")).toBeNull();
  });

  it("accepts only HTTP web link schemes", () => {
    expect(isSafeTerminalWebUrl("https://example.com/path")).toBe(true);
    expect(isSafeTerminalWebUrl("http://localhost:3000")).toBe(true);
    expect(isSafeTerminalWebUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeTerminalWebUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeTerminalWebUrl("not a url")).toBe(false);
  });
});
