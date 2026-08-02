import { createElement, useCallback, type MouseEvent } from "react";
import type { TFunction } from "i18next";
import type {
  CommitMessageEngine,
  CommitMessageLanguage,
} from "../../../services/tauri";
import { saveLastCommitMessageConfig } from "../../../utils/commitMessage";
import { isEngineExecutionEnabled } from "../../../utils/engineExecutionPolicy";
import { getDisabledCliEngineIdsSnapshot } from "../../composer/hooks/cliEngineVisibilityStore";
import { CommitMessageEnginePicker } from "../components/CommitMessageEnginePicker";
import {
  COMMIT_MESSAGE_PICKER_MENU_SIZE,
  readCommitMessageMenuPreferences,
} from "../utils/commitMessageMenuConfig";
import type {
  RendererContextMenuItem,
  RendererContextMenuState,
} from "../../../components/ui/RendererContextMenu";

type MenuPosition = Pick<RendererContextMenuState, "x" | "y">;

type CommitMessageGenerationMenuOptions<TContext> = {
  t: TFunction<"translation", undefined>;
  busy: boolean;
  canGenerate: (context: TContext | undefined) => boolean;
  generate: (
    language: CommitMessageLanguage,
    engine: CommitMessageEngine,
    context: TContext | undefined,
  ) => Promise<void>;
  resolvePosition?: (
    event: MouseEvent<HTMLButtonElement>,
    menuSize: { width: number; height: number },
  ) => MenuPosition;
  setEngine: (engine: CommitMessageEngine) => void;
  setMenu?: (menu: RendererContextMenuState | null) => void;
  /** Current engine shown on the generate trigger / chip. */
  currentEngine?: CommitMessageEngine;
  buildExtraItems?: () => RendererContextMenuItem[];
};

export function useCommitMessageGenerationMenu<TContext = undefined>({
  t,
  busy,
  canGenerate,
  generate,
  resolvePosition,
  setEngine,
  setMenu,
  currentEngine,
  buildExtraItems,
}: CommitMessageGenerationMenuOptions<TContext>) {
  const runGeneration = useCallback(
    async (
      language: CommitMessageLanguage,
      engine: CommitMessageEngine,
      context?: TContext,
    ) => {
      if (busy || !canGenerate(context) || !isEngineExecutionEnabled(engine)) {
        return;
      }
      setEngine(engine);
      saveLastCommitMessageConfig({ engine, language });
      await generate(language, engine, context);
    },
    [busy, canGenerate, generate, setEngine],
  );

  const showEngineMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>, context?: TContext) => {
      event.preventDefault();
      event.stopPropagation();
      if (busy || !canGenerate(context) || !setMenu || !resolvePosition) {
        return;
      }

      const position = resolvePosition(event, COMMIT_MESSAGE_PICKER_MENU_SIZE);
      const preferences = readCommitMessageMenuPreferences(
        getDisabledCliEngineIdsSnapshot(),
      );

      setMenu({
        ...position,
        label: t("git.generateCommitMessage"),
        content: createElement(CommitMessageEnginePicker, {
          engines: preferences.engines,
          initialLanguage: preferences.initialLanguage,
          initialEngine: currentEngine ?? preferences.lastConfig?.engine,
          lastConfig: preferences.lastConfig,
          onDismiss: () => setMenu(null),
          onGenerate: (language, engine) => {
            void runGeneration(language, engine, context);
          },
          onSelectionChange: (_language, engine) => {
            setEngine(engine);
          },
        }),
        items: buildExtraItems?.() ?? [],
      });
    },
    [
      buildExtraItems,
      busy,
      canGenerate,
      currentEngine,
      resolvePosition,
      runGeneration,
      setEngine,
      setMenu,
      t,
    ],
  );

  return { runGeneration, showEngineMenu };
}
