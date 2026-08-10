import { describe, expect, it } from "vitest";
import { normalizeMemoryPickComposerMode } from "./memoryPickTypes";

describe("normalizeMemoryPickComposerMode", () => {
  it("maps single to pick", () => {
    expect(normalizeMemoryPickComposerMode("single")).toBe("pick");
  });
  it("keeps always and pick", () => {
    expect(normalizeMemoryPickComposerMode("always")).toBe("always");
    expect(normalizeMemoryPickComposerMode("pick")).toBe("pick");
  });
  it("defaults to off", () => {
    expect(normalizeMemoryPickComposerMode(undefined)).toBe("off");
    expect(normalizeMemoryPickComposerMode("nope")).toBe("off");
  });
});
