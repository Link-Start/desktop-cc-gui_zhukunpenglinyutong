import { describe, expect, it } from "vitest";
import {
  buildMessageRowPresentation,
  resolveMessageImageLocalPath,
} from "./messageRowPresentation";

describe("resolveMessageImageLocalPath", () => {
  it("keeps absolute posix paths for LocalImage fallback", () => {
    expect(
      resolveMessageImageLocalPath(
        "/Users/me/code/内容分析/.mossx/image-staging/attach-1.png",
      ),
    ).toBe("/Users/me/code/内容分析/.mossx/image-staging/attach-1.png");
  });

  it("returns null for data URLs", () => {
    expect(resolveMessageImageLocalPath("data:image/png;base64,AAAA")).toBeNull();
  });

  it("parses file:// URLs into filesystem paths", () => {
    expect(resolveMessageImageLocalPath("file:///tmp/demo.png")).toBe("/tmp/demo.png");
  });
});

describe("buildMessageRowPresentation", () => {
  it("derives assistant presentation from immutable item state", () => {
    const result = buildMessageRowPresentation({
      item: {
        id: "assistant-1",
        kind: "message",
        role: "assistant",
        text: "seed",
      },
      enableCollaborationBadge: false,
      suppressMemorySummaryCard: false,
      suppressNoteCardSummaryCard: false,
    });

    expect(result.displayText).toBe("seed");
    expect(result.messageRowSubtype).toBe("assistant");
  });

  it("derives static image presentation while filtering note-card owned images", () => {
    const result = buildMessageRowPresentation({
      item: {
        id: "assistant-2",
        kind: "message",
        role: "assistant",
        text: "response",
        images: ["/workspace/visible.png"],
      },
      enableCollaborationBadge: false,
      suppressMemorySummaryCard: false,
      suppressNoteCardSummaryCard: false,
    });

    expect(result.imageItems).toHaveLength(1);
    expect(result.imageItems[0]?.label).toBe("Image 1");
    expect(result.imageItems[0]?.localPath).toBe("/workspace/visible.png");
  });

  it("attaches localPath for kimi staging paths so canvas can load non-ascii workspace images", () => {
    const stagingPath =
      "/Users/me/code/内容分析/.mossx/image-staging/attach-59dcb8f6.png";
    const result = buildMessageRowPresentation({
      item: {
        id: "user-kimi-1",
        kind: "message",
        role: "user",
        text: "请看截图",
        images: [stagingPath],
      },
      enableCollaborationBadge: false,
      suppressMemorySummaryCard: false,
      suppressNoteCardSummaryCard: false,
    });

    expect(result.imageItems).toHaveLength(1);
    expect(result.imageItems[0]?.localPath).toBe(stagingPath);
    expect(result.imageItems[0]?.src).toBeTruthy();
  });

  it("keeps DSH Goal injections visible as a card without a user bubble", () => {
    const result = buildMessageRowPresentation({
      item: {
        id: "dsh-goal-1",
        kind: "message",
        role: "user",
        text: "<goal_round>\nContinue the active goal.\n</goal_round>",
        presentationMetadata: {
          displayText: "",
          stickyCandidateText: "",
          contexts: [
            {
              kind: "dsh-goal",
              title: "Context injection",
              sourceLabel: "goal",
              body: "<goal_round>\nContinue the active goal.\n</goal_round>",
            },
          ],
        },
      },
      enableCollaborationBadge: false,
      suppressMemorySummaryCard: false,
      suppressNoteCardSummaryCard: false,
    });

    expect(result.displayText).toBe("");
    expect(result.dshGoalContext).toEqual({
      kind: "dsh-goal",
      title: "Context injection",
      sourceLabel: "goal",
      body: "<goal_round>\nContinue the active goal.\n</goal_round>",
    });
  });

  it("folds Background wakeup notifications and hides their payload from displayText", () => {
    const result = buildMessageRowPresentation({
      item: {
        id: "bg-fold-1",
        kind: "message",
        role: "user",
        text: `<task-notification>
<task-id>b234djc13</task-id>
<status>completed</status>
<summary>Background command "Rebuild Windows bundles with latest code" completed</summary>
</task-notification>`,
      },
      enableCollaborationBadge: false,
      suppressMemorySummaryCard: false,
      suppressNoteCardSummaryCard: false,
    });

    expect(result.foldBackgroundAgentTask).toBe(true);
    expect(result.suppressSubagentAgentTaskCard).toBe(false);
    expect(result.displayText).toBe("");
    expect(result.messageRowSubtype).toBe("agent-task-fold");
  });

  it("does not fold SubAgent notifications or ordinary user questions", () => {
    const subagent = buildMessageRowPresentation({
      item: {
        id: "subagent-1",
        kind: "message",
        role: "user",
        text: `<task-notification>
<summary>Agent "架构治理评估" completed</summary>
<result>ok</result>
</task-notification>`,
      },
      enableCollaborationBadge: false,
      suppressMemorySummaryCard: false,
      suppressNoteCardSummaryCard: false,
    });
    const ordinary = buildMessageRowPresentation({
      item: {
        id: "user-1",
        kind: "message",
        role: "user",
        text: "普通提问：帮我看打包失败",
      },
      enableCollaborationBadge: false,
      suppressMemorySummaryCard: false,
      suppressNoteCardSummaryCard: false,
    });
    const genericCard = buildMessageRowPresentation({
      item: {
        id: "generic-1",
        kind: "message",
        role: "assistant",
        text: `<task-notification>
<summary>Custom runner finished</summary>
<result>runner finished ok</result>
</task-notification>`,
      },
      enableCollaborationBadge: false,
      suppressMemorySummaryCard: false,
      suppressNoteCardSummaryCard: false,
    });

    expect(subagent.foldBackgroundAgentTask).toBe(false);
    expect(subagent.suppressSubagentAgentTaskCard).toBe(true);
    expect(subagent.messageRowSubtype).toBe("user");
    expect(ordinary.foldBackgroundAgentTask).toBe(false);
    expect(ordinary.messageRowSubtype).toBe("user");
    expect(ordinary.displayText).toContain("普通提问");
    expect(genericCard.foldBackgroundAgentTask).toBe(false);
    expect(genericCard.messageRowSubtype).toBe("agent-task");
    expect(genericCard.displayText).toBe("runner finished ok");
  });
});
