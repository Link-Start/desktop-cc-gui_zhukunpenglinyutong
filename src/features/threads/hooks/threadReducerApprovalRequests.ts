import type { ApprovalRequest } from "../../../types";

function stableSerializeApprovalValue(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerializeApprovalValue(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableSerializeApprovalValue(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function isSameApprovalRequest(
  left: ApprovalRequest,
  right: ApprovalRequest,
) {
  const leftOwner = left.shared_runtime_owner;
  const rightOwner = right.shared_runtime_owner;
  if (leftOwner || rightOwner) {
    return (
      left.workspace_id === right.workspace_id &&
      left.request_id === right.request_id &&
      leftOwner?.providerRuntimeKey === rightOwner?.providerRuntimeKey &&
      leftOwner?.attemptId === rightOwner?.attemptId
    );
  }
  return (
    left.workspace_id === right.workspace_id &&
    left.request_id === right.request_id &&
    left.method === right.method &&
    stableSerializeApprovalValue(left.params ?? {}) ===
      stableSerializeApprovalValue(right.params ?? {})
  );
}

export function approvalConversationItemId(request: ApprovalRequest): string {
  const attemptId = request.shared_runtime_owner?.attemptId;
  return attemptId
    ? `shared-approval-${attemptId}-${String(request.request_id)}`
    : String(request.request_id);
}
