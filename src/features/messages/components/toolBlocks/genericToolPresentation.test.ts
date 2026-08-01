import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import { buildGenericToolPresentation } from "./genericToolPresentation";

type ToolItem = Extract<ConversationItem, { kind: "tool" }>;

describe("buildGenericToolPresentation", () => {
  it("projects generic status, summary, parsed args, variant, and hydration weight", () => {
    const item: ToolItem = {
      id: "tool-bash",
      kind: "tool",
      toolType: "toolCall",
      title: "Tool: Bash",
      detail: JSON.stringify({ command: "npm test" }),
      output: "done",
      status: "completed",
    };

    const presentation = buildGenericToolPresentation(item);

    expect(presentation).toMatchObject({
      toolName: "bash",
      status: "completed",
      markerStatus: "completed",
      summary: "npm test",
      parsedArgs: { command: "npm test" },
      variant: "generic",
      hasChanges: false,
      hydrationWeight: {
        outputChars: 4,
        isHeavyOutput: false,
      },
    });
  });

  it("projects ExitPlan content without UI translation policy", () => {
    const item: ToolItem = {
      id: "tool-exit-plan",
      kind: "tool",
      toolType: "toolCall",
      title: "Tool: ExitPlanMode",
      detail: "PLAN\n# Plan\n\n- ship it\n\nPLANFILEPATH\n/tmp/plan.md",
      status: "completed",
    };

    const presentation = buildGenericToolPresentation(item);

    expect(presentation).toMatchObject({
      variant: "exit-plan",
      exitPlanContent: {
        planMarkdown: "# Plan\n\n- ship it",
        planFilePath: "/tmp/plan.md",
      },
      shouldShowExitPlanRawOutput: false,
    });
  });

  it("projects file-change paths, synthetic diff, and stats", () => {
    const item: ToolItem = {
      id: "tool-file-change",
      kind: "tool",
      toolType: "fileChange",
      title: "File changes",
      detail: JSON.stringify({
        input: {
          file_path: "/repo/src/App.tsx",
          old_string: "const value = 1;",
          new_string: "const value = 2;",
        },
      }),
      status: "completed",
      changes: [{ path: "src/App.tsx", kind: "modified" }],
    };

    const presentation = buildGenericToolPresentation(item);

    expect(presentation.variant).toBe("file-change");
    expect(presentation.displayChanges).toHaveLength(1);
    expect(presentation.displayChanges[0]).toMatchObject({
      path: "src/App.tsx",
      normalizedKind: "modified",
      kindCode: "M",
      diffStats: { additions: 1, deletions: 1 },
    });
    expect(presentation.displayChanges[0]?.diffText).toContain("-const value = 1;");
    expect(presentation.displayChanges[0]?.diffText).toContain("+const value = 2;");
  });

  it("projects normalized image candidate and local fallback path", () => {
    const item: ToolItem = {
      id: "tool-image-view",
      kind: "tool",
      toolType: "imageView",
      title: "View image",
      detail: JSON.stringify({ path: "file://localhost/C:/tmp/preview.png" }),
      status: "completed",
    };

    const presentation = buildGenericToolPresentation(item);

    expect(presentation).toMatchObject({
      variant: "image-view",
      imageCandidate: "C:/tmp/preview.png",
      imageFallbackLocalPath: "C:/tmp/preview.png",
    });
  });
});
