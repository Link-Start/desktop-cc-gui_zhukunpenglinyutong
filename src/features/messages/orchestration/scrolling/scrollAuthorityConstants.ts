/**
 * 幕布滚动所有权 — 可编码常量（OpenSpec / DESIGN §4.4）。
 * 调整数值须同步 openspec change 与设计文档，禁止魔法数散落 controller。
 */

import {
  CODEX_FINALIZING_LIVE_WINDOW_MS,
  SETTLE_REPIN_WINDOW_MS,
} from "../../constants/messagesConstants";

/** 工程真底：distanceToBottom ≤ 此值即贴底完成态 */
export const TRUE_BOTTOM_EPSILON_PX = 1;

/**
 * 仅用于「是否 re-arm 连续 follow」的宽松近底启发式。
 * 不得当作回合结束 / forced 退役的真底验收。
 */
export const FOLLOW_REARM_THRESHOLD_PX = 120;

/** 明确上滚：单次 |deltaY| 下限（滤微抖/噪声） */
export const USER_SCROLL_MIN_DELTA_Y = 4;

/** 明确上滚：累计向上位移阈值 */
export const USER_SCROLL_ACCUM_UP_PX = 40;

/** 累计上滚观测窗 */
export const USER_SCROLL_ACCUM_WINDOW_MS = 320;

/** 用户输入租约（与历史 USER_SCROLL_INTENT_GRACE 同量级） */
export const USER_INPUT_LEASE_MS = 500;

/** WriteTicket applied scrollTop ring 容量 */
export const TICKET_APPLIED_RING_SIZE = 8;

/**
 * forced 最短保持：必须盖住
 * - SETTLE_REPIN / deferred 尾窗回全量（~2.4s）
 * - Claude/Codex finalizing 最长窗（Codex 6s；Claude 仅 320ms 被盖住）
 * 禁止在假稳高度上提前退役。用户明确上滚仍可打断 forced。
 */
export const MIN_FORCED_HOLD_MS = Math.max(
  SETTLE_REPIN_WINDOW_MS,
  CODEX_FINALIZING_LIVE_WINDOW_MS,
);

/**
 * forced 安全阀：须 ≥ MIN_FORCED_HOLD，到点仍未稳态则最后 pin 并退役。
 */
export const SAFETY_TIMEOUT_FORCED_MS = Math.max(8_000, MIN_FORCED_HOLD_MS + 2_000);

/** 高度不变观测窗 */
export const STABLE_HEIGHT_WINDOW_MS = 150;

/** 窗内至少连续一致采样次数 */
export const STABLE_HEIGHT_MIN_SAMPLES = 3;

/** forced/stick 下 scrollTop 写入软上限（Hz） */
export const MAX_STICK_WRITE_HZ = 30;

/** 程序回声位置容差（px） */
export const TICKET_SCROLL_MATCH_TOLERANCE_PX = 1;
