import { describe, expect, it } from "vitest";
import {
  isSharedSessionThreadId,
  resolveIsSharedSession,
} from "./sharedSessionIdentity";

describe("isSharedSessionThreadId", () => {
  it("returns true for shared-prefixed ids", () => {
    expect(isSharedSessionThreadId("shared:abc-123")).toBe(true);
    expect(isSharedSessionThreadId(" shared:abc ")).toBe(true);
  });

  it("returns false for native ids and empty input", () => {
    expect(isSharedSessionThreadId("claude:abc")).toBe(false);
    expect(isSharedSessionThreadId("codex:abc")).toBe(false);
    expect(isSharedSessionThreadId("sharedish:abc")).toBe(false);
    expect(isSharedSessionThreadId("")).toBe(false);
    expect(isSharedSessionThreadId(null)).toBe(false);
    expect(isSharedSessionThreadId(undefined)).toBe(false);
  });
});

describe("resolveIsSharedSession", () => {
  it("resolves shared when id has shared prefix regardless of projection", () => {
    expect(resolveIsSharedSession("shared:x", null)).toBe(true);
    expect(resolveIsSharedSession("shared:x", undefined)).toBe(true);
    expect(resolveIsSharedSession("shared:x", {})).toBe(true);
    expect(
      resolveIsSharedSession("shared:x", { threadKind: "native" }),
    ).toBe(true);
    expect(
      resolveIsSharedSession("shared:x", { threadKind: "shared" }),
    ).toBe(true);
  });

  it("falls back to threadKind projection for non-shared ids", () => {
    expect(
      resolveIsSharedSession("claude:x", { threadKind: "shared" }),
    ).toBe(true);
    expect(
      resolveIsSharedSession("claude:x", { threadKind: "native" }),
    ).toBe(false);
    expect(resolveIsSharedSession("claude:x", null)).toBe(false);
    expect(resolveIsSharedSession(null, { threadKind: "shared" })).toBe(true);
    expect(resolveIsSharedSession(null, null)).toBe(false);
  });
});
