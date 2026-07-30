import { describe, expect, it } from "vitest";
import {
  addBoundedConversationRenderModeKey,
  CONVERSATION_LIGHTWEIGHT_SUGGEST_HEAVY_ROWS,
  CONVERSATION_LIGHTWEIGHT_SUGGEST_RENDER_WEIGHT,
  CONVERSATION_OVERSIZED_HISTORY_RENDER_WEIGHT,
  CONVERSATION_OVERSIZED_HISTORY_ROWS,
  resolveConversationLightweightModeState,
  resolveConversationLightweightPolicy,
} from "./messagesConversationLightweightMode";

describe("messagesConversationLightweightMode", () => {
  it("does not suggest lightweight mode for render-heavy timelines", () => {
    const policy = resolveConversationLightweightPolicy({
      rowCount: 24,
      renderWeight: CONVERSATION_LIGHTWEIGHT_SUGGEST_RENDER_WEIGHT,
      heavyRowCount: 1,
    });

    expect(policy).toEqual({ suggested: false, oversized: false });
  });

  it("does not suggest lightweight mode for repeated heavy rows", () => {
    const policy = resolveConversationLightweightPolicy({
      rowCount: 24,
      renderWeight: 64,
      heavyRowCount: CONVERSATION_LIGHTWEIGHT_SUGGEST_HEAVY_ROWS,
    });

    expect(policy).toEqual({ suggested: false, oversized: false });
  });

  it("does not activate oversized policy by row count or render weight", () => {
    expect(
      resolveConversationLightweightPolicy({
        rowCount: CONVERSATION_OVERSIZED_HISTORY_ROWS,
        renderWeight: 1,
        heavyRowCount: 0,
      }),
    ).toEqual({ suggested: false, oversized: false });
    expect(
      resolveConversationLightweightPolicy({
        rowCount: 1,
        renderWeight: CONVERSATION_OVERSIZED_HISTORY_RENDER_WEIGHT,
        heavyRowCount: 0,
      }),
    ).toEqual({ suggested: false, oversized: false });
  });

  it("keeps legacy oversized policy inactive", () => {
    const policy = { suggested: true, oversized: true };

    expect(
      resolveConversationLightweightModeState({
        policy,
        manualEnabled: false,
        detailHydrationRequested: false,
      }),
    ).toEqual({ active: false, reason: "inactive" });
    expect(
      resolveConversationLightweightModeState({
        policy,
        manualEnabled: false,
        detailHydrationRequested: true,
      }),
    ).toEqual({ active: false, reason: "inactive" });
  });

  it("ignores legacy manual lightweight state", () => {
    expect(
      resolveConversationLightweightModeState({
        policy: { suggested: false, oversized: false },
        manualEnabled: true,
        detailHydrationRequested: true,
      }),
    ).toEqual({ active: false, reason: "inactive" });
  });

  it("bounds remembered conversation render mode keys", () => {
    const first = addBoundedConversationRenderModeKey(new Set(["a", "b", "c"]), "d", 3);
    expect([...first]).toEqual(["b", "c", "d"]);

    const repeated = addBoundedConversationRenderModeKey(first, "d", 3);
    expect(repeated).toBe(first);
  });
});
