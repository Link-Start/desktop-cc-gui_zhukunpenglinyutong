import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { useTranslation } from "react-i18next";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import FileText from "lucide-react/dist/esm/icons/file-text";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import type { ProviderConfig } from "../types";
import { LOCAL_SETTINGS_PROVIDER_ID } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  renderVendorProviderDisplayName,
  VendorProviderTable,
} from "./VendorProviderTable";

interface ProviderListProps {
  providers: ProviderConfig[];
  loading: boolean;
  headerActions?: ReactNode;
  /** 渲染在「+ 添加」按钮之后 */
  trailingActions?: ReactNode;
  onAdd: () => void;
  onEditLocalSettings: () => void;
  onEdit: (provider: ProviderConfig) => void;
  onDelete: (provider: ProviderConfig) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function buildClaudeProviderReorderIds(
  regularProviders: ProviderConfig[],
  sourceIndex: number,
  destinationIndex: number,
): string[] {
  const reorderedProviders = Array.from(regularProviders);
  const [moved] = reorderedProviders.splice(sourceIndex, 1);
  if (!moved) {
    return regularProviders.map((provider) => provider.id);
  }
  const safeDestinationIndex = Math.min(
    Math.max(destinationIndex, 0),
    reorderedProviders.length,
  );
  reorderedProviders.splice(safeDestinationIndex, 0, moved);
  return reorderedProviders.map((provider) => provider.id);
}

export function ProviderList({
  providers,
  loading,
  headerActions,
  trailingActions,
  onAdd,
  onEditLocalSettings,
  onEdit,
  onDelete,
  onReorder,
}: ProviderListProps) {
  const { t } = useTranslation();
  const providerList = Array.isArray(providers) ? providers : [];
  const localProvider =
    providerList.find(
      (provider) =>
        provider.id === LOCAL_SETTINGS_PROVIDER_ID || provider.isLocalProvider,
    ) ?? null;
  const regularProviders = providerList.filter(
    (provider) =>
      provider.id !== LOCAL_SETTINGS_PROVIDER_ID && !provider.isLocalProvider,
  );
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    if (sourceIndex === destinationIndex) {
      return;
    }

    onReorder(
      buildClaudeProviderReorderIds(
        regularProviders,
        sourceIndex,
        destinationIndex,
      ),
    );
  };

  const renderProviderRow = (
    provider: ProviderConfig,
    options: {
      dragHandle?: ReactNode;
      isDragging?: boolean;
      includeDragCell?: boolean;
      rowProps?: HTMLAttributes<HTMLTableRowElement>;
      rowRef?: Ref<HTMLTableRowElement>;
      rowStyle?: CSSProperties;
    } = {},
  ) => {
    const isLocalProvider =
      provider.id === LOCAL_SETTINGS_PROVIDER_ID ||
      Boolean(provider.isLocalProvider);

    return (
      <tr
        key={provider.id}
        data-slot="table-row"
        ref={options.rowRef}
        {...options.rowProps}
        style={options.rowStyle}
        className={cn(
          "vendor-provider-table-row",
          isLocalProvider && provider.isActive && "active",
          isLocalProvider && "vendor-local-provider-row",
          options.isDragging && "is-dragging",
          options.rowProps?.className,
        )}
      >
        {options.includeDragCell !== false ? (
          <td
            data-slot="table-cell"
            className="vendor-provider-table-drag-cell"
          >
            {options.dragHandle}
          </td>
        ) : null}
        <td data-slot="table-cell" className="vendor-provider-table-main-cell">
          <div className="vendor-card-info">
            <div className="vendor-card-name">
              {isLocalProvider && <FileText size={14} />}
              {isLocalProvider
                ? t("settings.vendor.officialConfig")
                : renderVendorProviderDisplayName(provider.name)}
              {provider.source === "cc-switch" && (
                <Badge
                  variant="outline"
                  size="sm"
                  className="text-stone-600 dark:text-stone-300"
                >
                  cc-switch
                </Badge>
              )}
            </div>
            {(provider.remark || provider.websiteUrl || isLocalProvider) && (
              <div
                className="vendor-card-remark"
                title={
                  isLocalProvider
                    ? t("settings.vendor.localProviderDescription")
                    : provider.remark || provider.websiteUrl
                }
              >
                {isLocalProvider
                  ? t("settings.vendor.localProviderDescription")
                  : provider.remark || provider.websiteUrl}
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
            {isLocalProvider && provider.isActive ? (
              <>
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-emerald-500"
                />
                {t("settings.vendor.inUse")}
              </>
            ) : (
              t("settings.vendor.availableForNewCodexSessions")
            )}
          </Badge>
        </td>
        <td
          data-slot="table-cell"
          className="vendor-provider-table-actions-cell"
        >
          {isLocalProvider ? (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onEditLocalSettings}
              title={t("settings.vendor.edit")}
              aria-label={t("settings.vendor.edit")}
            >
              <Pencil aria-hidden />
            </Button>
          ) : (
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
  };

  return (
    <div className="vendor-provider-list">
      {localProvider && (
        <div className="vendor-provider-list">
          <div className="vendor-list-header">
            <span className="vendor-list-title">
              {t("settings.vendor.officialConfig")}
            </span>
          </div>

          <VendorProviderTable
            loading={false}
            empty={false}
            emptyText=""
            showHeader={false}
            renderRows={() => (
              <tbody
                className="vendor-provider-table-body"
                data-slot="table-body"
              >
                {renderProviderRow(localProvider, { includeDragCell: false })}
              </tbody>
            )}
          />
        </div>
      )}

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
        empty={regularProviders.length === 0}
        emptyText={t("settings.vendor.emptyState")}
        includeDragColumn
        renderRows={() => (
          <>
            {regularProviders.length > 0 && (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="vendor-provider-list">
                  {(provided) => (
                    <tbody
                      className="vendor-provider-table-body"
                      data-slot="table-body"
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                    >
                      {regularProviders.map((provider, index) => (
                        <Draggable
                          key={provider.id}
                          draggableId={provider.id}
                          index={index}
                        >
                          {(draggableProvided, snapshot) =>
                            renderProviderRow(provider, {
                              isDragging: snapshot.isDragging,
                              rowRef: draggableProvided.innerRef,
                              rowProps: draggableProvided.draggableProps,
                              rowStyle: draggableProvided.draggableProps.style,
                              dragHandle: (
                                <span
                                  className="vendor-card-drag-handle"
                                  title={t("settings.vendor.dragToReorder")}
                                  aria-label={t(
                                    "settings.vendor.dragToReorder",
                                  )}
                                  {...draggableProvided.dragHandleProps}
                                >
                                  <GripVertical aria-hidden />
                                </span>
                              ),
                            })
                          }
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </tbody>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </>
        )}
      />
    </div>
  );
}
