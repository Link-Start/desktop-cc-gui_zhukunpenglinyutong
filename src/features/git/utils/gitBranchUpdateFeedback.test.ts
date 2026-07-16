import { describe, expect, it } from "vitest";
import { getGitBranchUpdateFeedback } from "./gitBranchUpdateFeedback";

const t = (key: string) => key;

describe("getGitBranchUpdateFeedback", () => {
  it("maps a successful update to success feedback", () => {
    expect(getGitBranchUpdateFeedback(t, {
      branch: "main",
      status: "success",
      message: "updated",
    }, "main")).toEqual({
      tone: "success",
      message: "git.historyBranchUpdateSuccess",
    });
  });

  it("maps a diverged update to blocked error feedback", () => {
    expect(getGitBranchUpdateFeedback(t, {
      branch: "main",
      status: "blocked",
      reason: "diverged",
      message: "diverged",
    }, "main")).toEqual({
      tone: "error",
      message: "git.historyBranchUpdateBlockedDiverged",
    });
  });
});
