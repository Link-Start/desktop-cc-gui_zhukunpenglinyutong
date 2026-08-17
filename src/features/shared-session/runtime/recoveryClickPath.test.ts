import { afterEach, describe, expect, it, vi } from "vitest";

import {
  invalidateRecoveryOwnerPrefetch,
  prefetchRecoveryOwner,
  resetRecoveryOwnerPrefetchForTests,
  takePrefetchedRecoveryOwner,
  yieldRecoveryClickPaint,
} from "./recoveryClickPath";

afterEach(() => {
  resetRecoveryOwnerPrefetchForTests();
});

describe("recoveryClickPath", () => {
  it("reuses one in-flight owner lookup per workspace+thread", async () => {
    const lookup = vi.fn().mockResolvedValue({ kind: "clear" });

    const first = prefetchRecoveryOwner("ws-1", "shared:1", lookup);
    const second = prefetchRecoveryOwner("ws-1", "shared:1", lookup);

    expect(first).toBe(second);
    await expect(first).resolves.toEqual({ kind: "clear" });
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("gives the first consumer the prefetch and leaves the second lookup fresh", async () => {
    const lookup = vi
      .fn()
      .mockResolvedValueOnce({ kind: "binding", bindingKey: "claude:default" })
      .mockResolvedValueOnce({ kind: "clear" });

    void prefetchRecoveryOwner("ws-1", "shared:1", lookup);
    const first = await takePrefetchedRecoveryOwner("ws-1", "shared:1");
    const second = await takePrefetchedRecoveryOwner("ws-1", "shared:1");

    expect(first).toEqual({ kind: "binding", bindingKey: "claude:default" });
    expect(second).toBeNull();
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("invalidates after recover so a later prefetch is new", async () => {
    const lookup = vi
      .fn()
      .mockResolvedValueOnce({ kind: "clear" })
      .mockResolvedValueOnce({ kind: "ambiguous" });

    await prefetchRecoveryOwner("ws-1", "shared:1", lookup);
    invalidateRecoveryOwnerPrefetch("ws-1", "shared:1");
    await expect(
      prefetchRecoveryOwner("ws-1", "shared:1", lookup),
    ).resolves.toEqual({ kind: "ambiguous" });
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("evicts a failed prefetch so the next lookup is fresh", async () => {
    const lookup = vi
      .fn()
      .mockRejectedValueOnce(new Error("turn-state failed"))
      .mockResolvedValueOnce({ kind: "clear" });

    await expect(
      prefetchRecoveryOwner("ws-1", "shared:1", lookup),
    ).rejects.toThrow("turn-state failed");
    await expect(
      prefetchRecoveryOwner("ws-1", "shared:1", lookup),
    ).resolves.toEqual({ kind: "clear" });
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("resolves the paint yield without blocking the caller", async () => {
    await expect(yieldRecoveryClickPaint()).resolves.toBeUndefined();
  });
});
