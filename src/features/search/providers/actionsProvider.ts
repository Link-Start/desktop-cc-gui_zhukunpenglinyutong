import { bestFuzzyMatchScore } from "../ranking/fuzzy";
import type { SearchResult } from "../types";

export type SearchActionDescriptor = {
  id: string;
  title: string;
  subtitle?: string;
  keywords: string[];
  execute: () => void | Promise<void>;
};

export function searchActions(
  query: string,
  actions: SearchActionDescriptor[],
): SearchResult[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return [];
  }
  return actions
    .flatMap((action) => {
      const score = bestFuzzyMatchScore(normalizedQuery, [
        action.title,
        ...action.keywords,
      ]);
      return score === null
        ? []
        : [{
            id: `action:${action.id}`,
            kind: "action" as const,
            title: action.title,
            subtitle: action.subtitle,
            score,
            actionId: action.id,
            sourceKind: "actions" as const,
          }];
    })
    .sort((left, right) => left.score - right.score || left.title.localeCompare(right.title));
}
