import { describe, expect, it } from "vitest";
import { formatSquadStatusSummary } from "./SubagentSquadGrid";

describe("formatSquadStatusSummary", () => {
  const labels = {
    completed: "完成",
    running: "运行",
    error: "失败",
  };

  it("omits zero counts", () => {
    expect(
      formatSquadStatusSummary(
        { completed: 4, running: 0, error: 0 },
        labels,
      ),
    ).toBe("4 完成");
    expect(
      formatSquadStatusSummary(
        { completed: 2, running: 1, error: 1 },
        labels,
      ),
    ).toBe("2 完成 · 1 运行 · 1 失败");
  });

  it("returns empty string when all zero", () => {
    expect(
      formatSquadStatusSummary(
        { completed: 0, running: 0, error: 0 },
        labels,
      ),
    ).toBe("");
  });
});
