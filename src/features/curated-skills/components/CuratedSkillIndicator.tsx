import { useEffect, useMemo, useState } from "react";
import { getCuratedSkills, getEnabledCuratedSkillIds } from "../../../services/tauri";
import { setVisibilityGatedInterval } from "../../../services/visibilityGatedInterval";
import { subscribeCuratedSkillsChanged } from "../utils/curatedSkillsEvents";
import { resolveLucideIcon, FALLBACK_ICON } from "../utils/resolveLucideIcon";
import type { CuratedSkillOption } from "../../../types";

/**
 * Read-only indicator that surfaces which curated skills are currently
 * active for the conversation. Renders nothing when zero skills are
 * enabled so the indicator costs zero visual weight by default.
 *
 * Visual contract: a compact row of one chip per always-on curated
 * skill, showing only the lucide icon + display name. Token counts and
 * totals were intentionally removed: the chip is a declarative
 * "this skill is in effect" affordance, not a budget readout, and
 * keeping the chips to name-only avoids competing with the context
 * token indicator elsewhere in the composer.
 *
 * **Refresh model: event-driven, not polled.** `AppSettings` is a
 * per-component `useState` cache; the Settings view and the composer
 * each hold their own snapshot and are not wired together. Instead of
 * a per-second poll, the backend emits `curated-skills-changed` after
 * every successful toggle and this component re-fetches on that event.
 * A slow visibility-gated interval (`FALLBACK_REFRESH_MS`) remains only
 * as a safety net for missed events.
 */
const FALLBACK_REFRESH_MS = 60_000;

type CuratedSkillIndicatorProps = {
  /**
   * Click handler forwarded by the composer tree. Wired from
   * `useAppShellLayoutNodesSection` via prop drilling. When omitted
   * (e.g. in tests or storybook), the chip falls back to a static
   * "read-only" indicator with no click behavior.
   */
  onOpenSkillsSettings?: () => void;
};

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function areCuratedSkillListsEqual(
  left: CuratedSkillOption[],
  right: CuratedSkillOption[],
) {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (
      !a ||
      !b ||
      a.name !== b.name ||
      a.displayName !== b.displayName ||
      a.icon !== b.icon
    ) {
      return false;
    }
  }
  return true;
}

export function CuratedSkillIndicator({
  onOpenSkillsSettings,
}: CuratedSkillIndicatorProps = {}) {
  const [enabledIds, setEnabledIds] = useState<string[]>([]);
  const [skills, setSkills] = useState<CuratedSkillOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const [ids, entries] = await Promise.all([
          getEnabledCuratedSkillIds(),
          getCuratedSkills(),
        ]);
        if (cancelled) return;
        // 内容未变时保留旧引用，避免每次轮询都强制重渲染常驻的 composer 叶子。
        setEnabledIds((prev) =>
          areStringArraysEqual(prev, ids ?? []) ? prev : (ids ?? []),
        );
        setSkills((prev) =>
          areCuratedSkillListsEqual(prev, entries ?? []) ? prev : (entries ?? []),
        );
      } catch {
        // Best-effort: a failed poll leaves the previous values in
        // place. The next successful tick will overwrite them.
      }
    };

    void tick();
    const unsubscribe = subscribeCuratedSkillsChanged(() => {
      void tick();
    });
    // 事件通道遗漏时的兜底收敛：60s 可见性门控慢轮询，恢复可见时立即补一次。
    const cleanupInterval = setVisibilityGatedInterval(() => {
      void tick();
    }, FALLBACK_REFRESH_MS);

    return () => {
      cancelled = true;
      unsubscribe();
      cleanupInterval();
    };
  }, []);

  const enabledSet = useMemo(() => new Set(enabledIds), [enabledIds]);
  const enabledSkills = useMemo(
    () => skills.filter((s) => enabledSet.has(s.name)),
    [skills, enabledSet],
  );

  if (enabledSkills.length === 0) {
    return null;
  }

  const tooltip = enabledSkills
    .map((s) => s.displayName)
    .join(", ");

  const visible = enabledSkills.slice(0, 2);
  const overflow = enabledSkills.length - visible.length;

  return (
    <div
      className="curated-indicator curated-indicator-top"
      data-testid="curated-indicator"
      data-count={enabledSkills.length}
      role="status"
      aria-live="polite"
      title={tooltip}
    >
      {visible.map((entry) => {
        const Icon = resolveLucideIcon(entry.icon) ?? FALLBACK_ICON;
        const label = `${entry.displayName} — open Skills settings`;
        if (onOpenSkillsSettings) {
          return (
            <button
              key={entry.name}
              type="button"
              className="curated-indicator-chip curated-indicator-chip-button"
              data-testid={`curated-indicator-chip-${entry.name}`}
              aria-label={label}
              title={label}
              onClick={onOpenSkillsSettings}
            >
              <span className="curated-indicator-chip-icon" aria-hidden>
                <Icon />
              </span>
              <span className="curated-indicator-chip-name">
                {entry.displayName}
              </span>
            </button>
          );
        }
        return (
          <span
            key={entry.name}
            className="curated-indicator-chip"
            data-testid={`curated-indicator-chip-${entry.name}`}
            title={label}
          >
            <span className="curated-indicator-chip-icon" aria-hidden>
              <Icon />
            </span>
            <span className="curated-indicator-chip-name">
              {entry.displayName}
            </span>
          </span>
        );
      })}
      {overflow > 0 ? (
        <span
          className="curated-indicator-overflow"
          data-testid="curated-indicator-overflow"
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
