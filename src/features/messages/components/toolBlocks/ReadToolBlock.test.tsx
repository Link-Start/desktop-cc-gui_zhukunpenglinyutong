// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import { ReadToolBlock } from "./ReadToolBlock";

function createReadItem(
  id: string,
  detail: Record<string, unknown>,
  output?: string,
): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType: "read",
    title: "Tool: read",
    detail: JSON.stringify(detail),
    output,
    status: "completed",
  };
}

describe("ReadToolBlock", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders markdown output for markdown file reads", () => {
    const item = createReadItem(
      "tool-read-markdown",
      { file_path: "README.md" },
      "## Section\n\n- item one\n- item two",
    );

    const view = render(<ReadToolBlock item={item} isExpanded={false} onToggle={() => {}} />);

    fireEvent.click(screen.getByText("tools.readFile"));

    expect(view.container.querySelector(".read-tool-markdown")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Section" })).toBeTruthy();
    expect(screen.getByText("item one")).toBeTruthy();
  });

  it("falls back to plain text rendering for non-markdown files", () => {
    const item = createReadItem(
      "tool-read-code",
      { file_path: "src/main.ts" },
      "const value = 1;\nconsole.log(value);",
    );

    const view = render(<ReadToolBlock item={item} isExpanded={false} onToggle={() => {}} />);

    fireEvent.click(screen.getByText("tools.readFile"));

    expect(view.container.querySelector(".read-tool-markdown")).toBeNull();
    expect(screen.getByText(/const value = 1;/)).toBeTruthy();
    expect(screen.getByText(/console\.log\(value\);/)).toBeTruthy();
  });

  it("shows a file-type icon for the read path", () => {
    const item = createReadItem("tool-read-icon", { file_path: "src/main.ts" }, "ok");
    const view = render(<ReadToolBlock item={item} isExpanded={false} onToggle={() => {}} />);
    expect(view.container.querySelector(".tool-marker-file-type-icon")).toBeTruthy();
    expect(screen.getByText("main.ts")).toBeTruthy();
  });

  it("shows monochrome action icon + kind label aligned with batch-read / search rows", () => {
    const item = createReadItem("tool-read-kind", { file_path: "src/main.ts" }, "ok");
    const view = render(<ReadToolBlock item={item} isExpanded={false} onToggle={() => {}} />);
    expect(screen.getByText(/tools\.kindRead|Read|读取/)).toBeTruthy();
    expect(view.container.querySelector(".explore-inline-kind")).toBeTruthy();
    // 行首单色动作 icon（FileText）+ 文件名旁彩色类型 icon 并存
    expect(view.container.querySelector('[data-slot="marker"] svg')).toBeTruthy();
    expect(view.container.querySelector(".tool-marker-file-type-icon")).toBeTruthy();
  });
});
