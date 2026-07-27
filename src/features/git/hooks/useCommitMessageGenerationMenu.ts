import { useCallback, useEffect, useRef, type MouseEvent } from "react";
import type { TFunction } from "i18next";
import type {
  CommitMessageEngine,
  CommitMessageLanguage,
} from "../../../services/tauri";
import { saveLastCommitMessageConfig } from "../../../utils/commitMessage";
import { isEngineExecutionEnabled } from "../../../utils/engineExecutionPolicy";
import {
  COMMIT_MESSAGE_MENU_ENGINES,
  readExecutableCommitMessageConfig,
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
  resolvePosition: (event: MouseEvent<HTMLButtonElement>) => MenuPosition;
  setEngine: (engine: CommitMessageEngine) => void;
  setMenu: (menu: RendererContextMenuState | null) => void;
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
  buildExtraItems,
}: CommitMessageGenerationMenuOptions<TContext>) {
  const deferredLanguageMenuTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (deferredLanguageMenuTimerRef.current !== null) {
        window.clearTimeout(deferredLanguageMenuTimerRef.current);
      }
    },
    [],
  );

  const runGeneration = useCallback(
    async (
      language: CommitMessageLanguage,
      engine: CommitMessageEngine,
      context: TContext | undefined,
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

  const showLanguageMenu = useCallback(
    (
      engine: CommitMessageEngine,
      position: MenuPosition,
      context: TContext | undefined,
    ) => {
      if (busy || !canGenerate(context)) {
        return;
      }
      setMenu({
        ...position,
        label: t("git.generateCommitMessage"),
        items: [
          {
            type: "item",
            id: "commit-message-zh",
            label: t("git.generateCommitMessageChinese"),
            onSelect: () => runGeneration("zh", engine, context),
          },
          {
            type: "item",
            id: "commit-message-en",
            label: t("git.generateCommitMessageEnglish"),
            onSelect: () => runGeneration("en", engine, context),
          },
        ],
      });
    },
    [busy, canGenerate, runGeneration, setMenu, t],
  );

  const showEngineMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>, context?: TContext) => {
      event.preventDefault();
      event.stopPropagation();
      if (busy || !canGenerate(context)) {
        return;
      }
      const position = resolvePosition(event);
      const lastConfig = readExecutableCommitMessageConfig();
      const engineLabelKeys = {
        codex: "git.generateCommitMessageEngineCodex",
        claude: "git.generateCommitMessageEngineClaude",
      } as const;
      setMenu({
        ...position,
        label: t("git.generateCommitMessage"),
        items: [
          {
            type: "item",
            id: "commit-message-last-config",
            label: t("git.generateCommitMessageLastConfig"),
            disabled: !lastConfig,
            onSelect: () =>
              lastConfig
                ? runGeneration(
                    lastConfig.language,
                    lastConfig.engine,
                    context,
                  )
                : undefined,
          },
          { type: "separator", id: "commit-message-last-config-separator" },
          ...COMMIT_MESSAGE_MENU_ENGINES.map<RendererContextMenuItem>(
            (engine) => ({
              type: "item",
              id: `commit-message-engine-${engine}`,
              label: t(engineLabelKeys[engine]),
              onSelect: () => {
                if (deferredLanguageMenuTimerRef.current !== null) {
                  window.clearTimeout(deferredLanguageMenuTimerRef.current);
                }
                deferredLanguageMenuTimerRef.current = window.setTimeout(() => {
                  deferredLanguageMenuTimerRef.current = null;
                  showLanguageMenu(engine, position, context);
                }, 0);
              },
            }),
          ),
          ...(buildExtraItems?.() ?? []),
        ],
      });
    },
    [
      buildExtraItems,
      busy,
      canGenerate,
      resolvePosition,
      runGeneration,
      setMenu,
      showLanguageMenu,
      t,
    ],
  );

  return { runGeneration, showEngineMenu };
}
