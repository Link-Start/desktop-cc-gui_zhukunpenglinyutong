import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Info from "lucide-react/dist/esm/icons/info";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import { Button } from "@/components/ui/button";

interface VendorOfficialConfigCardProps {
  title: string;
  description: ReactNode;
  /** 渲染绿点「使用中」徽章 */
  inUse?: boolean;
  /** 追加在编辑按钮之前的操作（如 授权/取消授权） */
  actions?: ReactNode;
  onEdit: () => void;
  /** 提供时在标题旁渲染说明按钮 */
  onHelp?: () => void;
}

export function VendorOfficialConfigCard({
  title,
  description,
  inUse = false,
  actions,
  onEdit,
  onHelp,
}: VendorOfficialConfigCardProps) {
  const { t } = useTranslation();

  return (
    <div className="vendor-current-config vendor-official-config">
      <div className="vendor-official-config-row">
        <div className="vendor-official-config-main">
          <div className="vendor-official-config-copy">
            <div className="vendor-current-config-title">
              {title}
              {onHelp ? (
                <button
                  type="button"
                  className="vendor-btn-icon vendor-official-config-help"
                  onClick={onHelp}
                  title={t("settings.vendor.whatIsThis")}
                  aria-label={t("settings.vendor.whatIsThis")}
                >
                  <Info aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="settings-help">{description}</div>
          </div>
        </div>
        <div className="vendor-official-config-actions">
          {inUse ? (
            <span className="vendor-official-status">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-emerald-500"
              />
              {t("settings.vendor.inUse")}
            </span>
          ) : null}
          {actions}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title={t("settings.vendor.edit")}
            aria-label={t("settings.vendor.edit")}
            onClick={onEdit}
          >
            <Pencil aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
