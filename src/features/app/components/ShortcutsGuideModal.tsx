import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { AppSettings } from "../../../types";
import { getAppSettings } from "../../../services/tauri";
import {
  shortcutActions,
  type ShortcutCategory,
} from "../../settings/components/settings-view/settingsViewShortcuts";
import {
  formatShortcutForPlatform,
  getDefaultInterruptShortcut,
  isMacPlatform,
} from "../../../utils/shortcuts";
import { Kbd } from "../../../components/ui/kbd";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";

type ShortcutsGuideModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenShortcutsSettings?: () => void;
};

type GuideRow = {
  id: string;
  label: string;
  shortcut: string;
};

type GuideGroup = {
  id: ShortcutCategory;
  rows: GuideRow[];
};

// 展示顺序：应用 → 会话 → 导航 → 面板 → 输入框 → 文件编辑 → Git → 界面缩放
const GROUP_ORDER: ShortcutCategory[] = [
  "app",
  "file",
  "navigation",
  "panels",
  "composer",
  "editor",
  "git",
  "uiScale",
];

const GROUP_TITLE_KEYS: Record<ShortcutCategory, string> = {
  common: "shortcutsGuide.groups.app",
  app: "shortcutsGuide.groups.app",
  file: "shortcutsGuide.groups.sessions",
  navigation: "shortcutsGuide.groups.navigation",
  panels: "shortcutsGuide.groups.panels",
  composer: "shortcutsGuide.groups.composer",
  editor: "shortcutsGuide.groups.editor",
  git: "shortcutsGuide.groups.git",
  uiScale: "shortcutsGuide.groups.uiScale",
};

// Mac 风格格式化对非修饰键只做原样保留，这里补齐常见键的显示
const MAC_KEY_LABEL_OVERRIDES: Record<string, string> = {
  enter: "↵",
  tab: "Tab",
};

function shortcutToChips(shortcut: string, isMac: boolean): string[] {
  const parsed = shortcut.split("+");
  const rawKey = parsed[parsed.length - 1] ?? "";
  const formatted = formatShortcutForPlatform(shortcut, isMac);
  if (!isMac) {
    return formatted.split("+");
  }
  const match = formatted.match(/^([⌘⌥⇧⌃]*)(.*)$/u);
  if (!match) {
    return [formatted];
  }
  const modifiers = [...match[1]];
  const keyLabel = MAC_KEY_LABEL_OVERRIDES[rawKey] ?? match[2];
  return keyLabel ? [...modifiers, keyLabel] : modifiers;
}

function buildGuideGroups(
  settings: AppSettings | null,
  t: TFunction,
): GuideGroup[] {
  const rows: GuideRow[] = [];
  for (const action of shortcutActions) {
    let shortcut: string | null;
    if (settings) {
      shortcut = settings[action.setting];
      if (!shortcut && action.setting === "interruptShortcut") {
        shortcut = getDefaultInterruptShortcut();
      }
    } else {
      shortcut =
        action.setting === "interruptShortcut"
          ? getDefaultInterruptShortcut()
          : action.defaultShortcut;
    }
    // 用户明确清空（null）或未分配默认值的条目不展示
    if (!shortcut) {
      continue;
    }
    rows.push({
      id: action.id,
      label: t(action.labelKey),
      shortcut,
    });
  }
  // Quick Switcher 为硬编码 cmd+e，不在可配置元数据内，补充到面板组
  rows.push({
    id: "quick-switcher",
    label: t("sidebar.quickSwitcher.title"),
    shortcut: "cmd+e",
  });
  // 发送/换行为二选一设置而非快捷键字符串，按当前配置动态展示
  const sendWithCmdEnter = settings?.composerSendShortcut === "cmdEnter";
  rows.push({
    id: "composer-send-message",
    label: t("shortcutsGuide.sendMessage"),
    shortcut: sendWithCmdEnter ? "cmd+enter" : "enter",
  });
  rows.push({
    id: "composer-insert-newline",
    label: t("shortcutsGuide.insertNewline"),
    shortcut: sendWithCmdEnter ? "enter" : "shift+enter",
  });

  const groupOf = (id: string): ShortcutCategory => {
    if (id === "quick-switcher") {
      return "panels";
    }
    if (id.startsWith("composer-")) {
      return "composer";
    }
    return (
      shortcutActions.find((action) => action.id === id)?.category ?? "app"
    );
  };

  const groups: GuideGroup[] = [];
  for (const category of GROUP_ORDER) {
    const categoryRows = rows.filter((row) => groupOf(row.id) === category);
    if (categoryRows.length === 0) {
      continue;
    }
    groups.push({ id: category, rows: categoryRows });
  }
  return groups;
}

export function ShortcutsGuideModal({
  open,
  onOpenChange,
  onOpenShortcutsSettings,
}: ShortcutsGuideModalProps) {
  const { t } = useTranslation();
  const isMac = useMemo(() => isMacPlatform(), []);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    getAppSettings()
      .then((loaded) => {
        if (!cancelled) {
          setSettings(loaded);
        }
      })
      .catch(() => {
        // 读取失败时按默认快捷键展示
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const groups = useMemo(() => buildGuideGroups(settings, t), [settings, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="gap-1 p-6 pb-4">
          <DialogTitle>{t("shortcutsGuide.title")}</DialogTitle>
          <DialogDescription>
            {t("shortcutsGuide.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">
          {groups.map((group) => (
            <section key={group.id} className="pb-4">
              <h3 className="text-muted-foreground pb-1 text-xs font-medium">
                {t(GROUP_TITLE_KEYS[group.id])}
              </h3>
              <ul>
                {group.rows.map((row) => (
                  <li
                    key={row.id}
                    className="border-border/60 flex items-center justify-between gap-4 border-b py-2.5 last:border-b-0"
                  >
                    <span className="text-sm">{row.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {shortcutToChips(row.shortcut, isMac).map(
                        (chip, index) => (
                          <Kbd key={`${row.id}-${index}`}>{chip}</Kbd>
                        ),
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {onOpenShortcutsSettings ? (
          <DialogFooter className="p-6 pt-2">
            <Button
              onClick={() => {
                onOpenChange(false);
                onOpenShortcutsSettings();
              }}
            >
              {t("shortcutsGuide.openSettings")}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
