import { describe, expect, it, vi } from "vitest";
import {
  publishGitRepositoryActionIntent,
  subscribeGitRepositoryActionIntent,
} from "./gitRepositoryActions";

describe("gitRepositoryActions", () => {
  it("delivers a queued lazy-surface intent once and preserves repository scope", () => {
    publishGitRepositoryActionIntent({
      action: "pull",
      repositoryRoot: "services\\api",
    });
    const firstListener = vi.fn();
    const unsubscribeFirst = subscribeGitRepositoryActionIntent(firstListener);

    expect(firstListener).toHaveBeenCalledWith(expect.objectContaining({
      action: "pull",
      repositoryRoot: "services\\api",
    }));
    unsubscribeFirst();

    const secondListener = vi.fn();
    const unsubscribeSecond = subscribeGitRepositoryActionIntent(secondListener);
    expect(secondListener).not.toHaveBeenCalled();
    publishGitRepositoryActionIntent({
      action: "fetch",
      repositoryRoot: "services/api",
    });
    expect(secondListener).toHaveBeenCalledWith(expect.objectContaining({
      action: "fetch",
      repositoryRoot: "services/api",
    }));
    unsubscribeSecond();
  });
});
