import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../types";
import { normalizeItem } from "../utils/threadItems";
import {
  buildMessagePresentationMetadata,
  getPresentationContext,
  getPresentationContexts,
} from "./normalizeConversationPresentation";

function userItem(overrides: Partial<Extract<ConversationItem, { kind: "message" }>> = {}) {
  return {
    id: "user-1",
    kind: "message" as const,
    role: "user" as const,
    text: "继续分析",
    ...overrides,
  };
}

describe("conversation presentation normalization", () => {
  it("normalizes browser and intent-canvas attachments without raw prompt text", () => {
    const metadata = buildMessagePresentationMetadata(userItem({
      text: "继续分析",
      browserContextAttachment: {
        kind: "browser_snapshot",
        attachmentId: "browser-1",
        browserSessionId: "session-1",
        snapshotId: "snapshot-1",
        workspaceId: "workspace-1",
        title: "Issue 42",
        url: "https://example.test/issues/42",
        capturedAt: 1,
        stale: false,
        summary: "Issue summary",
        privacy: {
          redactionApplied: false,
          redactedKinds: [],
          omittedKinds: [],
        },
        readableBlocks: [{
          blockId: "block-1",
          role: "issue_body",
          text: "Issue body",
          score: 10,
          truncated: false,
        }],
      },
      intentCanvasContextAttachments: [{
        kind: "intent_canvas_context",
        attachmentId: "canvas-1",
        canvasId: "canvas-a",
        title: "Release intent",
        mode: "execution",
        compressionMode: "compact",
        truncated: false,
        payloadCharacters: 18,
        rawPayload: "{\"type\":\"intent\"}",
        semanticNodes: { total: 2, sent: 2, omitted: 0 },
        semanticEdges: { total: 1, sent: 1, omitted: 0 },
        evidence: { total: 1, sent: 1, omitted: 0 },
        visualTextBlocks: { total: 0, sent: 0, omitted: 0 },
      }],
    }));

    expect(metadata.displayText).toBe("继续分析");
    expect(getPresentationContext(metadata, "browser")).toMatchObject({
      title: "Issue 42",
      summary: "Issue summary",
      evidenceCount: 1,
    });
    expect(getPresentationContexts(metadata, "intent-canvas")).toHaveLength(1);
  });

  it("suppresses memory-only payloads from sticky candidates while retaining context", () => {
    const metadata = buildMessagePresentationMetadata(userItem({
      text: "<project-memory>\n[项目上下文] 已记录会话摘要\n</project-memory>\n",
    }));

    expect(metadata.displayText).toContain("[项目上下文]");
    expect(metadata.stickyCandidateText).toBe("");
    expect(getPresentationContext(metadata, "memory")?.preview).toContain("[项目上下文]");
  });

  it("normalizes note-card context and preserves image paths", () => {
    const metadata = buildMessagePresentationMetadata(userItem({
      text: [
        "请按这个执行",
        "",
        "<note-card-context>",
        '<note-card title="发布清单" archived="false">',
        "先构建，再发布",
        "",
        "Images:",
        "- deploy.png | /tmp/deploy.png",
        "</note-card>",
        "</note-card-context>",
      ].join("\n"),
    }));

    expect(metadata.displayText).toBe("请按这个执行");
    expect(getPresentationContext(metadata, "note-card")).toMatchObject({
      title: "发布清单",
      imagePaths: ["/tmp/deploy.png"],
    });
  });

  it("keeps image-only messages renderable without inventing display text", () => {
    const item = normalizeItem(userItem({ text: "", images: ["diagram.png"] }));
    expect(item.kind === "message" ? item.presentationMetadata : null).toEqual({
      displayText: "",
      stickyCandidateText: "",
      contexts: [],
    });
    expect(item.kind === "message" ? item.images : []).toEqual(["diagram.png"]);
  });

  it("refreshes assistant metadata when streaming text grows", () => {
    const first = normalizeItem({
      id: "assistant-1",
      kind: "message",
      role: "assistant",
      text: "first",
    });
    if (first.kind !== "message") {
      throw new Error("Expected normalized assistant message");
    }
    const next = normalizeItem({
      ...first,
      text: "first second",
    });

    expect(next.kind === "message" ? next.presentationMetadata?.displayText : null).toBe(
      "first second",
    );
  });
});
