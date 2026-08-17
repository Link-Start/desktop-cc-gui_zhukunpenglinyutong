import { useMemo, useState, type MouseEvent } from "react";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { CliInstallEngine, EngineStatus } from "../../../types";
import { EngineIcon } from "../../engine/components/EngineIcon";
import { getEngineRegistryEntry } from "../../engine/engineRegistry";
import { formatEngineVersionLabel } from "../../engine/utils/engineLabels";
import { FIRST_RUN_ENGINE_META } from "../constants";
import {
  FIRST_RUN_MORE_ENGINES,
  FIRST_RUN_PRIMARY_ENGINES,
} from "../types";
import { retainFirstRunCardError } from "../utils/engineCardError";
import { FirstRunChoiceCard } from "./FirstRunChoiceCard";

function resolveEngineVersionLabel(
  engine: CliInstallEngine,
  rawVersion: string | null | undefined,
): string | null {
  const registryEntry = getEngineRegistryEntry(engine);
  const displayName = registryEntry?.displayName ?? engine;
  return formatEngineVersionLabel({
    type: engine,
    displayName,
    shortName: registryEntry?.shortName ?? displayName,
    installed: Boolean(rawVersion),
    version: rawVersion ?? null,
    error: null,
  });
}

export type FirstRunEngineCardState = {
  installed: boolean;
  validated: boolean;
  version: string | null;
  busy: boolean;
  error: string | null;
};

type FirstRunCliStepProps = {
  selectedEngine: CliInstallEngine | null;
  onSelectEngine: (engine: CliInstallEngine) => void;
  engineStatuses: EngineStatus[];
  cardStateByEngine: Partial<Record<CliInstallEngine, FirstRunEngineCardState>>;
  onInstall: (engine: CliInstallEngine) => void;
  detecting: boolean;
};

export function FirstRunCliStep({
  selectedEngine,
  onSelectEngine,
  engineStatuses,
  cardStateByEngine,
  onInstall,
  detecting,
}: FirstRunCliStepProps) {
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);

  const installedIds = useMemo(
    () =>
      new Set(
        engineStatuses
          .filter((status) => status.installed)
          .map((status) => status.engineType),
      ),
    [engineStatuses],
  );

  const visibleEngines = showMore
    ? [...FIRST_RUN_PRIMARY_ENGINES, ...FIRST_RUN_MORE_ENGINES]
    : [...FIRST_RUN_PRIMARY_ENGINES];

  return (
    <div className="first-run-stack">
      <header className="first-run-copy">
        <h1 id="first-run-setup-title">{t("onboarding.cli.title")}</h1>
        <p>{t("onboarding.cli.subtitle")}</p>
      </header>

      <div className="first-run-choice-list" role="list">
        {visibleEngines.map((engine) => {
          const meta = FIRST_RUN_ENGINE_META[engine];
          const card = cardStateByEngine[engine];
          const installed = card?.installed ?? installedIds.has(engine);
          const selected = selectedEngine === engine;
          const engineTitle = t(meta.titleKey);
          const rawVersion =
            card?.version ??
            engineStatuses.find((status) => status.engineType === engine)
              ?.version ??
            null;
          const versionLabel = resolveEngineVersionLabel(engine, rawVersion);
          const statusLabel = installed
            ? t("onboarding.cli.statusInstalled")
            : detecting
              ? t("onboarding.cli.statusChecking")
              : t("onboarding.cli.statusMissing");
          const installLabel = card?.busy
            ? t("onboarding.cli.installing")
            : t("onboarding.cli.install");
          const displayError = retainFirstRunCardError(card?.error);
          const canInstall = !installed && !detecting && !card?.busy;

          const handleInstallClick = (event: MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            onSelectEngine(engine);
            if (canInstall) {
              onInstall(engine);
            }
          };

          return (
            <div
              key={engine}
              className={cn(
                "first-run-engine-block",
                selected && "is-selected",
                !installed && "is-missing",
              )}
            >
              <div className="first-run-engine-row">
                <FirstRunChoiceCard
                  selected={selected}
                  compact
                  title={engineTitle}
                  icon={<EngineIcon engine={engine} size={16} />}
                  titleAccessory={
                    installed ? (
                      <span
                        className="first-run-status is-installed"
                        title={statusLabel}
                        aria-label={statusLabel}
                      >
                        <span className="first-run-status-dot" aria-hidden />
                        <span className="sr-only">{statusLabel}</span>
                      </span>
                    ) : null
                  }
                  trailing={
                    <span className="first-run-engine-meta">
                      {versionLabel ? (
                        <span
                          className="first-run-engine-version"
                          title={rawVersion ?? versionLabel}
                        >
                          {t("onboarding.cli.version", {
                            version: versionLabel,
                          })}
                        </span>
                      ) : null}
                      {!installed ? (
                        detecting || card?.busy ? (
                          card?.busy ? (
                            <span className="first-run-status">{installLabel}</span>
                          ) : (
                            <span
                              className="first-run-status is-checking"
                              title={statusLabel}
                              aria-label={statusLabel}
                              role="status"
                            >
                              <LoaderCircle
                                className="first-run-status-spinner animate-spin"
                                size={14}
                                aria-hidden
                              />
                              <span className="sr-only">{statusLabel}</span>
                            </span>
                          )
                        ) : (
                          <button
                            type="button"
                            className="first-run-install-chip"
                            aria-label={`${engineTitle} ${installLabel}`}
                            onClick={handleInstallClick}
                          >
                            {installLabel}
                          </button>
                        )
                      ) : null}
                    </span>
                  }
                  onSelect={() => onSelectEngine(engine)}
                />
              </div>
              {selected && displayError ? (
                <p className="first-run-engine-error">{displayError}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="first-run-text-button"
        onClick={() => setShowMore((current) => !current)}
      >
        {showMore ? t("onboarding.cli.hideMore") : t("onboarding.cli.showMore")}
      </button>
    </div>
  );
}
