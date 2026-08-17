import { describe, expect, it } from "vitest";

import {
  isCodexBackgroundHelperPreview,
  isCommitMessageHelperPreview,
} from "./codexBackgroundHelpers";

describe("codexBackgroundHelpers", () => {
  it("detects known Codex helper prompts", () => {
    expect(
      isCodexBackgroundHelperPreview(
        "Generate a concise title for a coding chat thread from the first user message. Return only title text.",
      ),
    ).toBe(true);
    expect(
      isCodexBackgroundHelperPreview(
        "## Memory Writing Agent: Phase 2 (Consolidation)\n\nYou are consolidating raw memories.",
      ),
    ).toBe(true);
    expect(
      isCodexBackgroundHelperPreview(
        "Please generate a commit message. The commit message must follow the Conventional Commits specification and be written entirely in English.",
      ),
    ).toBe(true);
    expect(
      isCodexBackgroundHelperPreview(
        "请生成一次提交（commit）信息，提交信息需遵循 Conventional Commits 规范，并且全部使用中文。",
      ),
    ).toBe(true);
    expect(
      isCodexBackgroundHelperPreview(
        "Generate a concise git commit message for the following changes.",
      ),
    ).toBe(true);
  });

  it("does not hide normal conversations that only mention memory writing", () => {
    expect(
      isCodexBackgroundHelperPreview(
        "请分析 Memory Writing Agent 为什么会出现在会话列表里",
      ),
    ).toBe(false);
  });

  it("treats commit-message prompts as helpers without hiding normal commit discussions", () => {
    expect(
      isCommitMessageHelperPreview(
        "Please generate a commit message. The commit message must follow the Conventional Commits specification and be written entirely in English.",
      ),
    ).toBe(true);
    expect(
      isCommitMessageHelperPreview(
        "请生成一次提交（commit）信息，提交信息需遵循 Conventional Commits 规范，并且全部使用中文。",
      ),
    ).toBe(true);
    expect(
      isCommitMessageHelperPreview("帮我看看这次 commit message 写得对不对"),
    ).toBe(false);
  });
});
