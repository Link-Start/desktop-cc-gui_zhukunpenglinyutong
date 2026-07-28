import { describe, expect, it } from "vitest";

import {
  canCancel,
  canRetry,
  isComposerInputLocked,
  isComposerSubmitLocked,
  isPickerLocked,
  sharedAdapterCapabilities,
  transition,
  type SharedSendState,
} from "./sendStateMachine";

describe("SharedSendStateMachine transitions", () => {
  it("reads cancel-pending support from the concrete adapter capability", () => {
    expect(sharedAdapterCapabilities("claude").cancelPendingDelivery).toBe(false);
    expect(sharedAdapterCapabilities("codex").cancelPendingDelivery).toBe(false);
    expect(canCancel("awaiting-acceptance", false)).toBe(false);
  });

  it("follows the happy path idle → preparing → awaiting → running → settling → idle", () => {
    let state: SharedSendState = "idle";
    state = transition(state, { type: "send" })!;
    expect(state).toBe("preparing-context");
    state = transition(state, { type: "packagePrepared" })!;
    expect(state).toBe("awaiting-acceptance");
    state = transition(state, { type: "runtimeAck" })!;
    expect(state).toBe("running");
    state = transition(state, { type: "runSettled" })!;
    expect(state).toBe("settling");
    state = transition(state, { type: "canonicalCommitted" })!;
    expect(state).toBe("idle");
  });

  it("routes lossy projection through degraded-context with explicit confirmation", () => {
    let state: SharedSendState = transition("idle", { type: "send" })!;
    state = transition(state, { type: "lossyProjection" })!;
    expect(state).toBe("degraded-context");

    // 未经确认不能发送：packagePrepared 在 degraded-context 不是合法迁移。
    expect(transition(state, { type: "packagePrepared" })).toBeNull();

    state = transition(state, { type: "degradedConfirmed" })!;
    expect(state).toBe("awaiting-acceptance");
  });

  it("returns a confirmed read-only preview to preparing before Tx1 actual package confirmation", () => {
    let state: SharedSendState = transition("idle", { type: "send" })!;
    state = transition(state, { type: "lossyProjection" })!;
    state = transition(state, { type: "previewConfirmed" })!;
    expect(state).toBe("preparing-context");
  });

  it("ambiguous ack in awaiting-acceptance enters recovery-required", () => {
    const state = transition("awaiting-acceptance", { type: "ackAmbiguous" });
    expect(state).toBe("recovery-required");
  });

  it("cancel-pending resolves via ack, ambiguity, or rejection", () => {
    expect(transition("cancel-pending", { type: "cancelAck" })).toBe("settling");
    expect(transition("cancel-pending", { type: "ackAmbiguous" })).toBe("recovery-required");
    expect(transition("cancel-pending", { type: "cancelRejected" })).toBe("running");
  });

  it("commit failure in settling enters recovery-required", () => {
    expect(transition("settling", { type: "commitFailed" })).toBe("recovery-required");
  });

  it("recovery-required resolves through probe outcomes", () => {
    expect(transition("recovery-required", { type: "probeActiveRun" })).toBe("running");
    expect(transition("recovery-required", { type: "probeTerminalRun" })).toBe("settling");
    expect(transition("recovery-required", { type: "probeNotAccepted" })).toBe("settling");
  });

  it("target-unavailable returns to idle when repaired", () => {
    expect(transition("target-unavailable", { type: "targetRepaired" })).toBe("idle");
  });

  it("rejects illegal transitions", () => {
    expect(transition("idle", { type: "runSettled" })).toBeNull();
    expect(transition("running", { type: "send" })).toBeNull();
    expect(transition("settling", { type: "send" })).toBeNull();
  });
});

describe("SharedSendStateMachine selectors (§14.5.6)", () => {
  it("locks picker in every non-idle state", () => {
    const locked: SharedSendState[] = [
      "preparing-context",
      "degraded-context",
      "awaiting-acceptance",
      "cancel-pending",
      "running",
      "settling",
      "recovery-required",
    ];
    for (const state of locked) {
      expect(isPickerLocked(state)).toBe(true);
    }
    expect(isPickerLocked("idle")).toBe(false);
  });

  it("picker stays changeable under target-unavailable so user can pick another target", () => {
    expect(isPickerLocked("target-unavailable")).toBe(false);
    expect(isComposerSubmitLocked("target-unavailable")).toBe(true);
    expect(isComposerInputLocked("target-unavailable")).toBe(false);
  });

  it("normal progress keeps draft editable while blocking another turn submission", () => {
    const draftableStates: SharedSendState[] = [
      "preparing-context",
      "degraded-context",
      "awaiting-acceptance",
      "running",
      "settling",
    ];
    for (const state of draftableStates) {
      expect(isComposerInputLocked(state)).toBe(false);
      expect(isComposerSubmitLocked(state)).toBe(true);
    }
  });

  it("ambiguous ordering locks both input and submission", () => {
    for (const state of ["cancel-pending", "recovery-required"] as const) {
      expect(isComposerInputLocked(state)).toBe(true);
      expect(isComposerSubmitLocked(state)).toBe(true);
    }
  });

  it("ambiguous states never allow one-click retry", () => {
    expect(canRetry("awaiting-acceptance")).toBe(false);
    expect(canRetry("cancel-pending")).toBe(false);
    expect(canRetry("recovery-required")).toBe(false);
  });

  it("cancel requires awaiting-acceptance plus adapter capability", () => {
    expect(canCancel("awaiting-acceptance", true)).toBe(true);
    expect(canCancel("awaiting-acceptance", false)).toBe(false);
    expect(canCancel("running", true)).toBe(false);
  });
});
