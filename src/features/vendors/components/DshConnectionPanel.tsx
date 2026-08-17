import { useEffect, useState, type ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { AppSettings } from "../../../types";
import { useDshHostStatus } from "../hooks/useDshHostStatus";
import { classifyDshHostError, dshConnectionSummary } from "../utils/dshHostStatus";

type DshConnectionPanelProps = {
  active: boolean;
  appSettings: AppSettings;
  customPathEntry: ReactNode;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
};

export function DshConnectionPanel({
  active,
  appSettings,
  customPathEntry,
  onUpdateAppSettings,
}: DshConnectionPanelProps) {
  const { t } = useTranslation();
  const [hostDraft, setHostDraft] = useState(appSettings.dshHost ?? "127.0.0.1");
  const [portDraft, setPortDraft] = useState(String(appSettings.dshPort ?? 3080));
  const [settingsOpen, setSettingsOpen] = useState(
    () => appSettings.dshAutoStart === false,
  );
  const autoStart = appSettings.dshAutoStart !== false;
  const { view, loading, starting, error, refresh, startHost, cancelStart } = useDshHostStatus({
    enabled: active,
    dshBin: appSettings.dshBin ?? null,
    host: appSettings.dshHost,
    port: appSettings.dshPort,
  });

  useEffect(() => {
    setHostDraft(appSettings.dshHost ?? "127.0.0.1");
  }, [appSettings.dshHost]);

  useEffect(() => {
    setPortDraft(String(appSettings.dshPort ?? 3080));
  }, [appSettings.dshPort]);

  const savedHost = appSettings.dshHost ?? "127.0.0.1";
  const savedPort = String(appSettings.dshPort ?? 3080);
  const addressDirty = hostDraft.trim() !== savedHost || portDraft !== savedPort;

  useEffect(() => {
    if (view.kind === "down" || view.kind === "missing" || addressDirty) {
      setSettingsOpen(true);
    }
  }, [addressDirty, view.kind]);

  const summary = dshConnectionSummary(view, autoStart);
  const rawError = error ?? (view.kind !== "connected" ? view.error : null);
  const errorKind = classifyDshHostError(rawError);
  const errorText =
    errorKind === "transport"
      ? t("settings.vendor.dshDescribeFailed")
      : errorKind === "missing"
        ? t("settings.vendor.dshMissingHint")
        : rawError;
  const openUi = () => {
    void openUrl(view.origin);
  };

  const commitHost = () => {
    const nextHost = hostDraft.trim() || "127.0.0.1";
    setHostDraft(nextHost);
    if (nextHost === (appSettings.dshHost ?? "127.0.0.1")) {
      return;
    }
    void onUpdateAppSettings({
      ...appSettings,
      dshHost: nextHost,
    });
  };

  const commitPort = () => {
    const parsed = Number.parseInt(portDraft, 10);
    const nextPort =
      Number.isFinite(parsed) && parsed > 0 && parsed <= 65535
        ? parsed
        : (appSettings.dshPort ?? 3080);
    setPortDraft(String(nextPort));
    if (nextPort === (appSettings.dshPort ?? 3080)) {
      return;
    }
    void onUpdateAppSettings({
      ...appSettings,
      dshPort: nextPort,
    });
  };

  return (
    <div className="dsh-connection-panel">
      <section className="vendor-group-card dsh-status-card" aria-live="polite">
        <div className="dsh-status-main">
          <div className="dsh-status-copy">
            <div className="dsh-status-kicker">
              <span
                className={cn(
                  "dsh-status-dot",
                  view.kind === "connected" && "dsh-status-dot-ok",
                  view.kind === "down" && "dsh-status-dot-down",
                  view.kind === "missing" && "dsh-status-dot-down",
                  (view.kind === "checking" || starting) && "dsh-status-dot-wait",
                )}
                aria-hidden
              />
              <h3 className="dsh-status-title">
                {starting
                  ? t("settings.vendor.dshStarting")
                  : view.kind === "checking"
                    ? t("settings.vendor.dshChecking")
                    : view.kind === "missing"
                      ? t("settings.vendor.dshNotInstalled")
                      : view.kind === "down"
                        ? t("settings.vendor.dshHostDown")
                        : t("settings.vendor.dshHostConnected")}
              </h3>
            </div>
            <p className="dsh-status-meta">
              {view.kind === "connected"
                ? t("settings.vendor.dshConnectedHint", {
                    origin: view.origin,
                  })
                : view.kind === "down"
                  ? t("settings.vendor.dshDownHint", { origin: view.origin })
                  : view.kind === "missing"
                    ? t("settings.vendor.dshMissingHint")
                    : t("settings.vendor.dshCheckingHint")}
            </p>
            {view.kind === "connected" &&
            (view.provider || view.model || view.attachedSessions != null) ? (
              <dl className="dsh-status-facts">
                {view.provider ? (
                  <div className="dsh-status-fact">
                    <dt>{t("settings.vendor.dshCurrentProvider")}</dt>
                    <dd>{view.provider}</dd>
                  </div>
                ) : null}
                {view.model ? (
                  <div className="dsh-status-fact">
                    <dt>{t("settings.vendor.dshCurrentModel")}</dt>
                    <dd>{view.model}</dd>
                  </div>
                ) : null}
                {view.attachedSessions != null ? (
                  <div className="dsh-status-fact">
                    <dt>{t("settings.vendor.dshAttachedSessions")}</dt>
                    <dd>{view.attachedSessions}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            {errorText && view.kind !== "missing" ? (
              <p className="dsh-status-error" role="alert">
                {errorText}
              </p>
            ) : null}
          </div>
          <div className="dsh-status-actions">
            {starting ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  void cancelStart();
                }}
              >
                {t("settings.vendor.dshCancelStart")}
              </Button>
            ) : view.kind === "connected" ? (
              <Button type="button" size="xs" onClick={openUi}>
                {t("settings.vendor.dshOpenUi")}
              </Button>
            ) : view.kind === "down" ? (
              <Button
                type="button"
                size="xs"
                disabled={loading}
                onClick={() => {
                  void startHost();
                }}
              >
                {t("settings.vendor.dshStartNow")}
              </Button>
            ) : null}
            {!starting && view.kind === "connected" ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="dsh-status-stop"
                disabled={loading}
                onClick={() => {
                  void cancelStart();
                }}
              >
                {t("settings.vendor.dshStopService")}
              </Button>
            ) : null}
            {!starting && view.kind === "down" ? (
              <Button type="button" variant="outline" size="xs" onClick={openUi}>
                {t("settings.vendor.dshTryOpenUi")}
              </Button>
            ) : null}
            {!starting && view.kind !== "missing" ? (
              <Button
                type="button"
                variant={view.kind === "connected" || view.kind === "down" ? "outline" : "ghost"}
                size="xs"
                disabled={loading}
                onClick={() => {
                  void refresh();
                }}
              >
                {t("settings.vendor.dshRecheck")}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <p className="dsh-ownership-note">{t("settings.vendor.dshOwnershipNote")}</p>

      <div className="vendor-settings-section">
        <button
          type="button"
          className="dsh-connection-toggle"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <span>{t("settings.vendor.dshConnectionSettings")}</span>
          <em>
            {t("settings.vendor.dshConnectionSummary", {
              origin: summary.originLabel,
              autoStart: autoStart
                ? t("settings.vendor.dshAutoStartOn")
                : t("settings.vendor.dshAutoStartOff"),
            })}
          </em>
          <ChevronDown
            size={14}
            className={cn(
              "dsh-connection-chevron",
              !settingsOpen && "dsh-connection-chevron-collapsed",
            )}
            aria-hidden
          />
        </button>
        {settingsOpen ? (
          <div className="vendor-group-card">
            {customPathEntry}
            <div className="vendor-group-row">
              <div className="vendor-group-row-copy">
                <span className="vendor-group-row-title">
                  {t("settings.vendor.dshAddress")}
                </span>
                <span className="settings-help">
                  {t("settings.vendor.dshAddressHint")}
                </span>
              </div>
              <div className="dsh-address-fields">
                <input
                  className="vendor-input vendor-input-sm"
                  value={hostDraft}
                  aria-label={t("settings.vendor.dshHost")}
                  onChange={(event) => setHostDraft(event.target.value)}
                  onBlur={commitHost}
                />
                <input
                  className="vendor-input vendor-input-sm dsh-port-input"
                  type="number"
                  min={1}
                  max={65535}
                  value={portDraft}
                  aria-label={t("settings.vendor.dshPort")}
                  onChange={(event) => setPortDraft(event.target.value)}
                  onBlur={commitPort}
                />
              </div>
            </div>
            <div className="settings-toggle-row vendor-group-row">
              <div className="vendor-group-row-copy">
                <span className="vendor-group-row-title">
                  {t("settings.vendor.dshAutoStart")}
                </span>
                <span className="settings-help">
                  {t("settings.vendor.dshAutoStartHint")}
                </span>
              </div>
              <Switch
                checked={autoStart}
                aria-label={t("settings.vendor.dshAutoStart")}
                onCheckedChange={(checked) =>
                  void onUpdateAppSettings({
                    ...appSettings,
                    dshAutoStart: checked,
                  })
                }
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
