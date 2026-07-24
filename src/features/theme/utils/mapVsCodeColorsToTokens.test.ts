import { describe, expect, it } from "vitest";
import {
  ALL_THEME_PRESET_IDS,
  PRESET_DIFF_TOKENS,
  PRESET_SYNTAX_TOKENS,
  getVsCodeThemePreset,
} from "../constants/vscodeThemePresets";
import { mapVsCodeColorsToTokens } from "./mapVsCodeColorsToTokens";

const HEX_PATTERN = /^#[0-9a-f]{6}$/;

describe("mapVsCodeColorsToTokens", () => {
  it("maps dark modern preset to the expected surface and terminal tokens", () => {
    const tokens = mapVsCodeColorsToTokens(
      getVsCodeThemePreset("vscode-dark-modern"),
    );

    expect(tokens["--surface-sidebar"]).toBe("#181818");
    expect(tokens["--surface-messages"]).toBe("#1f1f1f");
    expect(tokens["--primary"]).toBe("#0078d4");
    expect(tokens["--theme-terminal-background"]).toBe("#1f1f1f");
    expect(tokens["--diff-added-text"]).toBe("#2ea043");
  });

  it("maps light plus preset to the expected light palette tokens", () => {
    const tokens = mapVsCodeColorsToTokens(
      getVsCodeThemePreset("vscode-light-plus"),
    );

    expect(tokens["--text-primary"]).toBe("#3b3b3b");
    expect(tokens["--surface-sidebar"]).toBe("#f3f3f3");
    expect(tokens["--border-accent"]).toBe("#007acc");
    expect(tokens["--theme-terminal-cursor"]).toBe("#000000");
    expect(tokens["--dropdown-bg"]).toBe("#ffffff");
  });
});

describe("preset syntax + diff data", () => {
  it("every curated preset has 8 syntax token hex values", () => {
    type SyntaxKey = "keyword" | "string" | "comment" | "number" | "function" | "operator" | "type" | "tag";
    const required: SyntaxKey[] = [
      "keyword",
      "string",
      "comment",
      "number",
      "function",
      "operator",
      "type",
      "tag",
    ];
    for (const id of ALL_THEME_PRESET_IDS) {
      const syntax = PRESET_SYNTAX_TOKENS[id];
      expect(syntax, `missing syntax for ${id}`).toBeDefined();
      for (const key of required) {
        const value = (syntax as Record<string, string> | undefined)?.[key as string];
        expect(value, `${id}.syntax.${key} must be a #RRGGBB hex`).toMatch(HEX_PATTERN);
      }
    }
  });

  it("every curated preset has diff inserted + removed hex values", () => {
    for (const id of ALL_THEME_PRESET_IDS) {
      const diff = PRESET_DIFF_TOKENS[id];
      expect(diff, `missing diff for ${id}`).toBeDefined();
      expect(diff.inserted, `${id}.diff.inserted`).toMatch(HEX_PATTERN);
      expect(diff.removed, `${id}.diff.removed`).toMatch(HEX_PATTERN);
    }
  });
});

describe("mapper syntax + diff tokens", () => {
  it("emits the full 5×8 syntax token names plus diff inserted/removed", () => {
    const tokens = mapVsCodeColorsToTokens(
      getVsCodeThemePreset("vscode-dark-modern"),
    );

    // 4 个命名空间 (message/fvp/session/file-preview) 共享 7 个 key
    // diff-token 用 variable 替代 operator
    const sharedSeven = ["comment", "punctuation", "number", "string", "operator", "keyword", "function"];
    const sharedSevenNamespaces = [
      "message-code-token",
      "fvp-token",
      "session-activity-command-output",
      "file-preview-token",
    ];
    for (const ns of sharedSevenNamespaces) {
      for (const k of sharedSeven) {
        const cssVar = `--${ns}-${k}` as `--${string}`;
        const value = tokens[cssVar];
        expect(value, `${cssVar} must be defined`).toBeTruthy();
        expect(value, `${cssVar} must be a hex`).toMatch(HEX_PATTERN);
      }
    }

    // diff-token: 6 个共享 + 1 个 variable
    const diffKeys = ["comment", "punctuation", "number", "string", "keyword", "function"];
    for (const k of diffKeys) {
      expect(tokens[`--diff-token-${k}` as `--${string}`], `--diff-token-${k} must be defined`).toBeTruthy();
    }
    expect(tokens["--diff-token-variable" as `--${string}`]).toBeTruthy();

    // 各命名空间的 "type" 语义键 (从 css 上下文派生:constant / property / variable)
    expect(tokens["--message-code-token-constant"]).toMatch(HEX_PATTERN);
    expect(tokens["--fvp-token-property"]).toMatch(HEX_PATTERN);
    expect(tokens["--diff-token-property"]).toMatch(HEX_PATTERN);
    expect(tokens["--diff-token-variable" as `--${string}`]).toMatch(HEX_PATTERN);
    expect(tokens["--session-activity-command-output-constant"]).toMatch(HEX_PATTERN);
    expect(tokens["--file-preview-token-property"]).toMatch(HEX_PATTERN);
    expect(tokens["--theme-syntax-keyword"]).toBe(
      tokens["--message-code-token-keyword"],
    );
    expect(tokens["--theme-syntax-tag"]).toBe(
      PRESET_SYNTAX_TOKENS["vscode-dark-modern"].tag,
    );

    // diff inserted/removed (text + bg + gutter)
    expect(tokens["--diff-inserted-text" as `--${string}`]).toMatch(HEX_PATTERN);
    expect(tokens["--diff-inserted-bg" as `--${string}`]).toBeTruthy();
    expect(tokens["--diff-inserted-gutter" as `--${string}`]).toBeTruthy();
    expect(tokens["--diff-removed-text" as `--${string}`]).toMatch(HEX_PATTERN);
    expect(tokens["--diff-removed-bg" as `--${string}`]).toBeTruthy();
    expect(tokens["--diff-removed-gutter" as `--${string}`]).toBeTruthy();
    expect(tokens["--theme-diff-inserted-bg"]).toBe(
      tokens["--diff-inserted-bg"],
    );
  });

  it("catppuccin-mocha emits Catppuccin keyword / string / inserted hex", () => {
    const tokens = mapVsCodeColorsToTokens(
      getVsCodeThemePreset("vscode-catppuccin-mocha"),
    );
    expect(tokens["--message-code-token-keyword" as `--${string}`]).toBe("#cba6f7");
    expect(tokens["--message-code-token-string" as `--${string}`]).toBe("#a6e3a1");
    expect(tokens["--diff-inserted-text" as `--${string}`]).toBe("#a6e3a1");
    expect(tokens["--diff-removed-text" as `--${string}`]).toBe("#f38ba8");
  });

  it("github-light emits GitHub Light hex", () => {
    const tokens = mapVsCodeColorsToTokens(
      getVsCodeThemePreset("vscode-github-light"),
    );
    expect(tokens["--message-code-token-keyword" as `--${string}`]).toBe("#cf222e");
    expect(tokens["--message-code-token-string" as `--${string}`]).toBe("#0a3069");
    expect(tokens["--diff-inserted-text" as `--${string}`]).toBe("#1a7f37");
    expect(tokens["--diff-removed-text" as `--${string}`]).toBe("#cf222e");
  });

  it("switching from catppuccin-mocha to github-light changes keyword color", () => {
    const mocha = mapVsCodeColorsToTokens(
      getVsCodeThemePreset("vscode-catppuccin-mocha"),
    );
    const gh = mapVsCodeColorsToTokens(
      getVsCodeThemePreset("vscode-github-light"),
    );
    expect(mocha["--message-code-token-keyword"]).not.toBe(
      gh["--message-code-token-keyword"],
    );
    expect(mocha["--diff-inserted-text"]).not.toBe(
      gh["--diff-inserted-text"],
    );
  });

  it("diff bg/gutter are alpha-derived from diff inserted/removed hex", () => {
    const tokens = mapVsCodeColorsToTokens(
      getVsCodeThemePreset("vscode-catppuccin-mocha"),
    );
    // The mapper uses withAlpha on a hex; result contains "rgba" or "color-mix" depending on theme.
    // Either way, the bg/gutter values must NOT equal the text hex.
    expect(tokens["--diff-inserted-bg" as `--${string}`]).not.toBe(tokens["--diff-inserted-text" as `--${string}`]);
    expect(tokens["--diff-inserted-gutter" as `--${string}`]).not.toBe(tokens["--diff-inserted-text" as `--${string}`]);
    expect(tokens["--diff-removed-bg" as `--${string}`]).not.toBe(tokens["--diff-removed-text" as `--${string}`]);
    expect(tokens["--diff-removed-gutter" as `--${string}`]).not.toBe(tokens["--diff-removed-text" as `--${string}`]);
  });

  it("missing preset syntax and diff use appearance-aware fallbacks", () => {
    const darkTokens = mapVsCodeColorsToTokens({
      ...getVsCodeThemePreset("vscode-dark-modern"),
      syntax: undefined,
      diff: undefined,
    });
    const lightTokens = mapVsCodeColorsToTokens({
      ...getVsCodeThemePreset("vscode-light-modern"),
      syntax: undefined,
      diff: undefined,
    });

    expect(darkTokens["--theme-syntax-keyword"]).toBe("#8bd5ff");
    expect(darkTokens["--theme-diff-inserted-text"]).toBe("#2ea043");
    expect(lightTokens["--theme-syntax-keyword"]).toBe("#2f6fdd");
    expect(lightTokens["--theme-syntax-comment"]).toBe("#57606e");
    expect(lightTokens["--theme-diff-inserted-text"]).toBe("#1a7f37");
    expect(lightTokens["--theme-diff-removed-text"]).toBe("#cf222e");
  });

  it("invalid partial syntax data falls back per field", () => {
    const preset = getVsCodeThemePreset("vscode-github-light");
    const tokens = mapVsCodeColorsToTokens({
      ...preset,
      syntax: {
        ...PRESET_SYNTAX_TOKENS["vscode-github-light"],
        tag: "invalid",
      },
    });

    expect(tokens["--theme-syntax-keyword"]).toBe("#cf222e");
    expect(tokens["--theme-syntax-tag"]).toBe("#cf222e");
  });
});
