import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface VendorProviderTableProps {
  loading: boolean;
  empty: boolean;
  emptyText: ReactNode;
  includeDragColumn?: boolean;
  showHeader?: boolean;
  renderRows: () => ReactNode;
}

export function renderVendorProviderDisplayName(name: string) {
  const trimmedName = name.trim();
  const separatorIndex = trimmedName.search(/\s/);
  if (separatorIndex <= 0) {
    return trimmedName;
  }

  const primaryName = trimmedName.slice(0, separatorIndex);
  const secondaryName = trimmedName.slice(separatorIndex).trim();

  return (
    <>
      <span>{primaryName}</span>
      <span className="vendor-card-name-extension">{secondaryName}</span>
    </>
  );
}

export function VendorProviderTable({
  loading,
  empty,
  emptyText,
  includeDragColumn = false,
  showHeader = true,
  renderRows,
}: VendorProviderTableProps) {
  const { t } = useTranslation();

  return (
    <>
      {loading && <div className="vendor-loading">{t("settings.loading")}</div>}

      <div className="vendor-provider-table-stack">
        <div
          className="vendor-provider-table-frame"
          data-empty={empty ? "true" : undefined}
          data-slot="frame"
        >
          <Table className="vendor-provider-table">
            {showHeader ? (
              <TableHeader>
                <TableRow>
                  {includeDragColumn && (
                    <TableHead className="vendor-provider-table-drag-cell" />
                  )}
                  <TableHead>{t("settings.vendor.providerColumn")}</TableHead>
                  <TableHead className="vendor-provider-table-status-cell">
                    {t("settings.vendor.statusColumn")}
                  </TableHead>
                  <TableHead className="vendor-provider-table-actions-cell">
                    {t("settings.vendor.actionsColumn")}
                  </TableHead>
                </TableRow>
              </TableHeader>
            ) : null}
            {renderRows()}
          </Table>
        </div>

        {!loading && empty && <div className="vendor-empty">{emptyText}</div>}
      </div>
    </>
  );
}
