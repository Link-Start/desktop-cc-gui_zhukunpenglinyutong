import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import type { GrokProviderConfig } from "../types";
import { LOCAL_GROK_PROVIDER_ID } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  renderVendorProviderDisplayName,
  VendorProviderTable,
} from "./VendorProviderTable";

interface GrokProviderListProps {
  providers: GrokProviderConfig[];
  loading: boolean;
  headerActions?: ReactNode;
  /** 渲染在「+ 添加」按钮之后 */
  trailingActions?: ReactNode;
  onAdd: () => void;
  onEdit: (provider: GrokProviderConfig) => void;
  onDelete: (provider: GrokProviderConfig) => void;
  onSwitch: (id: string) => void;
}

export function GrokProviderList({
  providers,
  loading,
  headerActions,
  trailingActions,
  onAdd,
  onEdit,
  onDelete,
  onSwitch,
}: GrokProviderListProps) {
  const { t } = useTranslation();
  const providerList = Array.isArray(providers) ? providers : [];

  return (
    <div className="vendor-provider-list">
      <div className="vendor-list-header">
        <span className="vendor-list-title">
          {t("settings.vendor.thirdPartyConfig")}
        </span>
        <div className="vendor-list-actions">
          {headerActions}
          <Button size="sm" onClick={onAdd}>
            + {t("settings.vendor.add")}
          </Button>
          {trailingActions}
        </div>
      </div>

      <VendorProviderTable
        loading={loading}
        empty={providerList.length === 0}
        emptyText={t("settings.vendor.emptyGrokState")}
        renderRows={() => (
          <tbody className="vendor-provider-table-body" data-slot="table-body">
            {providerList.map((provider) => {
              const isLocalProvider =
                provider.id === LOCAL_GROK_PROVIDER_ID ||
                Boolean(provider.isLocalProvider);
              return (
                <tr
                  key={provider.id}
                  data-slot="table-row"
                  className={cn(
                    "vendor-provider-table-row",
                    provider.isActive && "active",
                    isLocalProvider && "vendor-local-provider-row",
                  )}
                >
                  <td
                    data-slot="table-cell"
                    className="vendor-provider-table-main-cell"
                  >
                    <div className="vendor-card-info">
                      <div className="vendor-card-name">
                        {isLocalProvider && <FileText size={14} />}
                        {renderVendorProviderDisplayName(provider.name)}
                      </div>
                      {(provider.remark || isLocalProvider) && (
                        <div
                          className="vendor-card-remark"
                          title={
                            isLocalProvider
                              ? t("settings.vendor.grokLocalProviderDescription")
                              : provider.remark
                          }
                        >
                          {isLocalProvider
                            ? t("settings.vendor.grokLocalProviderDescription")
                            : provider.remark}
                        </div>
                      )}
                      {(provider.model || provider.baseUrl) && (
                        <div
                          className="vendor-card-remark"
                          title={`${provider.model} · ${provider.baseUrl}`}
                        >
                          {provider.model}
                          {provider.model && provider.baseUrl ? " · " : ""}
                          {provider.baseUrl}
                        </div>
                      )}
                    </div>
                  </td>
                  <td
                    data-slot="table-cell"
                    className="vendor-provider-table-status-cell"
                  >
                    {provider.isActive ? (
                      <Badge
                        variant="outline"
                        className="text-stone-700 dark:text-stone-200"
                      >
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-emerald-500"
                        />
                        {t("settings.vendor.inUse")}
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => onSwitch(provider.id)}
                      >
                        {t("settings.vendor.enable")}
                      </Button>
                    )}
                  </td>
                  <td
                    data-slot="table-cell"
                    className="vendor-provider-table-actions-cell"
                  >
                    {!isLocalProvider && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => onEdit(provider)}
                          title={t("settings.vendor.edit")}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="hover:text-destructive"
                          onClick={() => onDelete(provider)}
                          title={t("settings.vendor.delete")}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        )}
      />
    </div>
  );
}
