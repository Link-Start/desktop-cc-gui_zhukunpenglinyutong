// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  buildSessionQuotaTargetKey,
  collectSessionQuotaTargets,
  formatSessionQuotaTargetTitle,
} from "./sessionQuotaTargets";

const assistant = (
  id: string,
  snap: NonNullable<
    Extract<ConversationItem, { kind: "message" }>["executionTargetSnapshot"]
  >,
): ConversationItem =>
  ({
    id,
    kind: "message",
    role: "assistant",
    text: "ok",
    executionTargetSnapshot: snap,
  }) as ConversationItem;

describe("collectSessionQuotaTargets", () => {
  it("dedupes by engine+provider and keeps first-seen order", () => {
    const items: ConversationItem[] = [
      assistant("a1", {
        engine: "claude",
        providerProfileId: "local",
        providerProfileNameSnapshot: "本地配置",
        model: "k3",
      }),
      assistant("a2", {
        engine: "claude",
        providerProfileId: "minimax-m3",
        providerProfileNameSnapshot: "Minimax-m3",
        model: "MiniMax-M3",
      }),
      assistant("a3", {
        engine: "claude",
        providerProfileId: "local",
        providerProfileNameSnapshot: "本地配置",
        model: "k3",
      }),
    ];

    const targets = collectSessionQuotaTargets(items, {
      engine: "claude",
      providerProfileId: "minimax-m3",
      providerLabel: "Minimax-m3",
      model: "MiniMax-M3",
    });

    expect(targets).toHaveLength(2);
    expect(targets[0]?.key).toBe(buildSessionQuotaTargetKey("claude", "local"));
    expect(targets[0]?.providerLabel).toBe("本地配置");
    expect(targets[1]?.key).toBe(
      buildSessionQuotaTargetKey("claude", "minimax-m3"),
    );
    expect(formatSessionQuotaTargetTitle(targets[1]!)).toBe(
      "Claude · Minimax-m3",
    );
  });

  it("includes fallback when history has no snapshots", () => {
    const targets = collectSessionQuotaTargets([], {
      engine: "kimi",
      providerProfileId: null,
      providerLabel: null,
      model: "k3",
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.engine).toBe("kimi");
    expect(targets[0]?.model).toBe("k3");
  });

  it("does not duplicate fallback when already present in items", () => {
    const items: ConversationItem[] = [
      assistant("a1", {
        engine: "kimi",
        providerProfileId: null,
        model: "k3",
      }),
    ];
    const targets = collectSessionQuotaTargets(items, {
      engine: "kimi",
      providerProfileId: null,
      model: "k3",
    });
    expect(targets).toHaveLength(1);
  });
});
