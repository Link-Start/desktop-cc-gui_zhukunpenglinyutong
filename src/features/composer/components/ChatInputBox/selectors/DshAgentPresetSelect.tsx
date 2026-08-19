import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import CheckIcon from "lucide-react/dist/esm/icons/check";
import LockIcon from "lucide-react/dist/esm/icons/lock";
import { pushErrorToast } from "../../../../../services/toasts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DSH_AGENT_PRESET_OPTIONS,
  displayDshAgentPreset,
  isDshAgentPresetId,
  resolveDshAgentPresetOption,
  type DshAgentPresetId,
} from "./dshAgentPresets";

interface DshAgentPresetSelectProps {
  value: string;
  locked?: boolean;
  onChange: (preset: DshAgentPresetId) => void;
}

export const DshAgentPresetSelect = memo(
  ({ value, locked = false, onChange }: DshAgentPresetSelectProps) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const displayedValue = displayDshAgentPreset(value);
    const current = resolveDshAgentPresetOption(value);
    const isShipped = isDshAgentPresetId(displayedValue);
    const shortLabel = isShipped
      ? t(current.shortKey, { defaultValue: current.shortFallback })
      : displayedValue;
    const fullLabel = isShipped
      ? t(current.labelKey, { defaultValue: current.labelFallback })
      : displayedValue;

    if (locked) {
      return (
        <button
          type="button"
          className="selector-button"
          title={t("composer.dshAgentPreset.lockedHint", {
            defaultValue: "会话已开聊，组装锁定。新开会话才能换 preset。",
          })}
          onClick={() => {
            pushErrorToast({
              title: t("composer.dshAgentPreset.lockedTitle", {
                defaultValue: "组装已锁定",
              }),
              message: t("composer.dshAgentPreset.lockedHint", {
                defaultValue: "会话已开聊，组装锁定。新开会话才能换 preset。",
              }),
              durationMs: 3200,
            });
          }}
        >
          <LockIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="selector-button-text">{shortLabel}</span>
        </button>
      );
    }

    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="selector-button"
            title={t("composer.dshAgentPreset.entry", {
              defaultValue: "Agent 组装：{{preset}}",
              preset: fullLabel,
            })}
          >
            <span className="selector-button-text">{shortLabel}</span>
            <span
              className={`codicon codicon-chevron-${isOpen ? "up" : "down"}`}
              style={{ fontSize: "10px", marginLeft: "2px" }}
              aria-hidden="true"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" sideOffset={4} className="w-72">
          {DSH_AGENT_PRESET_OPTIONS.map((option) => {
            const selected = option.id === current.id;
            return (
              <DropdownMenuItem
                key={option.id}
                data-preset-id={option.id}
                data-selected={selected ? "true" : undefined}
                onSelect={(event) => {
                  event.preventDefault();
                  onChange(option.id);
                  setIsOpen(false);
                }}
                className="items-start gap-2"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">
                    {t(option.labelKey, { defaultValue: option.labelFallback })}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-normal">
                    {t(option.descriptionKey, {
                      defaultValue: option.descriptionFallback,
                    })}
                  </span>
                </div>
                {selected ? (
                  <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                ) : (
                  <span className="mt-0.5 shrink-0 font-mono text-[10.5px] text-muted-foreground">
                    {option.id}
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);

DshAgentPresetSelect.displayName = "DshAgentPresetSelect";
