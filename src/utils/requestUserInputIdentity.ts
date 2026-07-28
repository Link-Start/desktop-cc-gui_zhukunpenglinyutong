import type { RequestUserInputRequest } from "../types";

/** JSON-RPC request id 只在所属 Runtime attempt 内唯一。 */
export function requestUserInputIdentityKey(
  request: RequestUserInputRequest,
): string {
  const owner = request.shared_runtime_owner;
  return JSON.stringify([
    request.workspace_id,
    owner?.providerRuntimeKey ?? "native",
    owner?.attemptId ?? "native",
    request.request_id,
  ]);
}

export function isSameRequestUserInput(
  left: RequestUserInputRequest,
  right: RequestUserInputRequest,
): boolean {
  return requestUserInputIdentityKey(left) === requestUserInputIdentityKey(right);
}

export function requestUserInputConversationItemId(
  request: RequestUserInputRequest,
): string {
  const attemptId = request.shared_runtime_owner?.attemptId;
  return attemptId
    ? `user-input-answer-${attemptId}-${String(request.request_id)}`
    : `user-input-answer-${String(request.request_id)}`;
}
