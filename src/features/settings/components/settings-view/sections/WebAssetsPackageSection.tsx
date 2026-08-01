import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import type { WebAssetsStatus } from "@/services/tauri";

type WebAssetsPackageSectionProps = {
  t: (key: string) => string;
  status: WebAssetsStatus | null;
  action:
    | "checking"
    | "installing"
    | "selecting-local"
    | "installing-local"
    | null;
  error: string | null;
  notice: string | null;
  onInstall: () => void;
  onInstallLocal: () => void;
  onRefresh: () => void;
};

export function WebAssetsPackageSection({
  t,
  status,
  action,
  error,
  notice,
  onInstall,
  onInstallLocal,
  onRefresh,
}: WebAssetsPackageSectionProps) {
  const ready = status?.state === "ready";
  const checking = action === "checking";
  const installing = action === "installing";
  const selectingLocal = action === "selecting-local";
  const installingLocal = action === "installing-local";
  const localBusy = selectingLocal || installingLocal;
  const statusText =
    checking
      ? t("settings.webServiceAssetsChecking")
      : installing || installingLocal
        ? t("settings.webServiceAssetsInstalling")
        : ready
          ? t("settings.webServiceAssetsReady").replace(
              "{{version}}",
              status.installedVersion ?? status.requiredVersion,
            )
          : status?.state === "failed"
            ? t("settings.webServiceAssetsFailed")
            : t("settings.webServiceAssetsMissing");

  return (
    <div className="settings-pref-row settings-pref-row--stack settings-web-assets-row">
      <div className="settings-pref-row-main">
        <div className="settings-pref-meta">
          <div className="settings-pref-title">
            {t("settings.webServiceAssetsTitle")}
          </div>
          <div className="settings-pref-desc settings-web-status-line">
            <span
              className={`settings-web-status-dot${
                ready ? " is-ready" : status?.state === "failed" ? " is-error" : ""
              }`}
              aria-hidden
            />
            <span aria-live="polite">{statusText}</span>
          </div>
        </div>
        <div className="settings-pref-control settings-web-actions">
          <button
            type="button"
            className={`${ready ? "settings-web-btn" : "settings-web-btn settings-web-btn--primary"}`}
            onClick={onInstall}
            disabled={action != null}
            aria-busy={installing}
          >
            {installing ? (
              <LoaderCircle className="animate-spin" size={14} aria-hidden />
            ) : null}
            {installing
              ? t("settings.webServiceAssetsInstalling")
              : ready
                ? t("settings.webServiceAssetsReinstall")
                : t("settings.webServiceAssetsInstall")}
          </button>
          <button
            type="button"
            className="settings-web-btn"
            onClick={onInstallLocal}
            disabled={action != null}
            aria-busy={localBusy}
          >
            {localBusy ? (
              <LoaderCircle className="animate-spin" size={14} aria-hidden />
            ) : null}
            {selectingLocal
              ? t("settings.webServiceAssetsSelectingLocal")
              : installingLocal
                ? t("settings.webServiceAssetsInstallingLocal")
                : t("settings.webServiceAssetsInstallLocal")}
          </button>
          <button
            type="button"
            className="settings-web-btn"
            onClick={onRefresh}
            disabled={action != null}
            aria-busy={checking}
          >
            {checking ? (
              <LoaderCircle className="animate-spin" size={14} aria-hidden />
            ) : null}
            {checking
              ? t("settings.webServiceAssetsRechecking")
              : t("settings.webServiceAssetsRecheck")}
          </button>
        </div>
      </div>
      {notice ? (
        <div
          className={`settings-pref-hint settings-web-log${
            action != null ? " is-active" : " is-success"
          }`}
          role="status"
          aria-live="polite"
        >
          {action != null ? (
            <LoaderCircle className="animate-spin" size={14} aria-hidden />
          ) : null}
          <span className="settings-pref-hint-copy">{notice}</span>
        </div>
      ) : null}
      {error ? (
        <div className="settings-pref-hint settings-web-log is-error" role="alert">
          <span className="settings-pref-hint-copy">{error}</span>
        </div>
      ) : null}
    </div>
  );
}
