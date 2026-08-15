import { useMemo } from "react";
import type { AppSettings, ComposerEditorSettings } from "../../types";

/**
 * S4 PR-B：composer 编辑器设置纯 selector（无 UI，可单测）。
 *
 * 从 AppSettings 投影出 ComposerEditorSettings；归 composer 域。
 */
export function buildComposerEditorSettings(
  appSettings: AppSettings,
): ComposerEditorSettings {
  return {
    preset: appSettings.composerEditorPreset,
    expandFenceOnSpace: appSettings.composerFenceExpandOnSpace,
    expandFenceOnEnter: appSettings.composerFenceExpandOnEnter,
    fenceLanguageTags: appSettings.composerFenceLanguageTags,
    fenceWrapSelection: appSettings.composerFenceWrapSelection,
    autoWrapPasteMultiline: appSettings.composerFenceAutoWrapPasteMultiline,
    autoWrapPasteCodeLike: appSettings.composerFenceAutoWrapPasteCodeLike,
    continueListOnShiftEnter: appSettings.composerListContinuation,
  };
}

/**
 * useMemo 包装：依赖保持字段级，appSettings 换对象身份但字段值不变时
 * 输出引用保持稳定（与原根 composition 内联实现口径一致）。
 */
export function useComposerEditorSettings(
  appSettings: AppSettings,
): ComposerEditorSettings {
  return useMemo(
    () => buildComposerEditorSettings(appSettings),
    // 显式字段：避免把整 bag 引用放进 deps 导致恒失效（口径与原根内联实现一致）。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildComposerEditorSettings 纯函数；按字段粒度同步
    [
      appSettings.composerEditorPreset,
      appSettings.composerFenceExpandOnSpace,
      appSettings.composerFenceExpandOnEnter,
      appSettings.composerFenceLanguageTags,
      appSettings.composerFenceWrapSelection,
      appSettings.composerFenceAutoWrapPasteMultiline,
      appSettings.composerFenceAutoWrapPasteCodeLike,
      appSettings.composerListContinuation,
    ],
  );
}
