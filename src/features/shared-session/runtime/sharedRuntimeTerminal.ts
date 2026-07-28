import { subscribeAppServerEvents } from "../../../services/events";
import type { AppServerEvent } from "../../../types";

const SHARED_RUNTIME_SETTLEMENT_TIMEOUT_MS = 30 * 60 * 1_000;

export type SharedRuntimeTerminal = {
  type: "run.settled";
  outcome: "completed" | "failed" | "cancelled";
  assistantText: string | null;
};

type RuntimeOwner = {
  nativeThreadId: string;
  runtimeTurnId: string | null;
};

type BufferedTerminal = RuntimeOwner & {
  terminal: SharedRuntimeTerminal;
};

type ContextAckOwner = {
  packageId: string;
  sourceChecksum: string;
};

function runtimeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseCompletedAssistantText(
  event: AppServerEvent,
): { nativeThreadId: string; text: string } | null {
  if (runtimeString(event.message.method) !== "item/completed") {
    return null;
  }
  const params =
    event.message.params && typeof event.message.params === "object"
      ? (event.message.params as Record<string, unknown>)
      : {};
  const item =
    params.item && typeof params.item === "object"
      ? (params.item as Record<string, unknown>)
      : {};
  const kind = runtimeString(item.type ?? item.kind);
  if (kind !== "agentMessage" && kind !== "message") {
    return null;
  }
  const role = runtimeString(item.role);
  if (role && role !== "assistant") {
    return null;
  }
  const nativeThreadId = runtimeString(params.threadId ?? params.thread_id);
  const text = runtimeString(item.text ?? item.content);
  return nativeThreadId && text ? { nativeThreadId, text } : null;
}

function parseTerminal(event: AppServerEvent): BufferedTerminal | null {
  const method = runtimeString(event.message.method);
  if (method !== "turn/completed" && method !== "turn/error") {
    return null;
  }
  const params =
    event.message.params && typeof event.message.params === "object"
      ? (event.message.params as Record<string, unknown>)
      : {};
  const turn =
    params.turn && typeof params.turn === "object"
      ? (params.turn as Record<string, unknown>)
      : {};
  const result =
    params.result && typeof params.result === "object"
      ? (params.result as Record<string, unknown>)
      : {};
  const nativeThreadId = runtimeString(
    params.threadId ?? params.thread_id ?? turn.threadId ?? turn.thread_id,
  );
  if (!nativeThreadId) {
    return null;
  }
  const runtimeTurnId =
    runtimeString(params.turnId ?? params.turn_id ?? turn.id) || null;
  const status = runtimeString(params.status ?? turn.status).toLowerCase();
  const assistantText =
    [
      params.text,
      result.text,
      result.output_text,
      result.outputText,
      result.content,
    ].find((value) => typeof value === "string" && value.trim()) ?? null;
  return {
    nativeThreadId,
    runtimeTurnId,
    terminal: {
      type: "run.settled",
      outcome:
        status === "cancelled" || status === "canceled"
          ? "cancelled"
          : method === "turn/completed"
            ? "completed"
            : "failed",
      assistantText: typeof assistantText === "string" ? assistantText : null,
    },
  };
}

function parseClaudeContextEcho(event: AppServerEvent): string | null {
  if (runtimeString(event.message.method) !== "claude/raw") {
    return null;
  }
  const params =
    event.message.params && typeof event.message.params === "object"
      ? (event.message.params as Record<string, unknown>)
      : {};
  if (params.isReplay !== true && params.is_replay !== true) {
    return null;
  }
  const message =
    params.message && typeof params.message === "object"
      ? (params.message as Record<string, unknown>)
      : {};
  const content = message.content;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return null;
  }
  return content
    .map((block) =>
      block && typeof block === "object"
        ? runtimeString((block as Record<string, unknown>).text)
        : "",
    )
    .join("");
}

function contextMarker(owner: ContextAckOwner): string {
  return `MOSSX_CONTEXT_PACKAGE:${owner.packageId}:${owner.sourceChecksum}`;
}

function isOwnedBy(terminal: BufferedTerminal, owner: RuntimeOwner): boolean {
  return (
    terminal.nativeThreadId === owner.nativeThreadId &&
    (!owner.runtimeTurnId ||
      !terminal.runtimeTurnId ||
      terminal.runtimeTurnId === owner.runtimeTurnId)
  );
}

/**
 * 必须在 `turn/start` 前创建，避免快速 terminal 先于 RPC response 返回。
 * 只旁路观察 critical terminal，不接管现有 realtime 渲染消费链。
 */
export function captureSharedRuntimeTerminal(workspaceId: string): {
  waitFor(owner: RuntimeOwner): Promise<SharedRuntimeTerminal>;
  waitForContext(owner: ContextAckOwner): Promise<void>;
  dispose(): void;
} {
  const buffered: BufferedTerminal[] = [];
  const assistantTextByThread = new Map<string, string>();
  let pending:
    | {
        owner: RuntimeOwner;
        resolve: (terminal: SharedRuntimeTerminal) => void;
        reject: (error: Error) => void;
        timeoutId: number;
      }
    | null = null;
  const bufferedContextEchoes: string[] = [];
  let pendingContext:
    | {
        owner: ContextAckOwner;
        resolve: () => void;
        reject: (error: Error) => void;
        timeoutId: number;
      }
    | null = null;
  const unsubscribe = subscribeAppServerEvents((event) => {
    if (event.workspace_id !== workspaceId) {
      return;
    }
    const contextEcho = parseClaudeContextEcho(event);
    if (contextEcho) {
      if (
        pendingContext &&
        contextEcho.includes(contextMarker(pendingContext.owner))
      ) {
        window.clearTimeout(pendingContext.timeoutId);
        const resolve = pendingContext.resolve;
        pendingContext = null;
        resolve();
      } else {
        bufferedContextEchoes.push(contextEcho);
      }
    }
    const completedAssistant = parseCompletedAssistantText(event);
    if (completedAssistant) {
      assistantTextByThread.set(
        completedAssistant.nativeThreadId,
        completedAssistant.text,
      );
      return;
    }
    const terminal = parseTerminal(event);
    if (!terminal) {
      return;
    }
    terminal.terminal.assistantText ??= assistantTextByThread.get(
      terminal.nativeThreadId,
    ) ?? null;
    assistantTextByThread.delete(terminal.nativeThreadId);
    if (pending && isOwnedBy(terminal, pending.owner)) {
      window.clearTimeout(pending.timeoutId);
      const resolve = pending.resolve;
      pending = null;
      resolve(terminal.terminal);
      return;
    }
    buffered.push(terminal);
  });

  return {
    waitFor(owner) {
      const bufferedIndex = buffered.findIndex((terminal) =>
        isOwnedBy(terminal, owner),
      );
      if (bufferedIndex >= 0) {
        const terminal = buffered.splice(bufferedIndex, 1)[0];
        return Promise.resolve(terminal.terminal);
      }
      return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          pending = null;
          reject(new Error("Shared runtime 等待 run.settled 超时"));
        }, SHARED_RUNTIME_SETTLEMENT_TIMEOUT_MS);
        pending = { owner, resolve, reject, timeoutId };
      });
    },
    waitForContext(owner) {
      const marker = contextMarker(owner);
      const bufferedIndex = bufferedContextEchoes.findIndex((echo) =>
        echo.includes(marker),
      );
      if (bufferedIndex >= 0) {
        bufferedContextEchoes.splice(bufferedIndex, 1);
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          pendingContext = null;
          reject(new Error("Shared runtime 等待 context checksum echo 超时"));
        }, SHARED_RUNTIME_SETTLEMENT_TIMEOUT_MS);
        pendingContext = { owner, resolve, reject, timeoutId };
      });
    },
    dispose() {
      unsubscribe();
      if (pending) {
        window.clearTimeout(pending.timeoutId);
        pending.reject(new Error("Shared runtime terminal 监听已关闭"));
        pending = null;
      }
      if (pendingContext) {
        window.clearTimeout(pendingContext.timeoutId);
        pendingContext.reject(new Error("Shared runtime context ACK 监听已关闭"));
        pendingContext = null;
      }
      buffered.length = 0;
      bufferedContextEchoes.length = 0;
      assistantTextByThread.clear();
    },
  };
}
