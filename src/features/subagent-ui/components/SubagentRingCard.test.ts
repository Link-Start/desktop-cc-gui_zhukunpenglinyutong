import { describe, expect, it } from "vitest";
import type { SubagentCardViewModel } from "../utils/subagentViewModel";
import { resolveRingPercent, resolveRingTitle } from "./SubagentRingCard";

function baseCard(
  overrides: Partial<SubagentCardViewModel> = {},
): SubagentCardViewModel {
  return {
    id: "card-1",
    displayName: "Subagent",
    indexLabel: "01",
    description: "问候测试",
    typeLabel: "general-purpose",
    status: "running",
    progress: 0.62,
    toolCount: null,
    outputText: null,
    taskOutput: null,
    githubLogin: null,
    githubProfileUrl: null,
    avatarSrc: null,
    agentId: null,
    sessionThreadId: null,
    ...overrides,
  };
}

describe("resolveRingPercent", () => {
  it("forces completed and error to full ring", () => {
    expect(resolveRingPercent(baseCard({ status: "completed", progress: 0.2 }))).toBe(
      100,
    );
    expect(resolveRingPercent(baseCard({ status: "error", progress: 0 }))).toBe(100);
  });

  it("maps running progress to 0..100 percent", () => {
    expect(resolveRingPercent(baseCard({ status: "running", progress: 0.62 }))).toBe(
      62,
    );
    expect(resolveRingPercent(baseCard({ status: "running", progress: 0 }))).toBe(0);
    expect(resolveRingPercent(baseCard({ status: "running", progress: 1.5 }))).toBe(
      100,
    );
  });

  it("treats non-finite progress as 0 while running", () => {
    expect(
      resolveRingPercent(baseCard({ status: "running", progress: Number.NaN })),
    ).toBe(0);
  });
});

describe("resolveRingTitle", () => {
  it("prefers description, then type, then fallback", () => {
    expect(resolveRingTitle(baseCard({ description: " 任务 A " }), "SubAgent")).toBe(
      "任务 A",
    );
    expect(
      resolveRingTitle(
        baseCard({ description: "  ", typeLabel: "explore" }),
        "SubAgent",
      ),
    ).toBe("explore");
    expect(
      resolveRingTitle(
        baseCard({ description: "", typeLabel: "  " }),
        "SubAgent",
      ),
    ).toBe("SubAgent");
  });
});
