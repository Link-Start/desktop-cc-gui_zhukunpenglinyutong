import type { EngineType, ThreadTokenUsage } from "../../types";

export type EngineTaskOutputEngine = EngineType;

export type EngineTaskOutputStatus =
  | "running"
  | "completed"
  | "error"
  | "unavailable";

export type EngineTaskOutputTelemetryStatus =
  | "live"
  | "estimated"
  | "pending"
  | "unavailable";

export type EngineTaskOutputSource = {
  id: string;
  engine: EngineTaskOutputEngine;
  title: string;
  description?: string | null;
  status: EngineTaskOutputStatus;
  taskId?: string | null;
  toolUseId?: string | null;
  threadId?: string | null;
  outputFileName?: string | null;
  outputFilePath?: string | null;
  recentOutput?: string | null;
};

export type EngineTaskOutputSnapshot = EngineTaskOutputSource & {
  description: string;
  taskId: string | null;
  toolUseId: string | null;
  threadId: string | null;
  outputFileName: string | null;
  outputFilePath: string | null;
  recentOutput: string | null;
  tokenUsage: ThreadTokenUsage | null;
  telemetryStatus: EngineTaskOutputTelemetryStatus;
};

export type EngineTaskOutputArtifactRefreshState = {
  isRefreshing: boolean;
  lastRefreshedAt: number | null;
  error: string | null;
  truncated: boolean;
  source: "snapshot" | "artifact" | "unavailable";
};
