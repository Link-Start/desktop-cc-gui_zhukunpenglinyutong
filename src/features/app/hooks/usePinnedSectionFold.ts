import { useCallback, useState } from "react";
import {
  getClientStoreSync,
  writeClientStoreValue,
} from "../../../services/clientStorage";
import { resolvePinnedDayExpanded } from "../components/pinnedThreadCalendarGroups";

export const PINNED_SECTION_FOLD_STORAGE_KEY = "pinnedSectionFold";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type PinnedSectionFoldState = {
  sectionExpanded: boolean;
  collapsedDays: string[];
  expandedDays: string[];
};

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && DATE_KEY_PATTERN.test(value);
}

function readPinnedSectionFoldState(): PinnedSectionFoldState {
  const stored = getClientStoreSync<Partial<PinnedSectionFoldState>>(
    "layout",
    PINNED_SECTION_FOLD_STORAGE_KEY,
  );
  if (!stored || typeof stored !== "object") {
    return { sectionExpanded: true, collapsedDays: [], expandedDays: [] };
  }
  return {
    sectionExpanded: stored.sectionExpanded !== false,
    collapsedDays: Array.isArray(stored.collapsedDays)
      ? stored.collapsedDays.filter(isDateKey)
      : [],
    expandedDays: Array.isArray(stored.expandedDays)
      ? stored.expandedDays.filter(isDateKey)
      : [],
  };
}

function persistPinnedSectionFoldState(next: PinnedSectionFoldState) {
  writeClientStoreValue("layout", PINNED_SECTION_FOLD_STORAGE_KEY, next);
}

export function usePinnedSectionFold() {
  const [foldState, setFoldState] = useState<PinnedSectionFoldState>(
    readPinnedSectionFoldState,
  );

  const isDayExpanded = useCallback(
    (dateKey: string, latestDateKey: string | null) =>
      resolvePinnedDayExpanded(
        dateKey,
        latestDateKey,
        new Set(foldState.collapsedDays),
        new Set(foldState.expandedDays),
      ),
    [foldState.collapsedDays, foldState.expandedDays],
  );

  const toggleSection = useCallback(() => {
    setFoldState((prev) => {
      const next = {
        ...prev,
        sectionExpanded: !prev.sectionExpanded,
      };
      persistPinnedSectionFoldState(next);
      return next;
    });
  }, []);

  const toggleDay = useCallback(
    (dateKey: string, latestDateKey: string | null) => {
      setFoldState((prev) => {
        const currentlyExpanded = resolvePinnedDayExpanded(
          dateKey,
          latestDateKey,
          new Set(prev.collapsedDays),
          new Set(prev.expandedDays),
        );
        const collapsedDays = new Set(prev.collapsedDays);
        const expandedDays = new Set(prev.expandedDays);
        if (currentlyExpanded) {
          expandedDays.delete(dateKey);
          collapsedDays.add(dateKey);
        } else {
          collapsedDays.delete(dateKey);
          expandedDays.add(dateKey);
        }
        const next = {
          ...prev,
          collapsedDays: Array.from(collapsedDays),
          expandedDays: Array.from(expandedDays),
        };
        persistPinnedSectionFoldState(next);
        return next;
      });
    },
    [],
  );

  const ensureDayExpanded = useCallback(
    (dateKey: string, latestDateKey: string | null) => {
      setFoldState((prev) => {
        if (
          resolvePinnedDayExpanded(
            dateKey,
            latestDateKey,
            new Set(prev.collapsedDays),
            new Set(prev.expandedDays),
          )
        ) {
          return prev;
        }
        const collapsedDays = prev.collapsedDays.filter((day) => day !== dateKey);
        const expandedDays = prev.expandedDays.includes(dateKey)
          ? prev.expandedDays
          : [...prev.expandedDays, dateKey];
        const next = { ...prev, collapsedDays, expandedDays };
        persistPinnedSectionFoldState(next);
        return next;
      });
    },
    [],
  );

  return {
    isSectionExpanded: foldState.sectionExpanded,
    isDayExpanded,
    toggleSection,
    toggleDay,
    ensureDayExpanded,
  };
}
