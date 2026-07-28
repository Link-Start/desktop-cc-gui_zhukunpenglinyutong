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
  | { type: "degradedConfirmed" }
  | { type: "runtimeAck" }
  | { type: "ackAmbiguous" }
  | { type: "explicitRejection" }
  | { type: "cancelRequested" }
  | { type: "cancelAck" }
  | { type: "cancelRejected" }
  | { type: "runSettled" }
  | { type: "connectionLost" }
  | { type: "canonicalCommitted" }
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
          return "recovery-required";
        default:
          return null;
      }
    case "settling":
      switch (event.type) {
        case "canonicalCommitted":
          return "idle";
        case "commitFailed":
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

/** Composer 仅在 idle 可发送。 */
export function isComposerLocked(state: SharedSendState): boolean {
  return state !== "idle";
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
