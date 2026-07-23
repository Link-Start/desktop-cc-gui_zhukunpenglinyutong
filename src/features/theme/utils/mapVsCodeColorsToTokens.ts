import { getContrastingTextColor, normalizeHexColor } from "../../../utils/colorUtils";
import type {
  DiffTokens,
  SyntaxTokens,
  VsCodeThemePresetDefinition,
} from "../constants/vscodeThemePresets";
import { mixHexColors, withAlpha } from "./themeColorUtils";

export type ThemeCssVariableMap = Record<`--${string}`, string>;

function getColor(
  colors: Record<string, string>,
  key: string,
  fallback: string,
): string {
  const normalized = normalizeHexColor(colors[key]);
  return normalized || fallback;
}


// preset 数据缺失时沿用 themes.light/dark.css 的语义 fallback。
const FALLBACK_SYNTAX: Record<"light" | "dark", SyntaxTokens> = {
  light: {
    keyword: "#2f6fdd",
    string: "#116329",
    comment: "#57606e",
    number: "#b06b00",
    function: "#6a46c7",
    operator: "#343d4c",
    type: "#cf222e",
    tag: "#cf222e",
  },
  dark: {
    keyword: "#8bd5ff",
    string: "#7ee787",
    comment: "#96aac8",
    number: "#f2cc60",
    function: "#d2a8ff",
    operator: "#c8d2dc",
    type: "#ff7b72",
    tag: "#ff7b72",
  },
};

const FALLBACK_DIFF: Record<"light" | "dark", DiffTokens> = {
  light: { inserted: "#1a7f37", removed: "#cf222e" },
  dark: { inserted: "#2ea043", removed: "#f85149" },
};

function syntaxFor(preset: VsCodeThemePresetDefinition) {
  const raw = preset.syntax;
  const fallback = FALLBACK_SYNTAX[preset.appearance];
  return {
    keyword: normalizeHexColor(raw?.keyword) || fallback.keyword,
    string: normalizeHexColor(raw?.string) || fallback.string,
    comment: normalizeHexColor(raw?.comment) || fallback.comment,
    number: normalizeHexColor(raw?.number) || fallback.number,
    function: normalizeHexColor(raw?.function) || fallback.function,
    operator: normalizeHexColor(raw?.operator) || fallback.operator,
    type: normalizeHexColor(raw?.type) || fallback.type,
    tag: normalizeHexColor(raw?.tag) || fallback.tag,
  };
}

function diffFor(preset: VsCodeThemePresetDefinition) {
  const raw = preset.diff;
  const fallback = FALLBACK_DIFF[preset.appearance];
  return {
    inserted: normalizeHexColor(raw?.inserted) || fallback.inserted,
    removed: normalizeHexColor(raw?.removed) || fallback.removed,
  };
}

export function mapVsCodeColorsToTokens(
  preset: VsCodeThemePresetDefinition,
): ThemeCssVariableMap {
  const { appearance, colors } = preset;
  const isDark = appearance === "dark";
  const syntax = syntaxFor(preset);
  const diffTokens = diffFor(preset);
  const editorBackground = getColor(
    colors,
    "editor.background",
    isDark ? "#1e1e1e" : "#ffffff",
  );
  const editorForeground = getColor(
    colors,
    "editor.foreground",
    getColor(colors, "foreground", isDark ? "#d4d4d4" : "#1f1f1f"),
  );
  const foreground = getColor(colors, "foreground", editorForeground);
  const descriptionForeground = getColor(
    colors,
    "descriptionForeground",
    mixHexColors(foreground, editorBackground, isDark ? 0.38 : 0.5),
  );
  const sideBarBackground = getColor(
    colors,
    "sideBar.background",
    mixHexColors(editorBackground, isDark ? "#000000" : "#ffffff", isDark ? 0.12 : 0.04),
  );
  const sideBarForeground = getColor(colors, "sideBar.foreground", foreground);
  const panelBackground = getColor(colors, "panel.background", sideBarBackground);
  const panelBorder = getColor(
    colors,
    "panel.border",
    mixHexColors(panelBackground, foreground, isDark ? 0.16 : 0.14),
  );
  const inputBackground = getColor(
    colors,
    "input.background",
    getColor(colors, "dropdown.background", panelBackground),
  );
  const inputForeground = getColor(colors, "input.foreground", foreground);
  const inputBorder = getColor(
    colors,
    "input.border",
    getColor(colors, "dropdown.border", panelBorder),
  );
  const buttonBackground = getColor(
    colors,
    "button.background",
    getColor(colors, "textLink.foreground", isDark ? "#007acc" : "#005fb8"),
  );
  const buttonForeground = getColor(
    colors,
    "button.foreground",
    getContrastingTextColor(buttonBackground),
  );
  const secondaryButtonBackground = getColor(
    colors,
    "button.secondaryBackground",
    mixHexColors(inputBackground, editorBackground, 0.34),
  );
  const secondaryButtonForeground = getColor(
    colors,
    "button.secondaryForeground",
    foreground,
  );
  const popoverBackground = getColor(
    colors,
    "dropdown.background",
    getColor(colors, "editorWidget.background", panelBackground),
  );
  const listHoverBackground = getColor(
    colors,
    "list.hoverBackground",
    mixHexColors(panelBackground, isDark ? "#ffffff" : "#000000", isDark ? 0.06 : 0.04),
  );
  const activeSelectionBackground =
    colors["list.activeSelectionBackground"] ||
    withAlpha(buttonBackground, isDark ? 0.26 : 0.14);
  const activeSelectionForeground = getColor(
    colors,
    "list.activeSelectionForeground",
    isDark ? "#ffffff" : "#0f172a",
  );
  const titleBarBackground = getColor(
    colors,
    "titleBar.activeBackground",
    getColor(colors, "statusBar.background", sideBarBackground),
  );
  const titleBarForeground = getColor(
    colors,
    "titleBar.activeForeground",
    getColor(colors, "statusBar.foreground", foreground),
  );
  const terminalBackground = getColor(
    colors,
    "terminal.background",
    editorBackground,
  );
  const terminalForeground = getColor(
    colors,
    "terminal.foreground",
    editorForeground,
  );
  const terminalSelection =
    colors["terminal.selectionBackground"] ||
    withAlpha(buttonBackground, isDark ? 0.32 : 0.2);
  const terminalCursor = getColor(
    colors,
    "terminalCursor.foreground",
    terminalForeground,
  );
  const lineNumberColor = getColor(
    colors,
    "editorLineNumber.foreground",
    mixHexColors(foreground, editorBackground, 0.48),
  );
  const diffAdded = getColor(
    colors,
    "editorGutter.addedBackground",
    isDark ? "#2ea043" : "#107c10",
  );
  const diffModified = getColor(
    colors,
    "editorGutter.modifiedBackground",
    buttonBackground,
  );
  const diffDeleted = getColor(
    colors,
    "editorGutter.deletedBackground",
    isDark ? "#f85149" : "#cd3131",
  );
  const linkColor = getColor(
    colors,
    "textLink.foreground",
    buttonBackground,
  );
  const badgeBackground = getColor(
    colors,
    "badge.background",
    mixHexColors(panelBackground, foreground, isDark ? 0.28 : 0.18),
  );
  const badgeForeground = getColor(
    colors,
    "badge.foreground",
    getContrastingTextColor(badgeBackground),
  );
  const strongText = mixHexColors(foreground, isDark ? "#ffffff" : "#000000", 0.14);
  const louderText = mixHexColors(foreground, isDark ? "#ffffff" : "#000000", 0.08);
  const quietText = mixHexColors(foreground, editorBackground, 0.18);
  const subtleText = mixHexColors(foreground, editorBackground, 0.34);
  const faintText = mixHexColors(foreground, editorBackground, 0.48);
  const fainterText = mixHexColors(foreground, editorBackground, 0.56);
  const dimText = mixHexColors(foreground, editorBackground, 0.68);
  const strongCard = mixHexColors(panelBackground, isDark ? "#ffffff" : "#000000", isDark ? 0.04 : 0.03);
  const mutedCard = mixHexColors(panelBackground, editorBackground, 0.28);
  const hoverSurface = listHoverBackground;
  const activeSurface = withAlpha(buttonBackground, isDark ? 0.24 : 0.14);
  const subtleBorder = inputBorder;
  const mutedBorder = mixHexColors(subtleBorder, editorBackground, 0.12);
  const strongerBorder = mixHexColors(subtleBorder, foreground, 0.12);
  const strongestBorder = mixHexColors(subtleBorder, foreground, 0.2);
  const quietBorder = mixHexColors(subtleBorder, foreground, 0.28);
  const accentBorder = buttonBackground;
  const accentBorderSoft = withAlpha(buttonBackground, isDark ? 0.32 : 0.24);
  const reviewSurface = withAlpha(diffDeleted, isDark ? 0.16 : 0.1);
  const reviewActiveSurface = withAlpha(diffDeleted, isDark ? 0.24 : 0.14);
  const reviewDoneSurface = withAlpha(diffAdded, isDark ? 0.16 : 0.1);
  const popoverForeground = inputForeground;
  const dropdownHover = listHoverBackground;
  const dropdownDivider = mixHexColors(panelBorder, editorBackground, 0.1);
  const background = editorBackground;
  const card = strongCard;
  const secondary = inputBackground;
  const accentSurface = hoverSurface;
  const successForeground = getContrastingTextColor(diffAdded);
  const warningForeground = getContrastingTextColor(diffModified);
  const errorForeground = getContrastingTextColor(diffDeleted);

  return {
    "--text-primary": foreground,
    "--text-strong": strongText,
    "--text-emphasis": louderText,
    "--text-stronger": louderText,
    "--text-quiet": quietText,
    "--text-muted": descriptionForeground,
    "--text-subtle": subtleText,
    "--text-faint": faintText,
    "--text-fainter": fainterText,
    "--text-dim": dimText,
    "--surface-sidebar": sideBarBackground,
    "--surface-sidebar-opaque": sideBarBackground,
    "--surface-topbar": titleBarBackground,
    "--surface-right-panel": panelBackground,
    "--surface-composer": panelBackground,
    "--surface-messages": editorBackground,
    "--surface-card": card,
    "--surface-card-strong": strongCard,
    "--surface-card-muted": mutedCard,
    "--surface-item": listHoverBackground,
    "--surface-control": inputBackground,
    "--surface-control-hover": hoverSurface,
    "--surface-control-disabled": mutedCard,
    "--surface-hover": hoverSurface,
    "--surface-active": activeSurface,
    "--surface-approval": panelBackground,
    "--surface-debug": terminalBackground,
    "--surface-command": popoverBackground,
    "--surface-diff-card": popoverBackground,
    "--surface-bubble": strongCard,
    "--surface-context-core": popoverBackground,
    "--surface-popover": popoverBackground,
    "--surface-review": reviewSurface,
    "--border-review": withAlpha(diffDeleted, isDark ? 0.42 : 0.28),
    "--surface-review-active": reviewActiveSurface,
    "--text-review-active": diffDeleted,
    "--surface-review-done": reviewDoneSurface,
    "--text-review-done": diffAdded,
    "--border-subtle": subtleBorder,
    "--border-muted": mutedBorder,
    "--border-strong": strongerBorder,
    "--border-stronger": strongestBorder,
    "--border-quiet": quietBorder,
    "--border-accent": accentBorder,
    "--border-accent-soft": accentBorderSoft,
    "--text-accent": buttonBackground,
    "--message-link-color": linkColor,
    "--shadow-accent": withAlpha(buttonBackground, isDark ? 0.34 : 0.18),
    "--status-success": diffAdded,
    "--status-warning": diffModified,
    "--status-error": diffDeleted,
    "--status-unknown": dimText,
    "--select-caret": lineNumberColor,
    "--background": background,
    "--foreground": foreground,
    "--card": card,
    "--card-foreground": foreground,
    "--popover": popoverBackground,
    "--popover-foreground": popoverForeground,
    "--primary": buttonBackground,
    "--primary-foreground": buttonForeground,
    "--secondary": secondary,
    "--secondary-foreground": secondaryButtonForeground,
    "--muted": inputBackground,
    "--muted-foreground": descriptionForeground,
    "--accent": accentSurface,
    "--accent-foreground": activeSelectionForeground,
    "--destructive": diffDeleted,
    "--destructive-foreground": errorForeground,
    "--success": diffAdded,
    "--success-foreground": successForeground,
    "--warning": diffModified,
    "--warning-foreground": warningForeground,
    "--info": buttonBackground,
    "--info-foreground": buttonForeground,
    "--border": panelBorder,
    "--input": inputBackground,
    "--ring": buttonBackground,
    "--sidebar-background": sideBarBackground,
    "--sidebar-foreground": sideBarForeground,
    "--sidebar-border": panelBorder,
    "--sidebar-accent": listHoverBackground,
    "--sidebar-accent-foreground": activeSelectionForeground,
    "--scrollbar-track": isDark ? "#1a1a1a" : "transparent",
    "--scrollbar-thumb": withAlpha(foreground, isDark ? 0.36 : 0.22),
    "--scrollbar-thumb-hover": withAlpha(foreground, isDark ? 0.5 : 0.34),
    "--bg-primary": editorBackground,
    "--bg-secondary": panelBackground,
    "--bg-tertiary": inputBackground,
    "--bg-hover": hoverSurface,
    "--bg-active": activeSurface,
    "--text-secondary": foreground,
    "--text-tertiary": descriptionForeground,
    "--border-primary": panelBorder,
    "--border-color": subtleBorder,
    "--border-hover": strongestBorder,
    "--color-success": diffAdded,
    "--color-warning": diffModified,
    "--color-error": diffDeleted,
    "--color-thinking-border": panelBorder,
    "--color-thinking-text": descriptionForeground,
    "--color-tool-bg": popoverBackground,
    "--color-tool-icon": buttonBackground,
    "--color-tool-name": linkColor,
    "--color-tool-summary": descriptionForeground,
    "--color-tool-file-link": diffAdded,
    "--dropdown-bg": popoverBackground,
    "--dropdown-border": panelBorder,
    "--dropdown-hover": dropdownHover,
    "--dropdown-selected": activeSelectionBackground,
    "--dropdown-selected-text": activeSelectionForeground,
    "--success-color": diffAdded,
    "--tooltip-bg": popoverBackground,
    "--dropdown-hover-color": dropdownHover,
    "--dropdown-divider-color": dropdownDivider,
    "--dropdown-title-color": descriptionForeground,
    "--dropdown-description-color": descriptionForeground,
    "--dropdown-add-bg": secondaryButtonBackground,
    "--dropdown-add-hover-bg": hoverSurface,
    "--dropdown-add-text-color": secondaryButtonForeground,
    "--dropdown-shadow-color": withAlpha("#000000", isDark ? 0.44 : 0.18),
    "--dropdown-text-color": popoverForeground,
    "--diff-added-bg": withAlpha(diffAdded, isDark ? 0.16 : 0.11),
    "--diff-added-gutter": withAlpha(diffAdded, isDark ? 0.44 : 0.34),
    "--diff-added-text": diffAdded,
    "--diff-deleted-bg": withAlpha(diffDeleted, isDark ? 0.16 : 0.11),
    "--diff-deleted-gutter": withAlpha(diffDeleted, isDark ? 0.44 : 0.34),
    "--diff-deleted-text": diffDeleted,

    // ---- 5 套代码 token 命名空间 (Markdown / file-view / diff-viewer / session-activity / file-tree) ----
    "--message-code-token-comment": syntax.comment,
    "--message-code-token-punctuation": syntax.operator,
    "--message-code-token-constant": syntax.type,
    "--message-code-token-number": syntax.number,
    "--message-code-token-string": syntax.string,
    "--message-code-token-operator": syntax.operator,
    "--message-code-token-keyword": syntax.keyword,
    "--message-code-token-function": syntax.function,
    "--theme-syntax-comment": syntax.comment,
    "--theme-syntax-punctuation": syntax.operator,
    "--theme-syntax-property": syntax.type,
    "--theme-syntax-tag": syntax.tag,
    "--theme-syntax-number": syntax.number,
    "--theme-syntax-string": syntax.string,
    "--theme-syntax-operator": syntax.operator,
    "--theme-syntax-keyword": syntax.keyword,
    "--theme-syntax-function": syntax.function,

    "--fvp-token-comment": syntax.comment,
    "--fvp-token-punctuation": syntax.operator,
    "--fvp-token-property": syntax.type,
    "--fvp-token-number": syntax.number,
    "--fvp-token-string": syntax.string,
    "--fvp-token-operator": syntax.operator,
    "--fvp-token-keyword": syntax.keyword,
    "--fvp-token-function": syntax.function,

    "--diff-token-comment": syntax.comment,
    "--diff-token-punctuation": syntax.operator,
    "--diff-token-property": syntax.type,
    "--diff-token-number": syntax.number,
    "--diff-token-string": syntax.string,
    "--diff-token-variable": syntax.operator,
    "--diff-token-keyword": syntax.keyword,
    "--diff-token-function": syntax.function,

    "--session-activity-command-output-comment": syntax.comment,
    "--session-activity-command-output-punctuation": syntax.operator,
    "--session-activity-command-output-constant": syntax.type,
    "--session-activity-command-output-number": syntax.number,
    "--session-activity-command-output-string": syntax.string,
    "--session-activity-command-output-operator": syntax.operator,
    "--session-activity-command-output-keyword": syntax.keyword,
    "--session-activity-command-output-function": syntax.function,

    "--file-preview-token-comment": syntax.comment,
    "--file-preview-token-punctuation": syntax.operator,
    "--file-preview-token-property": syntax.type,
    "--file-preview-token-number": syntax.number,
    "--file-preview-token-string": syntax.string,
    "--file-preview-token-operator": syntax.operator,
    "--file-preview-token-keyword": syntax.keyword,
    "--file-preview-token-function": syntax.function,

    // ---- diff 行级 (新命名;沿用 preset.diff 而非 editorGutter.*) ----
    "--diff-inserted-text": diffTokens.inserted,
    "--diff-inserted-gutter": withAlpha(diffTokens.inserted, isDark ? 0.44 : 0.34),
    "--diff-inserted-bg": withAlpha(diffTokens.inserted, isDark ? 0.16 : 0.11),
    "--diff-removed-text": diffTokens.removed,
    "--diff-removed-gutter": withAlpha(diffTokens.removed, isDark ? 0.44 : 0.34),
    "--diff-removed-bg": withAlpha(diffTokens.removed, isDark ? 0.16 : 0.11),
    "--theme-diff-inserted-text": diffTokens.inserted,
    "--theme-diff-inserted-gutter": withAlpha(diffTokens.inserted, isDark ? 0.44 : 0.34),
    "--theme-diff-inserted-bg": withAlpha(diffTokens.inserted, isDark ? 0.16 : 0.11),
    "--theme-diff-removed-text": diffTokens.removed,
    "--theme-diff-removed-gutter": withAlpha(diffTokens.removed, isDark ? 0.44 : 0.34),
    "--theme-diff-removed-bg": withAlpha(diffTokens.removed, isDark ? 0.16 : 0.11),

    "--theme-terminal-background": terminalBackground,
    "--theme-terminal-foreground": terminalForeground,
    "--theme-terminal-cursor": terminalCursor,
    "--theme-terminal-selection": terminalSelection,
    "--theme-terminal-font-family": "var(--code-font-family)",
    "--theme-button-background": buttonBackground,
    "--theme-button-foreground": buttonForeground,
    "--theme-button-secondary-background": secondaryButtonBackground,
    "--theme-button-secondary-foreground": secondaryButtonForeground,
    "--theme-input-foreground": inputForeground,
    "--theme-titlebar-foreground": titleBarForeground,
    "--theme-badge-background": badgeBackground,
    "--theme-badge-foreground": badgeForeground,
  };
}
