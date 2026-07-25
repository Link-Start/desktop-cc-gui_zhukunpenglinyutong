import { useTranslation } from "react-i18next";

import { Switch } from "@/components/ui/switch";

import type { McpConfigRow } from "../utils/mcpInventory";

type McpsToggleSwitchProps = {
  row: McpConfigRow;
  pending: boolean;
  onToggle: (row: McpConfigRow, enabled: boolean) => void;
};

/**
 * 配置来源 MCP 服务的启用开关，行内与详情面板共用。样式用 app 统一的
 * ui/switch；外层 span 拦截 click/keydown 冒泡，避免触发行点击（开详情面板）。
 */
export function McpsToggleSwitch({ row, pending, onToggle }: McpsToggleSwitchProps) {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex shrink-0 items-center"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Switch
        checked={row.enabled}
        disabled={pending}
        onCheckedChange={(checked) => onToggle(row, checked)}
        aria-label={t(
          row.enabled
            ? "extensions.mcps.toggle.ariaDisable"
            : "extensions.mcps.toggle.ariaEnable",
          { name: row.name },
        )}
        className={pending ? "cursor-not-allowed" : undefined}
      />
    </span>
  );
}
