import type { EngineStatus, EngineType } from "../../../types";

export const WEB_RUNTIME_DEFAULT_ENGINE: EngineType = "codex";

export const WEB_RUNTIME_INITIAL_STATUSES: EngineStatus[] = [
  {
    engineType: "codex",
    installed: true,
    version: "web-service",
    binPath: null,
    features: {
      streaming: true,
      reasoning: true,
      toolUse: true,
      imageInput: true,
      sessionContinuation: true,
    },
    models: [],
    error: null,
  },
];
