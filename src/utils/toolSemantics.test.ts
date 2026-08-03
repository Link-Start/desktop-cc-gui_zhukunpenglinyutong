import { describe, expect, it } from "vitest";
import {
  buildCommandSummary,
  extractToolName,
  getFirstStringField,
  isBashTool,
  isEditTool,
  isReadTool,
  isSearchTool,
  parseToolArgs,
  resolveToolStatus,
} from "./toolSemantics";

describe("toolSemantics", () => {
  it("parses JSON object arguments and rejects invalid payloads", () => {
    expect(parseToolArgs('{"path":"src/app.tsx"}')).toEqual({
      path: "src/app.tsx",
    });
    expect(parseToolArgs("not json")).toBeNull();
    expect(parseToolArgs("")).toBeNull();
  });

  it("extracts normalized tool names from runtime titles", () => {
    expect(extractToolName("Tool: mcp__ace-tool__search_context")).toBe(
      "search_context",
    );
    expect(extractToolName("Command: exec_command")).toBe("exec_command");
    expect(extractToolName("claude / TodoWrite")).toBe("TodoWrite");
    expect(extractToolName("Tool: mcp__ccgui__AskUserQuestion")).toBe(
      "AskUserQuestion",
    );
    expect(extractToolName("Mcp Ccgui Askuserquestion")).toBe("Askuserquestion");
    expect(extractToolName("Tool: ccgui / AskUserQuestion")).toBe(
      "AskUserQuestion",
    );
  });

  it("resolves command statuses with explicit failure and completion precedence", () => {
    expect(resolveToolStatus("timed_out", true)).toBe("failed");
    expect(resolveToolStatus("success", false)).toBe("completed");
    expect(resolveToolStatus("running", false)).toBe("processing");
    expect(resolveToolStatus(undefined, true)).toBe("completed");
  });

  it("reads the first non-empty string field from a record", () => {
    expect(
      getFirstStringField(
        {
          prompt: "   ",
          description: "  inspect logs  ",
          query: "fallback",
        },
        ["prompt", "description", "query"],
      ),
    ).toBe("inspect logs");
  });

  it("treats shared command tools as bash-like", () => {
    expect(isBashTool("exec_command")).toBe(true);
    expect(isBashTool("write_stdin")).toBe(true);
    expect(isBashTool("run_terminal_command")).toBe(true);
    expect(isBashTool("search")).toBe(false);
  });

  it("classifies Grok-style agent tool names for canvas grouping", () => {
    expect(isReadTool("read_file")).toBe(true);
    expect(isReadTool("list_dir")).toBe(true);
    expect(isSearchTool("grep")).toBe(true);
    expect(isEditTool("search_replace")).toBe(true);
    expect(isEditTool("todo_write")).toBe(false);
  });

  it("builds command summaries from structured arguments while ignoring path-only detail", () => {
    expect(
      buildCommandSummary(
        {
          toolType: "commandExecution",
          detail: JSON.stringify({
            argv: ["npm", "run", "typecheck"],
          }),
        },
        { includeDetail: false },
      ),
    ).toBe("npm run typecheck");

    expect(
      buildCommandSummary({
        title: "Command: git status",
        toolType: "commandExecution",
        detail: "/tmp/worktree",
      }),
    ).toBe("git status");
  });

  it("builds command summaries for bash toolType (Claude-style)", () => {
    expect(
      buildCommandSummary(
        {
          title: "Bash",
          toolType: "bash",
          detail: JSON.stringify({ command: "wc -l $(find src -type f)" }),
        },
        { includeDetail: false },
      ),
    ).toBe("wc -l $(find src -type f)");

    expect(
      buildCommandSummary(
        {
          title: "Bash: find . -name package.json",
          toolType: "bash",
          detail: "",
        },
        { includeDetail: false },
      ),
    ).toBe("find . -name package.json");
  });
});
