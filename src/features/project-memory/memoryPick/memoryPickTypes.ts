import type { ProjectMemoryItem } from "../../../services/tauri";

/** Composer 记忆参考三态（删除 single；读配置时 single → pick） */
export type MemoryPickComposerMode = "off" | "pick" | "always";

/** 兼容历史 MemoryReferenceMode */
export type LegacyMemoryReferenceMode = "off" | "single" | "always" | "pick";

export type MemoryPickPhase =
  | "idle"
  | "retrieving"
  | "awaiting-choice"
  | "flushing"
  | "cancelled";

export type MemoryPickCandidate = {
  id: string;
  title: string;
  summary: string;
  score: number;
  kind?: string;
  importance?: string;
  tags?: string[];
  engine?: string | null;
  threadId?: string | null;
  updatedAt?: number;
  /** 详情 Dialog 懒加载后填充 */
  detail?: string | null;
  rawItem?: ProjectMemoryItem | null;
};

export type MemoryPickSessionPolicy = {
  composerMode: MemoryPickComposerMode;
  firstPickRequired: boolean;
  dismissed: boolean;
  /**
   * 一直开启：用户上次确认时勾选的条数。
   * 下轮按相关分预勾相同数量（可改；默认 ALWAYS_TOP_K）。
   */
  alwaysPreferredCount: number;
};

export type MemoryPickResolution =
  | {
      action: "confirm";
      /** pick / always：用户当前勾选集（always 可自由改数量） */
      selectedIds: string[];
      mode: MemoryPickComposerMode;
    }
  | {
      action: "skip";
      mode: MemoryPickComposerMode;
    }
  | {
      action: "dismiss";
    }
  | {
      action: "cancel";
    };

export type MemoryPickGateUiState = {
  workspaceId: string;
  threadId: string;
  phase: Exclude<MemoryPickPhase, "idle" | "cancelled">;
  queryText: string;
  candidates: MemoryPickCandidate[];
  selectedIds: string[];
  /** 打开闸门时的模式；闸门内可切 pick/always */
  mode: MemoryPickComposerMode;
  error: "timeout" | "retrieve_failed" | null;
  firstPick: boolean;
};

export const PICK_CANDIDATE_LIMIT = 25;
export const ALWAYS_TOP_K = 3;
export const PICK_RETRIEVE_TIMEOUT_MS = 1000;
/** 匹配动画最短展示（ms），避免检索过快导致 UX 闪断 */
export const PICK_MATCH_MIN_DISPLAY_MS = 550;
/** 一直开启：预览展示后客户端倒计时自动确认（ms），可取消 */
export const ALWAYS_AUTO_CONFIRM_MS = 8000;

export function normalizeMemoryPickComposerMode(
  mode: LegacyMemoryReferenceMode | string | null | undefined,
): MemoryPickComposerMode {
  if (mode === "always") return "always";
  if (mode === "pick" || mode === "single") return "pick";
  return "off";
}
