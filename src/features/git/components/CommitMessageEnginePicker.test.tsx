// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommitMessageEnginePicker } from "./CommitMessageEnginePicker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      const translations: Record<string, string> = {
        "git.generateCommitMessage": "Generate commit message",
        "git.generateCommitMessageLastConfig": "Use last configuration",
        "settings.languageChinese": "中文",
        "settings.languageEnglish": "English",
        "settings.cliGroupEnabledEmpty": "No enabled engines",
      };
      if (key === "settings.cliGroupEnabled") {
        return `Enabled (${options?.count ?? 0})`;
      }
      return translations[key] ?? key;
    },
  }),
}));

afterEach(cleanup);

const engines = [
  "claude",
  "codex",
  "grok",
  "kimi",
  "opencode",
] as const;

describe("CommitMessageEnginePicker", () => {
  it("shows every visible engine in one panel", () => {
    render(
      <CommitMessageEnginePicker
        engines={[...engines]}
        initialLanguage="zh"
        lastConfig={null}
        onGenerate={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    for (const engineName of [
      "Claude Code",
      "Codex",
      "Grok",
      "Kimi",
      "OpenCode",
    ]) {
      expect(screen.getByRole("button", { name: engineName })).toBeTruthy();
    }
  });

  it("uses the selected language and generates immediately on engine click", () => {
    const onGenerate = vi.fn();
    const onDismiss = vi.fn();

    render(
      <CommitMessageEnginePicker
        engines={[...engines]}
        initialLanguage="zh"
        lastConfig={null}
        onGenerate={onGenerate}
        onDismiss={onDismiss}
      />,
    );

    const englishButton = screen.getByRole("button", { name: "English" });
    const chineseButton = screen.getByRole("button", { name: "中文" });
    expect(chineseButton.getAttribute("aria-pressed")).toBe("true");
    expect(englishButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.mouseDown(englishButton);
    fireEvent.click(englishButton);

    expect(englishButton.getAttribute("aria-pressed")).toBe("true");
    expect(chineseButton.getAttribute("aria-pressed")).toBe("false");
    expect(englishButton.getAttribute("data-selected")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Kimi" }));

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onGenerate).toHaveBeenCalledWith("en", "kimi");
  });

  it("keeps the last configuration as a one-click shortcut", () => {
    const onGenerate = vi.fn();

    render(
      <CommitMessageEnginePicker
        engines={[...engines]}
        initialLanguage="zh"
        lastConfig={{ engine: "grok", language: "en" }}
        onGenerate={onGenerate}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Use last configuration/,
      }),
    );

    expect(onGenerate).toHaveBeenCalledWith("en", "grok");
  });
});
