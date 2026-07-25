import { describe, expect, it } from "vitest";
import { buildWorkspaceMessageIndex, makeMessageSnippet } from "./messageIndex";

describe("messageIndex", () => {
  it("indexes only message items", () => {
    const indexed = buildWorkspaceMessageIndex(
      ["thread-1"],
      {
        "thread-1": [
          { id: "m1", kind: "message", role: "user", text: "hello world" },
          { id: "r1", kind: "reasoning", summary: "s", content: "c" },
        ],
      },
    );

    expect(indexed).toEqual([
      {
        messageId: "m1",
        threadId: "thread-1",
        text: "hello world",
        normalizedText: "hello world",
      },
    ]);
  });

  it("reuses an index for the same immutable snapshot and thread order", () => {
    const itemsByThread = {
      "thread-1": [
        { id: "m1", kind: "message", role: "user", text: "Hello World" },
      ],
    } satisfies Parameters<typeof buildWorkspaceMessageIndex>[1];

    const first = buildWorkspaceMessageIndex(["thread-1"], itemsByThread);
    const second = buildWorkspaceMessageIndex(["thread-1"], itemsByThread);

    expect(second).toBe(first);
    expect(first[0]?.normalizedText).toBe("hello world");
  });

  it("rebuilds when the canonical snapshot changes", () => {
    const previousSnapshot = {
      "thread-1": [
        { id: "m1", kind: "message", role: "user", text: "old content" },
      ],
    } satisfies Parameters<typeof buildWorkspaceMessageIndex>[1];
    const nextSnapshot = {
      "thread-1": [
        { id: "m2", kind: "message", role: "assistant", text: "new content" },
      ],
    } satisfies Parameters<typeof buildWorkspaceMessageIndex>[1];

    const previous = buildWorkspaceMessageIndex(["thread-1"], previousSnapshot);
    const next = buildWorkspaceMessageIndex(["thread-1"], nextSnapshot);

    expect(next).not.toBe(previous);
    expect(next.map((message) => message.text)).toEqual(["new content"]);
  });

  it("keeps thread order isolated inside one snapshot cache", () => {
    const itemsByThread = {
      a: [{ id: "ma", kind: "message", role: "user", text: "a" }],
      b: [{ id: "mb", kind: "message", role: "user", text: "b" }],
    } satisfies Parameters<typeof buildWorkspaceMessageIndex>[1];

    const forward = buildWorkspaceMessageIndex(["a", "b"], itemsByThread);
    const reverse = buildWorkspaceMessageIndex(["b", "a"], itemsByThread);

    expect(forward.map((message) => message.threadId)).toEqual(["a", "b"]);
    expect(reverse.map((message) => message.threadId)).toEqual(["b", "a"]);
    expect(reverse).not.toBe(forward);
  });

  it("creates a bounded snippet around the hit", () => {
    const snippet = makeMessageSnippet("abc def ghi jkl mno pqr", "ghi", 4);
    expect(snippet).toContain("ghi");
    expect(snippet.length).toBeLessThanOrEqual(20);
  });
});
