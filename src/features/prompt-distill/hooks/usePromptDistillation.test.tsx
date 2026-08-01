/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { claudeCommandCreate, engineSendMessageSync } from "../../../services/tauri";
import { pushErrorToast } from "../../../services/toasts";
import {
  suggestDistillCommandName,
  usePromptDistillation,
} from "./usePromptDistillation";
import { buildDistillInstruction } from "../utils/distillInstruction";

vi.mock("../../../services/tauri", () => ({
  engineSendMessageSync: vi.fn(),
  claudeCommandCreate: vi.fn(),
}));

vi.mock("../../../services/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

function renderDistill(workspaceId: string | null = "ws-1") {
  return renderHook(() => usePromptDistillation({ workspaceId }));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("usePromptDistillation", () => {
  it("distills source text into an editable preview", async () => {
    const sendSync = vi.mocked(engineSendMessageSync);
    sendSync.mockResolvedValueOnce({
      engine: "claude",
      text: "按仓库规范审查 $ARGUMENTS 的改动。",
    });

    const { result } = renderDistill();

    act(() => {
      result.current.start("帮我把这段代码按仓库规范审查一下");
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("preview");
    });

    expect(result.current.content).toBe("按仓库规范审查 $ARGUMENTS 的改动。");
    expect(result.current.error).toBeNull();
    expect(sendSync).toHaveBeenCalledTimes(1);
    const params = sendSync.mock.calls[0]?.[1];
    expect(params?.engine).toBe("claude");
    expect(params?.accessMode).toBe("read-only");
    expect(params?.autoSession?.sessionPurpose).toBe("prompt-distill");
  });

  it("falls back to codex when claude fails with a retryable error", async () => {
    const sendSync = vi.mocked(engineSendMessageSync);
    sendSync
      .mockRejectedValueOnce(new Error("Claude exited with status: exit status: 1"))
      .mockResolvedValueOnce({
        engine: "codex",
        text: "Review $ARGUMENTS against the repo rules.",
      });

    const { result } = renderDistill();

    act(() => {
      result.current.start("review this change");
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("preview");
    });

    expect(result.current.content).toBe("Review $ARGUMENTS against the repo rules.");
    expect(result.current.distillingEngine).toBe("codex");
    expect(sendSync).toHaveBeenCalledTimes(2);
  });

  it("shows localized failure copy when both engines fail", async () => {
    const sendSync = vi.mocked(engineSendMessageSync);
    sendSync
      .mockRejectedValueOnce(new Error("Claude exited with status: exit status: 1"))
      .mockRejectedValueOnce(new Error("Codex response timed out"));

    const { result } = renderDistill();

    act(() => {
      result.current.start("review this change");
    });

    await waitFor(() => {
      expect(result.current.phase).toBe("preview");
    });

    expect(result.current.error).toContain("Prompt distillation failed");
    expect(result.current.error).toContain("Claude exited with status");
    expect(result.current.error).toContain("Codex response timed out");
  });

  it("saves the command and reports a success toast", async () => {
    const sendSync = vi.mocked(engineSendMessageSync);
    sendSync.mockResolvedValueOnce({ engine: "claude", text: "模板正文" });
    const create = vi.mocked(claudeCommandCreate);
    create.mockResolvedValueOnce({
      name: "commit-msg",
      path: "/managed/commands/commit-msg.md",
      source: "workspace_managed",
      description: null,
      argumentHint: null,
      content: "模板正文",
    });

    const { result } = renderDistill();

    act(() => {
      result.current.start("按规范写提交信息");
    });
    await waitFor(() => {
      expect(result.current.phase).toBe("preview");
    });

    act(() => {
      result.current.setName("Commit-Msg");
    });

    let saved = false;
    await act(async () => {
      saved = await result.current.save();
    });

    expect(saved).toBe(true);
    expect(create).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      name: "commit-msg",
      content: "模板正文",
    });
    expect(pushErrorToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
    expect(result.current.isOpen).toBe(false);
  });

  it("rejects an invalid command name without invoking the backend", async () => {
    const sendSync = vi.mocked(engineSendMessageSync);
    sendSync.mockResolvedValueOnce({ engine: "claude", text: "模板正文" });
    const create = vi.mocked(claudeCommandCreate);

    const { result } = renderDistill();

    act(() => {
      result.current.start("按规范写提交信息");
    });
    await waitFor(() => {
      expect(result.current.phase).toBe("preview");
    });

    act(() => {
      result.current.setName("bad name!");
    });

    let saved = true;
    await act(async () => {
      saved = await result.current.save();
    });

    expect(saved).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(result.current.error).toContain("lowercase");
    expect(result.current.phase).toBe("preview");
  });
});

describe("suggestDistillCommandName", () => {
  it("derives an ascii slug from the first line", () => {
    expect(suggestDistillCommandName("Review This Change\nmore text")).toBe(
      "review-this-change",
    );
  });

  it("falls back when no ascii slug can be derived", () => {
    expect(suggestDistillCommandName("按仓库规范写提交信息")).toBe("distilled-prompt");
    expect(suggestDistillCommandName("!!!")).toBe("distilled-prompt");
  });
});

describe("buildDistillInstruction", () => {
  it("builds a Chinese instruction with $ARGUMENTS guidance", () => {
    const instruction = buildDistillInstruction("对话内容", "claude", "zh");
    expect(instruction).toContain("你是一名斜杠命令模板提炼助手。");
    expect(instruction).toContain("$ARGUMENTS");
    expect(instruction).toContain("对话片段：\n对话内容");
  });

  it("builds an English instruction and omits Claude-only constraints for codex", () => {
    const claudeInstruction = buildDistillInstruction("excerpt", "claude", "en");
    expect(claudeInstruction).toContain("slash command template distillation assistant");
    expect(claudeInstruction).toContain("Plain text output only");

    const codexInstruction = buildDistillInstruction("excerpt", "codex", "en");
    expect(codexInstruction).not.toContain("Plain text output only");
  });
});
