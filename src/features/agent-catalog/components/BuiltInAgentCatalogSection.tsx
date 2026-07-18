import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Copy from "lucide-react/dist/esm/icons/copy";
import Eye from "lucide-react/dist/esm/icons/eye";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Search from "lucide-react/dist/esm/icons/search";
import { Button } from "../../../components/ui/button";
import { Switch } from "../../../components/ui/switch";
import { getBuiltInAgentPrompt } from "../../../services/tauri";
import type { AppSettings, BuiltInAgent } from "../../../types";
import { useBuiltInAgentCatalog } from "../hooks/useBuiltInAgentCatalog";

type BuiltInAgentCatalogSectionProps = {
  active: boolean;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onCopyAgent: (agent: { name: string; prompt: string }) => void;
};

type DetailState = {
  agent: BuiltInAgent;
  prompt: string | null;
  loading: boolean;
  error: string | null;
} | null;

function normalizedSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function BuiltInAgentCatalogSection({
  active,
  onUpdateAppSettings,
  onCopyAgent,
}: BuiltInAgentCatalogSectionProps) {
  const { t } = useTranslation();
  const {
    catalog,
    loading,
    pendingKey,
    error,
    loadCatalog,
    setAgentEnabled,
    setDivisionEnabled,
  } = useBuiltInAgentCatalog({ active, onUpdateAppSettings });
  const [selectedDivisionId, setSelectedDivisionId] = useState("all");
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<DetailState>(null);

  const visibleAgents = useMemo(() => {
    const query = normalizedSearch(search);
    return (catalog?.agents ?? []).filter((agent) => {
      if (selectedDivisionId !== "all" && agent.divisionId !== selectedDivisionId) {
        return false;
      }
      if (enabledOnly && !agent.enabled) {
        return false;
      }
      if (!query) {
        return true;
      }
      const division = catalog?.divisions.find(
        (entry) => entry.id === agent.divisionId,
      );
      return [
        agent.name,
        agent.nameEn,
        agent.description,
        agent.descriptionEn,
        division?.label,
        division?.labelEn,
      ].some((value) => normalizedSearch(value ?? "").includes(query));
    });
  }, [catalog, enabledOnly, search, selectedDivisionId]);

  const enabledCount =
    catalog?.agents.reduce((count, agent) => count + (agent.enabled ? 1 : 0), 0) ??
    0;
  const selectedDivision = catalog?.divisions.find(
    (division) => division.id === selectedDivisionId,
  );

  async function loadDetail(agent: BuiltInAgent) {
    setDetail({ agent, prompt: null, loading: true, error: null });
    try {
      const resolved = await getBuiltInAgentPrompt(agent.id);
      setDetail({ agent, prompt: resolved.prompt, loading: false, error: null });
    } catch (loadError) {
      setDetail({
        agent,
        prompt: null,
        loading: false,
        error: loadError instanceof Error ? loadError.message : String(loadError),
      });
    }
  }

  async function copyAgent(agent: BuiltInAgent) {
    try {
      const resolved = await getBuiltInAgentPrompt(agent.id);
      onCopyAgent({ name: agent.name, prompt: resolved.prompt });
    } catch (copyError) {
      setDetail({
        agent,
        prompt: null,
        loading: false,
        error: copyError instanceof Error ? copyError.message : String(copyError),
      });
    }
  }

  if (loading && !catalog) {
    return (
      <div className="settings-agent-empty">
        <span className="codicon codicon-loading codicon-modifier-spin" />
        <span>{t("settings.agent.loading")}</span>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="settings-agent-empty is-error">
        <span>{error ?? t("settings.agent.builtIn.loadFailed")}</span>
        <Button variant="outline" size="sm" onClick={() => void loadCatalog()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="built-in-agent-catalog">
      <div className="built-in-agent-summary">
        <div>
          <div className="settings-subsection-title">
            {t("settings.agent.builtIn.title")}
          </div>
          <div className="settings-section-subtitle">
            {t("settings.agent.builtIn.summary", {
              enabled: enabledCount,
              total: catalog.agents.length,
            })}
          </div>
        </div>
        <a
          className="built-in-agent-source"
          href={catalog.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={t("common.curatedViewOnGithubAria", {
            name: catalog.displayName,
          })}
          aria-label={t("common.curatedViewOnGithubAria", {
            name: catalog.displayName,
          })}
        >
          <span translate="no">{catalog.displayName}</span>
          <span aria-hidden>·</span>
          <span translate="no">{catalog.license}</span>
          <span aria-hidden>·</span>
          <code translate="no">{catalog.sourceRevision.slice(0, 8)}</code>
          <ExternalLink aria-hidden />
        </a>
      </div>

      {error && <div className="settings-agent-notice is-error">{error}</div>}

      <div className="built-in-agent-toolbar">
        <label className="built-in-agent-search">
          <Search aria-hidden />
          <span className="sr-only">
            {t("settings.agent.builtIn.searchLabel")}
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("settings.agent.builtIn.searchPlaceholder")}
          />
        </label>
        <label className="built-in-agent-enabled-filter">
          <input
            type="checkbox"
            checked={enabledOnly}
            onChange={(event) => setEnabledOnly(event.target.checked)}
          />
          {t("settings.agent.builtIn.enabledOnly")}
        </label>
        {selectedDivision && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={pendingKey !== null}
              onClick={() =>
                void setDivisionEnabled(selectedDivision.id, true)
              }
            >
              {t("settings.agent.builtIn.enableDivision")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pendingKey !== null}
              onClick={() =>
                void setDivisionEnabled(selectedDivision.id, false)
              }
            >
              {t("settings.agent.builtIn.disableDivision")}
            </Button>
          </>
        )}
      </div>

      <div className="built-in-agent-layout">
        <nav
          className="built-in-agent-divisions"
          aria-label={t("settings.agent.builtIn.divisions")}
        >
          <button
            type="button"
            className={selectedDivisionId === "all" ? "active" : ""}
            onClick={() => setSelectedDivisionId("all")}
          >
            <span>{t("settings.agent.builtIn.all")}</span>
            <span>
              {enabledCount}/{catalog.agents.length}
            </span>
          </button>
          {catalog.divisions.map((division) => (
            <button
              type="button"
              key={division.id}
              className={selectedDivisionId === division.id ? "active" : ""}
              onClick={() => setSelectedDivisionId(division.id)}
            >
              <span>{division.label}</span>
              <span>
                {division.enabledCount}/{division.count}
              </span>
            </button>
          ))}
        </nav>

        <div className="built-in-agent-results">
          <div className="built-in-agent-result-count">
            {t("settings.agent.builtIn.results", {
              count: visibleAgents.length,
            })}
          </div>
          {visibleAgents.length === 0 ? (
            <div className="settings-agent-empty">
              {t("settings.agent.builtIn.empty")}
            </div>
          ) : (
            <div className="settings-agent-list">
              {visibleAgents.map((agent) => {
                const division = catalog.divisions.find(
                  (entry) => entry.id === agent.divisionId,
                );
                return (
                  <div key={agent.id} className="settings-agent-card built-in-agent-card">
                    <div className="settings-agent-card-main">
                      <div className="settings-agent-card-title">
                        <span aria-hidden>{agent.emoji || "🤖"}</span>
                        <span>{agent.name}</span>
                        <span className="built-in-agent-division-badge">
                          {division?.label ?? agent.divisionId}
                        </span>
                      </div>
                      <div className="settings-agent-card-prompt">
                        {agent.description}
                      </div>
                    </div>
                    <div className="settings-agent-card-actions">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t("settings.agent.builtIn.viewDetails")}
                        aria-label={t("settings.agent.builtIn.viewDetails")}
                        onClick={() => void loadDetail(agent)}
                      >
                        <Eye aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t("settings.agent.builtIn.copy")}
                        aria-label={t("settings.agent.builtIn.copy")}
                        onClick={() => void copyAgent(agent)}
                      >
                        <Copy aria-hidden />
                      </Button>
                      <Switch
                        checked={agent.enabled}
                        disabled={pendingKey !== null}
                        onCheckedChange={(checked) =>
                          void setAgentEnabled(agent.id, checked)
                        }
                        aria-label={t("settings.agent.builtIn.toggle", {
                          name: agent.name,
                        })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div
          className="vendor-dialog-overlay"
          onClick={() => setDetail(null)}
        >
          <div
            className="vendor-dialog vendor-dialog-wide built-in-agent-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="built-in-agent-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="vendor-dialog-header">
              <h3 id="built-in-agent-detail-title">{detail.agent.name}</h3>
              <button
                type="button"
                className="vendor-dialog-close"
                aria-label={t("common.close")}
                onClick={() => setDetail(null)}
              >
                <span className="codicon codicon-close" />
              </button>
            </div>
            <div className="vendor-dialog-body">
              <p>{detail.agent.description}</p>
              <div className="built-in-agent-detail-meta">
                {detail.agent.sourcePath} ·{" "}
                {detail.agent.sourceRevision.slice(0, 8)}
              </div>
              {detail.loading ? (
                <div className="settings-agent-empty">
                  {t("settings.agent.builtIn.promptLoading")}
                </div>
              ) : detail.error ? (
                <div className="settings-agent-notice is-error">
                  {detail.error}
                </div>
              ) : (
                <pre className="built-in-agent-prompt-preview">{detail.prompt}</pre>
              )}
            </div>
            <div className="vendor-dialog-footer">
              <Button variant="outline" onClick={() => setDetail(null)}>
                {t("common.close")}
              </Button>
              <Button
                disabled={!detail.prompt}
                onClick={() => {
                  if (detail.prompt) {
                    onCopyAgent({
                      name: detail.agent.name,
                      prompt: detail.prompt,
                    });
                    setDetail(null);
                  }
                }}
              >
                {t("settings.agent.builtIn.copy")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
