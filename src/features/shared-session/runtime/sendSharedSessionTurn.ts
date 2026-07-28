import type { SharedSessionSupportedEngine } from "../utils/sharedSessionEngines";
import {
  sendSharedSessionMessage,
  setSharedSessionSelectedEngine,
} from "../services/sharedSessions";
import {
  isResolvedExecutionTarget,
  type ExecutionTarget,
} from "../target/types";
import {
  registerSharedSessionNativeBinding,
  rebindSharedSessionNativeThread,
} from "./sharedSessionBridge";
import { sendSharedSessionTurnV2 } from "./sendSharedSessionTurnV2";
import { isSharedV2SendEnabled } from "./sharedV2SendFlag";

export type SendSharedSessionTurnInput = {
  workspaceId: string;
  threadId: string;
  engine: SharedSessionSupportedEngine;
  text: string;
  model: string | null;
  effort: string | null;
  disableThinking?: boolean | null;
  accessMode?: "default" | "read-only" | "current" | "full-access";
  images: string[];
  collaborationMode?: Record<string, unknown> | null;
  preferredLanguage?: string | null;
  customSpecRoot?: string | null;
  /**
   * Frontend-only admission identity。只在 Shared V2 Composer 提前取得发送权时使用，
   * 不跨 Tauri/Runtime boundary。
   */
  sharedSendAdmissionRevision?: number;
};

export async function sendSharedSessionTurn(input: SendSharedSessionTurnInput) {
  const selection = await setSharedSessionSelectedEngine(
    input.workspaceId,
    input.threadId,
    input.engine,
  );
  const selectedNativeThreadId =
    typeof selection?.nativeThreadId === "string" ? selection.nativeThreadId.trim() : "";
  if (selectedNativeThreadId) {
    registerSharedSessionNativeBinding({
      workspaceId: input.workspaceId,
      sharedThreadId: input.threadId,
      nativeThreadId: selectedNativeThreadId,
      engine: input.engine,
    });
  }
  const response = await sendSharedSessionMessage(
    input.workspaceId,
    input.threadId,
    input.engine,
    input.text,
    {
      model: input.model,
      effort: input.effort,
      disableThinking: input.disableThinking,
      collaborationMode: input.collaborationMode,
      accessMode: input.accessMode,
      images: input.images,
      preferredLanguage: input.preferredLanguage,
      customSpecRoot: input.customSpecRoot,
    },
  );
  const nativeThreadId =
    typeof response?.nativeThreadId === "string" ? response.nativeThreadId.trim() : "";
  if (nativeThreadId) {
    const shouldRebindSelectedThread =
      selectedNativeThreadId &&
      selectedNativeThreadId !== nativeThreadId &&
      selectedNativeThreadId.startsWith(`${input.engine}-pending-shared-`);
    if (shouldRebindSelectedThread) {
      const rebound = rebindSharedSessionNativeThread({
        workspaceId: input.workspaceId,
        oldNativeThreadId: selectedNativeThreadId,
        newNativeThreadId: nativeThreadId,
      });
      if (!rebound) {
        registerSharedSessionNativeBinding({
          workspaceId: input.workspaceId,
          sharedThreadId: input.threadId,
          nativeThreadId,
          engine: input.engine,
        });
      }
    } else {
      registerSharedSessionNativeBinding({
        workspaceId: input.workspaceId,
        sharedThreadId: input.threadId,
        nativeThreadId,
        engine: input.engine,
      });
    }
  }
  return response;
}

/**
 * Wave 4 / Change B 路由入口：flag 开启走 V2（begin → send → commit），
 * 关闭走 V0。V2 必须收到 Picker 已解析并持久化的完整 `input.target`；
 * 禁止用 legacy flat engine/model/effort 拼出 provider=null 的伪 Target。
 * V0 导出保持不变，用于回滚。
 */
export async function sendSharedSessionTurnRouted(
  input: SendSharedSessionTurnInput & { target?: ExecutionTarget },
) {
  if (!isSharedV2SendEnabled()) {
    return sendSharedSessionTurn(input);
  }
  if (!isResolvedExecutionTarget(input.target)) {
    throw new Error(
      "shared-v2-target-incomplete: 请先选择完整的 CLI、Provider 和 Model。",
    );
  }
  return sendSharedSessionTurnV2({ ...input, target: input.target });
}
