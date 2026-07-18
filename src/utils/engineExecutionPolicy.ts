import type { EngineType } from "../types";

export type ExecutableEngineType = Exclude<EngineType, "gemini">;

export const GEMINI_EXECUTION_DISABLED_MESSAGE =
  "Gemini CLI is disabled in this client";

export function isEngineExecutionEnabled(
  engine: unknown,
): engine is ExecutableEngineType {
  return engine === "codex" || engine === "claude" || engine === "opencode";
}

export function assertEngineExecutionEnabled(
  engine: unknown,
): asserts engine is ExecutableEngineType {
  if (!isEngineExecutionEnabled(engine)) {
    throw new Error(GEMINI_EXECUTION_DISABLED_MESSAGE);
  }
}

export function normalizeEngineForExecution(
  engine: unknown,
  fallback: ExecutableEngineType = "codex",
): ExecutableEngineType {
  return isEngineExecutionEnabled(engine) ? engine : fallback;
}
