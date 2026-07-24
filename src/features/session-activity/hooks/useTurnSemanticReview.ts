import { useEffect, useMemo, useState } from "react";
import type { SemanticDiffEntry, TurnSemanticReview } from "../../git/utils/semanticDiffSummary";
import { requestTurnSemanticReview } from "../utils/turnSemanticReview";

// module 级 per-turn cache:null 同样缓存(失败/降级结果不重复调用)
const reviewCache = new Map<string, TurnSemanticReview | null>();
const pendingRequests = new Map<string, Promise<TurnSemanticReview | null>>();
const MAX_CACHE_ENTRIES = 100;

function hashReviewInput(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${value.length}-${(hash >>> 0).toString(16)}`;
}

function buildReviewCacheKey(options: {
  workspaceId: string | null;
  turnKey: string;
  entries: SemanticDiffEntry[];
  language: string;
}): string {
  const serializedInput = JSON.stringify({
    language: options.language,
    entries: options.entries.map((entry) => ({
      path: entry.path,
      status: entry.status,
      diff: entry.diff ?? "",
      isImage: Boolean(entry.isImage),
    })),
  });
  return `${options.workspaceId ?? "no-workspace"}:${options.turnKey}:${hashReviewInput(serializedInput)}`;
}

function readCache(cacheKey: string): TurnSemanticReview | null | undefined {
  if (!reviewCache.has(cacheKey)) {
    return undefined;
  }
  return reviewCache.get(cacheKey) ?? null;
}

function writeCache(cacheKey: string, review: TurnSemanticReview | null) {
  if (reviewCache.has(cacheKey)) {
    reviewCache.delete(cacheKey);
  }
  reviewCache.set(cacheKey, review);
  while (reviewCache.size > MAX_CACHE_ENTRIES) {
    const oldest = reviewCache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    reviewCache.delete(oldest);
  }
}

// 同 key 的 in-flight 请求共享,避免多组件实例/重复渲染触发重复调用
function getOrStartRequest(
  cacheKey: string,
  options: { workspaceId: string; entries: SemanticDiffEntry[]; language: string },
): Promise<TurnSemanticReview | null> {
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }
  const request = requestTurnSemanticReview(options)
    .catch(() => null)
    .then((review) => {
      writeCache(cacheKey, review);
      pendingRequests.delete(cacheKey);
      return review;
    });
  pendingRequests.set(cacheKey, request);
  return request;
}

export type UseTurnSemanticReviewOptions = {
  enabled: boolean;
  workspaceId: string | null;
  turnKey: string;
  entries: SemanticDiffEntry[];
  language: string;
};

export type UseTurnSemanticReviewResult = {
  review: TurnSemanticReview | null;
  isGenerating: boolean;
};

type ReviewState = {
  cacheKey: string;
  review: TurnSemanticReview | null;
  isGenerating: boolean;
};

// 按需生成 turn 级 AI review:enabled(用户点开 semantic tab)且无 cache 时触发一次,
// 完成后 event-driven setState;失败静默降级为 review = null
export function useTurnSemanticReview(
  options: UseTurnSemanticReviewOptions,
): UseTurnSemanticReviewResult {
  const { enabled, workspaceId, turnKey, entries, language } = options;
  const cacheKey = buildReviewCacheKey({ workspaceId, turnKey, entries, language });
  const [state, setState] = useState<ReviewState>(() => {
    const cached = readCache(cacheKey);
    return {
      cacheKey,
      review: cached ?? null,
      isGenerating: false,
    };
  });

  useEffect(() => {
    const cached = readCache(cacheKey);
    if (cached !== undefined) {
      setState((current) =>
        current.cacheKey === cacheKey && current.review === cached && !current.isGenerating
          ? current
          : { cacheKey, review: cached, isGenerating: false },
      );
      return;
    }
    if (!enabled || !workspaceId || entries.length === 0) {
      setState((current) =>
        current.cacheKey === cacheKey && !current.review && !current.isGenerating
          ? current
          : { cacheKey, review: null, isGenerating: false },
      );
      return;
    }
    let cancelled = false;
    setState({ cacheKey, review: null, isGenerating: true });
    void getOrStartRequest(cacheKey, { workspaceId, entries, language }).then((review) => {
      if (cancelled) {
        return;
      }
      setState({ cacheKey, review, isGenerating: false });
    });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, workspaceId, turnKey, entries, language]);

  return useMemo(() => {
    if (state.cacheKey !== cacheKey) {
      return { review: null, isGenerating: false };
    }
    return { review: state.review, isGenerating: state.isGenerating };
  }, [cacheKey, state]);
}
