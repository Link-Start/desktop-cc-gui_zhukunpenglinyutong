import { describe, expect, it } from "vitest";
import {
  buildNativeOwnerToSharedThreadMap,
  expandHiddenSharedBindingIds,
  normalizeSharedSessionSummary,
  remapThreadParentsToSharedOwners,
} from "./sharedSessionSummaries";

describe("sharedSessionSummaries", () => {
  it("keeps native thread ids for all five supported Shared engines", () => {
    const summary = normalizeSharedSessionSummary({
      id: "shared-session-1",
      threadId: "shared:shared-session-1",
      title: "Shared Session",
      updatedAt: 1_730_000_000_000,
      selectedEngine: "grok",
      nativeThreadIds: [
        "claude:session-1",
        "claude-pending-shared-2",
        "019d767b-5541-7010-a30d-a454864bccd8",
        "grok:session-3",
        "kimi:session-4",
        "opencode:session-5",
        "gemini:session-3",
        "gemini-pending-4",
      ],
    });

    expect(summary).toMatchObject({
      id: "shared-session-1",
      threadId: "shared:shared-session-1",
      selectedEngine: "grok",
    });
    expect(summary?.nativeThreadIds).toEqual([
      "claude:session-1",
      "claude-pending-shared-2",
      "019d767b-5541-7010-a30d-a454864bccd8",
      "grok:session-3",
      "kimi:session-4",
      "opencode:session-5",
    ]);
  });

  it("rejects malformed non-shared thread ids from shared summaries", () => {
    expect(
      normalizeSharedSessionSummary({
        id: "not-shared",
        threadId: "gemini:session-1",
        selectedEngine: "claude",
      }),
    ).toBeNull();
  });

  it("expands hidden binding ids for raw and engine-prefixed forms", () => {
    const expanded = expandHiddenSharedBindingIds([
      "grok:real-session-1",
      "kimi-pending-shared-2",
      "019d767b-5541-7010-a30d-a454864bccd8",
      "opencode:ses_opc_1",
    ]);

    expect(expanded.has("grok:real-session-1")).toBe(true);
    expect(expanded.has("real-session-1")).toBe(true);
    expect(expanded.has("kimi:kimi-pending-shared-2")).toBe(true);
    expect(expanded.has("kimi-pending-shared-2")).toBe(true);
    expect(expanded.has("019d767b-5541-7010-a30d-a454864bccd8")).toBe(true);
    expect(expanded.has("codex:019d767b-5541-7010-a30d-a454864bccd8")).toBe(
      true,
    );
    expect(expanded.has("opencode:ses_opc_1")).toBe(true);
    expect(expanded.has("ses_opc_1")).toBe(true);
  });

  it("remaps grok subagent parents from hidden native owner to shared thread", () => {
    const summary = normalizeSharedSessionSummary({
      id: "shared-session-1",
      threadId: "shared:shared-session-1",
      title: "Shared Session",
      updatedAt: 1,
      selectedEngine: "grok",
      nativeThreadIds: ["grok:parent-native"],
    });
    expect(summary).not.toBeNull();
    const map = buildNativeOwnerToSharedThreadMap([summary!]);
    expect(map.get("grok:parent-native")).toBe("shared:shared-session-1");
    expect(map.get("parent-native")).toBe("shared:shared-session-1");

    const remapped = remapThreadParentsToSharedOwners(
      [
        {
          id: "grok:child-1",
          name: "子代理 1",
          updatedAt: 2,
          engineSource: "grok",
          parentThreadId: "grok:parent-native",
        },
        {
          id: "shared:shared-session-1",
          name: "Shared Session",
          updatedAt: 3,
          engineSource: "grok",
          threadKind: "shared",
        },
      ],
      map,
    );
    expect(remapped.find((t) => t.id === "grok:child-1")?.parentThreadId).toBe(
      "shared:shared-session-1",
    );
  });
});
