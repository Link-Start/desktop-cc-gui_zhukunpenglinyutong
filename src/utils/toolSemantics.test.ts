import { describe, expect, it } from "vitest";
import {
  buildCommandSummary,
  extractToolName,
  getFirstStringField,
  isBashTool,
  isEditTool,
  isProviderToolCallId,
  isReadTool,
  isSearchTool,
  parseToolArgs,
  resolveCanonicalToolName,
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
    expect(
      extractToolName(
        "Call-1e9622240-f623-4709-888e-97510eb8c94f-55|fc Dea0cf7d-ffe2-918e-bd8d-1f467cee29d2 0",
      ),
    ).toBe("");
  });

  it("treats Responses-style Call-|fc identities as pairing keys, not tool names", () => {
    expect(
      isProviderToolCallId(
        "Call-c2a75f93-c1af-43f7-89e9-448522ce0462-62|fc 4bc2904f-60c7-981e-925d-3882eec392d8 0",
      ),
    ).toBe(true);
    expect(
      isProviderToolCallId(
        "call-b8ac0771-4db6-4465-8413-0284cc72eb6b-129|fc_ca617c64-91b1-91c1-8a00-b2be42d5f507_3",
      ),
    ).toBe(true);
    expect(isProviderToolCallId("read")).toBe(false);
    expect(
      resolveCanonicalToolName(
        "Call-1e9622240-f623-4709-888e-97510eb8c94f-55|fc_dea0cf7d-ffe2-918e-bd8d-1f467cee29d2_0",
        "mcpToolCall",
        JSON.stringify({ file_path: "/Users/zhukunpeng/Desktop/appSettings.ts" }),
      ),
    ).toBe("read");
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
