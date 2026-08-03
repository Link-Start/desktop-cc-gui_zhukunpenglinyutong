// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../../types";
import { BashToolBlock } from "./BashToolBlock";

const failedCommandItem: Extract<ConversationItem, { kind: "tool" }> = {
  id: "bash-tool-1",
  kind: "tool",
  toolType: "commandExecution",
  title: "Command: npm run test",
  detail: '{"command":"npm run test"}',
  status: "failed",
  output: "Error: test failed",
};

describe("BashToolBlock", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows short terminal-command header without embedding full command", () => {
    render(
      <BashToolBlock
        item={failedCommandItem}
        isExpanded={false}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText("tools.terminalCommand")).toBeTruthy();
    // Full command stays out of the collapsed header line.
    expect(screen.queryByText("npm run test")).toBeNull();
    const errorLine = screen.getByText("Error: test failed");
    expect(errorLine).toBeTruthy();
    expect(errorLine.className).toContain("bash-output-line-error");
  });

  it("shows command and output sections when expanded", () => {
    render(
      <BashToolBlock
        item={failedCommandItem}
        isExpanded
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText("tools.commandLabel")).toBeTruthy();
    expect(screen.getByText("tools.outputLabel")).toBeTruthy();
    expect(screen.getByText("npm run test")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "messages.copy" }).length).toBeGreaterThan(0);
  });

  it("keeps short header when only output is available", () => {
    const outputOnlyItem: Extract<ConversationItem, { kind: "tool" }> = {
      id: "bash-tool-output-only",
      kind: "tool",
      toolType: "bash",
      title: "Bash",
      detail: "",
      status: "completed",
      output: "199\n",
    };
    render(
      <BashToolBlock
        item={outputOnlyItem}
        isExpanded={false}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByText("tools.terminalCommand")).toBeTruthy();
    // Collapsed completed output is hidden until expand (not long-running / not error).
    expect(screen.queryByText("199")).toBeNull();
  });

  it("shows bash toolType command only after expand", () => {
    const bashItem: Extract<ConversationItem, { kind: "tool" }> = {
      id: "bash-tool-json",
      kind: "tool",
      toolType: "bash",
      title: "Bash",
      detail: JSON.stringify({ command: "find src -type f | wc -l" }),
      status: "completed",
      output: "42\n",
    };
    const { rerender } = render(
      <BashToolBlock
        item={bashItem}
        isExpanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("tools.terminalCommand")).toBeTruthy();
    expect(screen.queryByText("find src -type f | wc -l")).toBeNull();

    rerender(
      <BashToolBlock
        item={bashItem}
        isExpanded
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("find src -type f | wc -l")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("keeps markdown-like output as raw text", () => {
    const markdownOutputItem: Extract<ConversationItem, { kind: "tool" }> = {
      ...failedCommandItem,
      id: "bash-tool-md",
      status: "completed",
      output: "## Title\n\n| A | B |\n| --- | --- |\n| 1 | 2 |",
    };
    render(
      <BashToolBlock
        item={markdownOutputItem}
        isExpanded
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("## Title")).toBeTruthy();
    expect(screen.getByText("| A | B |")).toBeTruthy();
  });
});
