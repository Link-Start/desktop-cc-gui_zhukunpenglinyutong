import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Ban from "lucide-react/dist/esm/icons/ban";
import Play from "lucide-react/dist/esm/icons/play";
import type { ProviderConfig } from "../types";
import { DISABLED_PROVIDER_ID, LOCAL_SETTINGS_PROVIDER_ID } from "../types";
import { VendorOfficialConfigCard } from "./VendorOfficialConfigCard";

interface ClaudeLocalSettingsCardProps {
  localProvider: ProviderConfig | null;
  onSwitch: (id: string) => void;
  onEdit: () => void;
}

type LocalProviderDialogKind = "authorize" | "disable" | "help" | null;

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
    const isHelp = localDialog === "help";
    const isAuthorize = localDialog === "authorize";
    const title = isHelp
      ? t("settings.vendor.localProviderHelpTitle")
      : isAuthorize
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
            {isHelp ? (
              <p style={{ whiteSpace: "pre-wrap" }}>
                {t("settings.vendor.localProviderHelpBody")}
              </p>
            ) : isAuthorize ? (
              <>
                <p>{t("settings.vendor.localProviderAuthorizeMessage")}</p>
                <p>{t("settings.vendor.localProviderAuthorizeDetail")}</p>
              </>
            ) : (
              <p>{t("settings.vendor.localProviderDisableMessage")}</p>
            )}
          </div>
          <div className="vendor-dialog-footer">
            {isHelp ? (
              <button
                type="button"
                className="vendor-btn-save"
                onClick={() => setLocalDialog(null)}
              >
                {t("settings.vendor.gotIt")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="vendor-btn-cancel"
                  onClick={() => setLocalDialog(null)}
                >
                  {t("settings.vendor.cancel")}
                </button>
                <button
                  type="button"
                  className={isAuthorize ? "vendor-btn-save" : "vendor-btn-danger-solid"}
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
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <VendorOfficialConfigCard
        title={t("settings.vendor.officialConfig")}
        description={t("settings.vendor.localProviderDescription")}
        inUse={localProviderActive}
        onHelp={() => setLocalDialog("help")}
        onEdit={onEdit}
        actions={
          localProviderActive ? (
            <button
              type="button"
              className="vendor-btn-revoke"
              onClick={() => setLocalDialog("disable")}
            >
              <Ban size={11} aria-hidden />
              {t("settings.vendor.revokeAuthorization")}
            </button>
          ) : (
            <button
              type="button"
              className="vendor-btn-enable"
              onClick={() => setLocalDialog("authorize")}
            >
              <Play size={11} aria-hidden />
              {t("settings.vendor.authorizeAndEnable")}
            </button>
          )
        }
      />
      {renderLocalProviderDialog()}
    </>
  );
}
