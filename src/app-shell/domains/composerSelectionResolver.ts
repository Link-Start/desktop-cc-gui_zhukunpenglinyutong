import { useCallback, useRef } from "react";
import type { RefObject } from "react";

/**
 * composer 当前选择的快照：由 useAppShellComposerModelSection 写入，
 * 由 threads 发送路径经 resolveComposerSelection 读取（ref 账本，不参与渲染）。
 */
export type ComposerSelectionSnapshot = {
  id: string | null;
  model: string | null;
  source: string | null;
  providerProfileId: string | null;
  effort: string | null;
  collaborationMode: Record<string, unknown> | null;
};

export type ComposerSelectionResolver = {
  composerSelectionResolverRef: RefObject<ComposerSelectionSnapshot>;
  resolveComposerSelection: () => ComposerSelectionSnapshot;
};

/**
 * S4 PR-B：composer selection resolver 纯数据 host（无 UI）。
 *
 * 职责：持有 composer selection 的 ref 账本 + 稳定读取器，归 composer 域。
 * 写路径在 useAppShellComposerModelSection；读路径在 useThreads 发送链路。
 */
export function useComposerSelectionResolver(): ComposerSelectionResolver {
  const composerSelectionResolverRef = useRef<ComposerSelectionSnapshot>({
    id: null,
    model: null,
    source: null,
    providerProfileId: null,
    effort: null,
    collaborationMode: null,
  });
  const resolveComposerSelection = useCallback(
    () => composerSelectionResolverRef.current,
    [],
  );
  return { composerSelectionResolverRef, resolveComposerSelection };
}
