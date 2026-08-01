/**
 * 幕布滚动所有权 — 类型（DESIGN §3.2–3.5）。
 */

export type ViewportMode =
  | "stick-bottom"
  | "free"
  | "forced-bottom"
  | "jump-anchor"
  | "history-head";

export type ScrollOwner = "none" | "stick" | "forced" | "jump" | "explicit";

export type ScrollAuthorityIntent =
  | { type: "turn-send" }
  | { type: "turn-settle" }
  | { type: "open-thread" }
  | { type: "explicit-bottom" }
  | { type: "explicit-top" }
  | { type: "reveal-history-manual" }
  | { type: "jump-to-message"; messageId: string }
  | { type: "focus-follow-on" }
  | { type: "focus-follow-off" }
  | {
      type: "user-scroll";
      /** wheel deltaY；上滚为负 */
      deltaY?: number;
      /** 是否来自明确按键/触控/拖条（非微 wheel） */
      explicitSource?: "wheel" | "key" | "touch" | "pointer";
      /** 当前是否仍在宽松近底（FOLLOW_REARM） */
      nearBottomForRearm?: boolean;
    }
  | { type: "scope-switch" };

export type GeometryDeltaKind =
  | "content-grow"
  | "content-shrink"
  | "measure-late"
  | "chrome-resize"
  | "media-load"
  | "hydrate-detail"
  | "phase-static"
  | "phase-virtual"
  | "finalizing-presentation"
  | "scope-switch"
  | "observe";

export type GeometryDelta = {
  kind: GeometryDeltaKind;
  scrollHeight: number;
  clientHeight: number;
  maxScrollTop: number;
  scrollTop: number;
  phase: "static" | "virtual";
  scopeGeneration: number;
  /** 已知未完成的 virtual remeasure 计数 */
  pendingVirtualRemeasureCount?: number;
  phaseDesired?: "static" | "virtual";
  pendingMediaLoads?: number;
  finalizingPresentationActive?: boolean;
  source?: string;
};

export type WriteTicket = {
  id: string;
  owner: Exclude<ScrollOwner, "none">;
  edge: "bottom" | "top" | { messageId: string };
  motion: "instant" | "smooth";
  generation: number;
  issuedAt: number;
  safetyTimeoutAt: number;
  appliedScrollTops: number[];
};

export type GeometryStabilitySnapshot = {
  lastScrollHeight: number;
  lastScrollHeightChangeAt: number;
  sameHeightSampleCount: number;
  pendingVirtualRemeasureCount: number;
  phase: "static" | "virtual";
  phaseDesired: "static" | "virtual";
  pendingMediaLoads: number;
  finalizingPresentationActive: boolean;
};

export type ScrollAuthorityState = {
  mode: ViewportMode;
  liveAutoFollowEnabled: boolean;
  scopeGeneration: number;
  ticket: WriteTicket | null;
  geometry: GeometryStabilitySnapshot;
  /** 累计上滚（明确性） */
  accumUpPx: number;
  accumUpWindowStartedAt: number | null;
  lastReasonCode: string | null;
};

export type ScrollAuthorityDecision = {
  state: ScrollAuthorityState;
  /** 是否请求 Actuator 即时贴底 */
  requestBottomPin: boolean;
  /** 是否请求贴顶 */
  requestTopPin: boolean;
  reasonCode: string | null;
};

export type ForcedRetireKind = "stable" | "safety-timeout" | "hold";
