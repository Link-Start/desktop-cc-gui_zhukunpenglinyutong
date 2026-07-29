/**
 * Shared Send UI 状态机（Wave 4 / B.6，上游设计 §14.5.2）。
 *
 * 纯函数 transition + selector；不持有副作用。
 * 九状态：idle / preparing-context / degraded-context / awaiting-acceptance /
 * cancel-pending / running / settling / recovery-required / target-unavailable。
 */

export type SharedSendState =
  | "idle"
  | "preparing-context"
  | "degraded-context"
  | "awaiting-acceptance"
  | "cancel-pending"
  | "running"
  | "settling"
  | "recovery-required"
  | "target-unavailable";

export type SharedSendEvent =
  | { type: "send" }
  | { type: "packagePrepared" }
  | { type: "lossyProjection" }
  | { type: "targetUnavailable" }
  | { type: "previewConfirmed" }
  | { type: "degradedConfirmed" }
  | { type: "runtimeAck" }
  | { type: "ackAmbiguous" }
  | { type: "explicitRejection" }
  | { type: "cancelRequested" }
  | { type: "cancelAck" }
  | { type: "cancelRejected" }
  | { type: "runSettled" }
  | { type: "connectionLost" }
  | { type: "bindingRecoveryRequired" }
  | { type: "canonicalCommitted" }
  | { type: "terminalCommitted" }
  | { type: "commitFailed" }
  | { type: "commitCancelled" }
  | { type: "targetRepaired" }
  | { type: "probeActiveRun" }
  | { type: "probeTerminalRun" }
  | { type: "probeNotAccepted" };

/** §14.5.2 状态迁移表；非法迁移返回 null（调用方忽略）。 */
export function transition(
  state: SharedSendState,
  event: SharedSendEvent,
): SharedSendState | null {
  // durable canonical commit 是最高等级的终态证据。它可以安全收口任何本地
  // in-flight 投影，包括 runtime terminal 已到但 UI 仍停在 running/cancel-pending。
  if (event.type === "terminalCommitted") {
    return "idle";
  }
  switch (state) {
    case "idle":
      return event.type === "send" ? "preparing-context" : null;
    case "preparing-context":
      switch (event.type) {
        case "packagePrepared":
          return "awaiting-acceptance";
        case "lossyProjection":
          return "degraded-context";
        case "targetUnavailable":
          return "target-unavailable";
        case "commitCancelled":
          return "settling";
        default:
          return null;
      }
    case "degraded-context":
      switch (event.type) {
        case "previewConfirmed":
          return "preparing-context";
        case "degradedConfirmed":
          return "awaiting-acceptance";
        case "commitCancelled":
          return "settling";
        default:
          return null;
      }
    case "awaiting-acceptance":
      switch (event.type) {
        case "runtimeAck":
          return "running";
        case "ackAmbiguous":
        case "bindingRecoveryRequired":
          return "recovery-required";
        case "cancelRequested":
          return "cancel-pending";
        case "explicitRejection":
        case "commitCancelled":
          return "settling";
        default:
          return null;
      }
    case "cancel-pending":
      switch (event.type) {
        case "cancelAck":
          return "settling";
        case "ackAmbiguous":
          return "recovery-required";
        case "cancelRejected":
          return "running";
        default:
          return null;
      }
    case "running":
      switch (event.type) {
        case "runSettled":
          return "settling";
        case "connectionLost":
        case "bindingRecoveryRequired":
          return "recovery-required";
        default:
          return null;
      }
    case "settling":
      switch (event.type) {
        case "canonicalCommitted":
          return "idle";
        case "commitFailed":
        case "bindingRecoveryRequired":
          return "recovery-required";
        default:
          return null;
      }
    case "target-unavailable":
      return event.type === "targetRepaired" ? "idle" : null;
    case "recovery-required":
      switch (event.type) {
        case "probeActiveRun":
          return "running";
        case "probeTerminalRun":
          return "settling";
        case "probeNotAccepted":
        case "commitCancelled":
          return "settling";
        default:
          return null;
      }
  }
}

/** Picker 仅在 idle 可用（第一阶段不实现运行中预选 Queue contract）。 */
export function isPickerLocked(state: SharedSendState): boolean {
  return state !== "idle" && state !== "target-unavailable";
}

/** 新 Turn 仅在 idle 可提交，避免破坏 Shared Canonical Thread 的线性顺序。 */
export function isComposerSubmitLocked(state: SharedSendState): boolean {
  return state !== "idle";
}

/** 只有 ACK/ordering 不确定时才锁文本编辑；正常运行期允许提前写下一条草稿。 */
export function isComposerInputLocked(state: SharedSendState): boolean {
  return state === "cancel-pending" || state === "recovery-required";
}

/**
 * Cancel 可用性：`awaiting-acceptance` 且 adapter 支持 cancelPendingDelivery 时可取消；
 * capability 不支持时禁用（调用方负责展示原因）。
 */
export function canCancel(
  state: SharedSendState,
  supportsCancelPendingDelivery: boolean,
): boolean {
  return state === "awaiting-acceptance" && supportsCancelPendingDelivery;
}

export function sharedAdapterCapabilities(
  engine: string | null | undefined,
): { cancelPendingDelivery: boolean } {
  switch (engine) {
    // 当前两条 Shared adapter 都通过阻塞式 request/response bridge 投递，
    // runtime 尚未暴露“ACK 前撤销指定 delivery”的 identity。
    case "claude":
    case "codex":
    default:
      return { cancelPendingDelivery: false };
  }
}

/** ambiguous 期间禁止“一键重发”。 */
export function canRetry(state: SharedSendState): boolean {
  return state === "idle" || state === "target-unavailable";
}
