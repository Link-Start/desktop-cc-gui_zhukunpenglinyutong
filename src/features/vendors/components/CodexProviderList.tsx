import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import type { CodexProviderConfig } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  renderVendorProviderDisplayName,
  VendorProviderTable,
} from "./VendorProviderTable";

interface CodexProviderListProps {
  providers: CodexProviderConfig[];
  loading: boolean;
  headerActions?: ReactNode;
  onAdd: () => void;
  onEdit: (provider: CodexProviderConfig) => void;
  onDelete: (provider: CodexProviderConfig) => void;
}

export function CodexProviderList({
  providers,
  loading,
  headerActions,
  onAdd,
  onEdit,
  onDelete,
}: CodexProviderListProps) {
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
        </div>
      </div>

      <VendorProviderTable
        loading={loading}
        empty={providerList.length === 0}
        emptyText={t("settings.vendor.emptyCodexState")}
        renderRows={() => (
          <tbody className="vendor-provider-table-body" data-slot="table-body">
            {providerList.map((provider) => (
              <tr
                key={provider.id}
                data-slot="table-row"
                className="vendor-provider-table-row"
              >
                <td
                  data-slot="table-cell"
                  className="vendor-provider-table-main-cell"
                >
                  <div className="vendor-card-info">
                    <div className="vendor-card-name">
                      {renderVendorProviderDisplayName(provider.name)}
                      {provider.customModels &&
                        provider.customModels.length > 0 && (
                          <Badge
                            variant="outline"
                            size="sm"
                            className="text-stone-600 dark:text-stone-300"
                          >
                            {provider.customModels.length}{" "}
                            {t("settings.vendor.customModels")}
                          </Badge>
                        )}
                    </div>
                    {provider.remark && (
                      <div
                        className="vendor-card-remark"
                        title={provider.remark}
                      >
                        {provider.remark}
                      </div>
                    )}
                  </div>
                </td>
                <td
                  data-slot="table-cell"
                  className="vendor-provider-table-status-cell"
                >
                  <Badge
                    variant="outline"
                    className="text-stone-700 dark:text-stone-200"
                  >
                    {t("settings.vendor.availableForNewCodexSessions")}
                  </Badge>
                </td>
                <td
                  data-slot="table-cell"
                  className="vendor-provider-table-actions-cell"
                >
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
                </td>
              </tr>
            ))}
          </tbody>
        )}
      />
    </div>
  );
}
