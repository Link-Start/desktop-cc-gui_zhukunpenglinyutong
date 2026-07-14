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
    <>
      <div className="settings-field-label">
        {t("settings.webServiceAssetsTitle")}
      </div>
      <div className="settings-field-row web-service-assets-row">
        <div
          className="settings-help web-service-assets-status"
          aria-live="polite"
        >
          <span
            className={`web-service-assets-status-dot web-service-assets-status-dot--${
              ready ? "ready" : "idle"
            }`}
            aria-hidden="true"
          />
          {statusText}
        </div>
        <button
          type="button"
          className={`${ready ? "ghost" : "primary"} settings-button-compact web-service-assets-action`}
          onClick={onInstall}
          disabled={action != null}
          aria-busy={installing}
        >
          {installing ? (
            <LoaderCircle className="animate-spin" size={14} aria-hidden="true" />
          ) : null}
          {installing
            ? t("settings.webServiceAssetsInstalling")
            : ready
              ? t("settings.webServiceAssetsReinstall")
              : t("settings.webServiceAssetsInstall")}
        </button>
        <button
          type="button"
          className="ghost settings-button-compact web-service-assets-action"
          onClick={onInstallLocal}
          disabled={action != null}
          aria-busy={localBusy}
        >
          {localBusy ? (
            <LoaderCircle className="animate-spin" size={14} aria-hidden="true" />
          ) : null}
          {selectingLocal
            ? t("settings.webServiceAssetsSelectingLocal")
            : installingLocal
              ? t("settings.webServiceAssetsInstallingLocal")
              : t("settings.webServiceAssetsInstallLocal")}
        </button>
        <button
          type="button"
          className="ghost settings-button-compact web-service-assets-action"
          onClick={onRefresh}
          disabled={action != null}
          aria-busy={checking}
        >
          {checking ? (
            <LoaderCircle className="animate-spin" size={14} aria-hidden="true" />
          ) : null}
          {checking
            ? t("settings.webServiceAssetsRechecking")
            : t("settings.webServiceAssetsRecheck")}
        </button>
      </div>
      {notice ? (
        <div
          className={`settings-help web-service-assets-log${action != null ? " is-active" : " is-success"}`}
          role="status"
          aria-live="polite"
        >
          {action != null ? (
            <LoaderCircle className="animate-spin" size={14} aria-hidden="true" />
          ) : null}
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="settings-help settings-help--danger" role="alert">
          {error}
        </div>
      ) : null}
    </>
  );
}
