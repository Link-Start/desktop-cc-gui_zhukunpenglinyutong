import type { EngineType } from "../../../types";

let pendingExplicitEngine: EngineType | null = null;

export function markExplicitComposerEngineSwitch(engine: EngineType): void {
  pendingExplicitEngine = engine;
}

export function peekExplicitComposerEngineSwitch(): EngineType | null {
  return pendingExplicitEngine;
}

export function consumeExplicitComposerEngineSwitch(): EngineType | null {
  const engine = pendingExplicitEngine;
  pendingExplicitEngine = null;
  return engine;
}

export function resetExplicitComposerEngineSwitchForTests(): void {
  pendingExplicitEngine = null;
}

type ShouldSpawnNativeThreadForEngineMismatchInput = {
  threadEngine: EngineType;
  currentEngine: EngineType;
  threadIdCompatible: boolean;
  explicitEngine: EngineType | null;
};

/**
 * Native 续聊默认锁在当前 thread。只有本轮消费到的显式引擎组切换
 * 与 `currentEngine` 一致时，才允许 `startThreadForMessageSend`。
 */
export function shouldSpawnNativeThreadForEngineMismatch({
  threadEngine,
  currentEngine,
  threadIdCompatible,
  explicitEngine,
}: ShouldSpawnNativeThreadForEngineMismatchInput): boolean {
  if (threadEngine === currentEngine && threadIdCompatible) {
    return false;
  }
  return explicitEngine === currentEngine;
}
