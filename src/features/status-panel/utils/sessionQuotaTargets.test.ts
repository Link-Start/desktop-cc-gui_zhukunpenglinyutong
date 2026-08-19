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

  it("includes PI fallback instead of dropping it as an unknown engine", () => {
    const targets = collectSessionQuotaTargets([], {
      engine: "pi",
      providerProfileId: null,
      providerLabel: "PI CLI",
      model: "composer-2",
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.engine).toBe("pi");
    expect(targets[0]?.key).toBe(buildSessionQuotaTargetKey("pi", null));
  });

  it("extracts dsh vendor from selected model instead of the host catalog sentinel", () => {
    const targets = collectSessionQuotaTargets([], {
      engine: "dsh",
      providerProfileId: "__dsh_host_catalog__",
      providerLabel: "DSH",
      model: "deepseek-official/deepseek-v4-flash",
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.engine).toBe("dsh");
    expect(targets[0]?.providerProfileId).toBe("deepseek-official");
    expect(targets[0]?.key).toBe(
      buildSessionQuotaTargetKey("dsh", "deepseek-official"),
    );
    expect(formatSessionQuotaTargetTitle(targets[0]!)).toBe("DSH");
  });

  it("extracts pi vendor from selected model instead of the local sentinel", () => {
    const targets = collectSessionQuotaTargets([], {
      engine: "pi",
      providerProfileId: "__local_pi__",
      providerLabel: "PI CLI",
      model: "deepseek/deepseek-chat",
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.providerProfileId).toBe("deepseek");
    expect(targets[0]?.key).toBe(buildSessionQuotaTargetKey("pi", "deepseek"));
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

  it("native current-only ignores history multi-provider snapshots", () => {
    const items: ConversationItem[] = [
      assistant("a1", {
        engine: "claude",
        providerProfileId: "kimi-coding",
        providerProfileNameSnapshot: "Kimi Coding",
        model: "kimi-k2",
      }),
      assistant("a2", {
        engine: "claude",
        providerProfileId: "deepseek",
        providerProfileNameSnapshot: "DeepSeek",
        model: "deepseek-v4-pro",
      }),
    ];
    const targets = collectSessionQuotaTargets(
      items,
      {
        engine: "claude",
        providerProfileId: "deepseek",
        providerLabel: "DeepSeek",
        model: "deepseek-v4-pro",
      },
      { includeHistory: false },
    );
    expect(targets).toHaveLength(1);
    expect(targets[0]?.key).toBe(
      buildSessionQuotaTargetKey("claude", "deepseek"),
    );
    expect(targets[0]?.providerLabel).toBe("DeepSeek");
    expect(targets[0]?.model).toBe("deepseek-v4-pro");
  });

  it("shared history mode still collects multi-provider targets", () => {
    const items: ConversationItem[] = [
      assistant("a1", {
        engine: "claude",
        providerProfileId: "kimi-coding",
        providerProfileNameSnapshot: "Kimi Coding",
        model: "kimi-k2",
      }),
      assistant("a2", {
        engine: "claude",
        providerProfileId: "deepseek",
        providerProfileNameSnapshot: "DeepSeek",
        model: "deepseek-v4-pro",
      }),
    ];
    const targets = collectSessionQuotaTargets(
      items,
      {
        engine: "claude",
        providerProfileId: "deepseek",
        providerLabel: "DeepSeek",
        model: "deepseek-v4-pro",
      },
      { includeHistory: true },
    );
    expect(targets).toHaveLength(2);
    expect(targets[0]?.key).toBe(
      buildSessionQuotaTargetKey("claude", "kimi-coding"),
    );
    expect(targets[1]?.key).toBe(
      buildSessionQuotaTargetKey("claude", "deepseek"),
    );
  });
});
