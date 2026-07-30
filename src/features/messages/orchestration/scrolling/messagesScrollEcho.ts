/**
 * 程序化滚动回声判定。
 *
 * WebKit 的 scroll 事件异步派发：收敛 run 结束或几何塌缩（虚拟化翻开 / live 尾窗
 * 裁剪）后，迟到的钳位/中间帧事件才送达。此刻 activeProgrammaticEdge 已被清空，
 * 若不加以区分，这些布局噪声会被误判成「用户主动上滚」，解除跟随并杀掉后续收敛。
 *
 * 判定规则：
 * - 明确 user intent 永远优先，不得被 fingerprint 覆盖。
 * - 有活跃程序化 run：命中当前 scope 的指纹环即回声。
 * - 无活跃 run：只有命中的那条 fingerprint 仍在 grace 内才豁免。
 * - 其余情况：交给调用方按真实用户滚动处理。
 */

export const PROGRAMMATIC_SCROLL_ECHO_GRACE_MS = 350;
export const PROGRAMMATIC_SCROLL_ECHO_TOLERANCE_PX = 2;
export const USER_SCROLL_INTENT_GRACE_MS = 500;

export type ProgrammaticScrollFingerprint = {
  recordedAt: number;
  scrollTop: number;
  source: "clamp" | "write";
};

export type ScrollGeometrySnapshot = {
  maxScrollTop: number;
  scrollTop: number;
};

export function isProgrammaticScrollEcho(input: {
  hasActiveProgrammaticRun: boolean;
  hasRecentUserScrollIntent: boolean;
  eventScrollTop: number;
  echoFingerprints: readonly ProgrammaticScrollFingerprint[];
  tolerancePx: number;
  now: number;
  graceMs?: number;
}): boolean {
  const {
    hasActiveProgrammaticRun,
    hasRecentUserScrollIntent,
    eventScrollTop,
    echoFingerprints,
    tolerancePx,
    now,
    graceMs = PROGRAMMATIC_SCROLL_ECHO_GRACE_MS,
  } = input;
  if (hasRecentUserScrollIntent) {
    return false;
  }
  return echoFingerprints.some((fingerprint) => {
    if (Math.abs(fingerprint.scrollTop - eventScrollTop) > tolerancePx) {
      return false;
    }
    const ageMs = now - fingerprint.recordedAt;
    return hasActiveProgrammaticRun || (ageMs >= 0 && ageMs <= graceMs);
  });
}

export function recordProgrammaticScrollFingerprint(
  fingerprints: ProgrammaticScrollFingerprint[],
  fingerprint: ProgrammaticScrollFingerprint,
  limit: number,
) {
  const existingIndex = fingerprints.findIndex(
    (candidate) =>
      candidate.scrollTop === fingerprint.scrollTop &&
      candidate.source === fingerprint.source,
  );
  if (existingIndex !== -1) {
    fingerprints.splice(existingIndex, 1);
  }
  fingerprints.push(fingerprint);
  if (fingerprints.length > limit) {
    fingerprints.splice(0, fingerprints.length - limit);
  }
}

export function isRecentUserScrollIntent(
  recordedAt: number | null,
  now: number,
  graceMs = USER_SCROLL_INTENT_GRACE_MS,
) {
  if (recordedAt === null) {
    return false;
  }
  const ageMs = now - recordedAt;
  return ageMs >= 0 && ageMs <= graceMs;
}

export function isScrollIntentKey(key: string) {
  return (
    key === "ArrowUp" ||
    key === "ArrowDown" ||
    key === "PageUp" ||
    key === "PageDown" ||
    key === "Home" ||
    key === "End" ||
    key === " " ||
    key === "Spacebar"
  );
}

/**
 * 浏览器在内容高度塌缩时会把越界的 scrollTop 钳位到新的最大值。只有前后 geometry
 * 能证明「范围收缩 + 旧位置越界 + 当前落在新最大值」时，才把它视为 clamp evidence。
 */
export function readScrollGeometrySnapshot(
  container: Pick<HTMLElement, "clientHeight" | "scrollHeight" | "scrollTop">,
): ScrollGeometrySnapshot {
  return {
    maxScrollTop: Math.max(0, container.scrollHeight - container.clientHeight),
    scrollTop: container.scrollTop,
  };
}

export function resolveClampedScrollTop(
  previous: ScrollGeometrySnapshot | null,
  current: ScrollGeometrySnapshot,
  tolerancePx: number,
): number | null {
  if (
    !previous ||
    current.maxScrollTop >= previous.maxScrollTop - tolerancePx ||
    previous.scrollTop <= current.maxScrollTop + tolerancePx ||
    Math.abs(current.scrollTop - current.maxScrollTop) > tolerancePx
  ) {
    return null;
  }
  return current.scrollTop;
}
