import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProviderConfig } from "../types";
import { DISABLED_PROVIDER_ID, LOCAL_SETTINGS_PROVIDER_ID } from "../types";
import { VendorOfficialConfigCard } from "./VendorOfficialConfigCard";

interface ClaudeLocalSettingsCardProps {
  localProvider: ProviderConfig | null;
  onSwitch: (id: string) => void;
  onEdit: () => void;
}

type LocalProviderDialogKind = "authorize" | "disable" | null;

export function ClaudeLocalSettingsCard({
  localProvider,
  onSwitch,
  onEdit,
}: ClaudeLocalSettingsCardProps) {
  const { t } = useTranslation();
  const [localDialog, setLocalDialog] = useState<LocalProviderDialogKind>(null);

  useEffect(() => {
    if (!localDialog) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLocalDialog(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [localDialog]);

  if (!localProvider) {
    return null;
  }

  const localProviderActive = Boolean(localProvider.isActive);

  const renderLocalProviderDialog = () => {
    if (!localDialog) return null;
    const isAuthorize = localDialog === "authorize";
    const title = isAuthorize
      ? t("settings.vendor.localProviderAuthorizeTitle")
      : t("settings.vendor.localProviderDisableTitle");
    return (
      <div className="vendor-dialog-overlay" onClick={() => setLocalDialog(null)}>
        <div
          className="vendor-dialog vendor-dialog-sm"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="vendor-dialog-header">
            <h3>{title}</h3>
          </div>
          <div className="vendor-dialog-body">
            {isAuthorize ? (
              <>
                <p>{t("settings.vendor.localProviderAuthorizeMessage")}</p>
                <p>{t("settings.vendor.localProviderAuthorizeDetail")}</p>
              </>
            ) : (
              <p>{t("settings.vendor.localProviderDisableMessage")}</p>
            )}
          </div>
          <div className="vendor-dialog-footer">
            <button
              type="button"
              className="vendor-btn-cancel"
              onClick={() => setLocalDialog(null)}
            >
              {t("settings.vendor.cancel")}
            </button>
            <button
              type="button"
              className={
                isAuthorize ? "vendor-btn-save" : "vendor-btn-danger-solid"
              }
              onClick={() => {
                setLocalDialog(null);
                onSwitch(
                  isAuthorize
                    ? LOCAL_SETTINGS_PROVIDER_ID
                    : DISABLED_PROVIDER_ID,
                );
              }}
            >
              {isAuthorize
                ? t("settings.vendor.authorizeAndEnable")
                : t("settings.vendor.revokeAuthorization")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <VendorOfficialConfigCard
        title={t("settings.vendor.officialConfig")}
        helpContent={
          <div className="vendor-settings-row-help-stack">
            <p>{t("settings.vendor.localProviderDescription")}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {t("settings.vendor.localProviderHelpBody")}
            </p>
          </div>
        }
        inUse={localProviderActive}
        mode="auth"
        onEdit={onEdit}
        onUse={() => setLocalDialog("authorize")}
        onCancel={() => setLocalDialog("disable")}
      />
      {renderLocalProviderDialog()}
    </>
  );
}
