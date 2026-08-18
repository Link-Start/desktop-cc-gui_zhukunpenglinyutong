import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("MessagesAnchorRail styles", () => {
  it("uses a left full-height rail with bounded single-anchor previews", () => {
    const shellCss = readFileSync(
      resolve(process.cwd(), "src/styles/messages.part1-shell.css"),
      "utf8",
    );
    const statusCss = readFileSync(
      resolve(process.cwd(), "src/styles/messages.status-shell.css"),
      "utf8",
    );

    expect(shellCss).toMatch(/\.messages-shell\s*\{[\s\S]*container-type:\s*inline-size;/);
    expect(statusCss).toMatch(
      /\.messages-anchor-rail\s*\{[\s\S]*left:\s*12px;[\s\S]*top:\s*calc\([^;]+;[\s\S]*bottom:\s*22px;/,
    );
    expect(statusCss).toMatch(
      /\.messages-anchor-rail\s*\{[\s\S]*display:\s*flex;[\s\S]*gap:\s*2px;/,
    );
    expect(statusCss).toMatch(
      /\.messages-anchor-item\s*\{[\s\S]*position:\s*relative;[\s\S]*flex:\s*0 0 8px;[\s\S]*height:\s*8px;/,
    );
    expect(statusCss).toMatch(
      /\.messages-anchor-dash::before\s*\{[\s\S]*width:\s*9px;[\s\S]*height:\s*2px;/,
    );
    expect(statusCss).toMatch(
      /\.messages-anchor-dash\.is-proximity-3::before\s*\{[\s\S]*width:\s*18px;/,
    );
    expect(statusCss).toMatch(
      /\.messages-anchor-dash\.is-proximity-2::before\s*\{[\s\S]*width:\s*22px;/,
    );
    expect(statusCss).toMatch(
      /\.messages-anchor-dash\.is-proximity-1::before\s*\{[\s\S]*width:\s*26px;/,
    );
    expect(statusCss).toMatch(
      /\.messages-anchor-dash\.is-proximity-0::before,[\s\S]*\.messages-anchor-dash:hover::before,[\s\S]*\.messages-anchor-dash:focus-visible::before\s*\{[\s\S]*width:\s*32px;/,
    );
    const activeDashRule =
      statusCss.match(/\.messages-anchor-dash\.is-active::before\s*\{([^}]*)\}/)?.[1] ??
      "";
    expect(activeDashRule).toContain("background: var(--text-strong);");
    expect(activeDashRule).not.toContain("width:");
    expect(statusCss).toMatch(
      /\.messages-anchor-preview\s*\{[\s\S]*left:\s*36px;[\s\S]*width:\s*clamp\(240px,\s*42cqw,\s*420px\);[\s\S]*max-width:\s*calc\(100cqw - 98px\);[\s\S]*padding:\s*10px 12px;[\s\S]*border-radius:\s*10px;/,
    );
    expect(statusCss).toMatch(
      /\.messages-anchor-item\.is-preview-down \.messages-anchor-preview\s*\{[\s\S]*transform:\s*none;/,
    );
    expect(statusCss).toMatch(
      /\.messages-anchor-item\.is-preview-up \.messages-anchor-preview\s*\{[\s\S]*bottom:\s*-2px;/,
    );
    expect(statusCss).toContain("-webkit-line-clamp: 3;");
    expect(statusCss).not.toContain(".messages-anchor-panel");
    expect(statusCss).not.toContain(".messages-anchor-list");
    expect(statusCss).not.toMatch(
      /@container\s*\(max-width:\s*960px\)\s*\{[\s\S]*\.messages-anchor-rail\s*\{[\s\S]*display:\s*none;/,
    );
    expect(statusCss).not.toMatch(
      /@media\s*\(max-width:\s*1100px\)\s*\{[\s\S]*\.messages-anchor-rail\s*\{[\s\S]*display:\s*none;/,
    );
  });
});

describe("conversation lightweight typography", () => {
  it("keeps lightweight banner and row titles at regular text emphasis", () => {
    const shellCss = readFileSync(
      resolve(process.cwd(), "src/styles/messages.part1-shell.css"),
      "utf8",
    );
    const promptSource = readFileSync(
      resolve(
        process.cwd(),
        "src/features/messages/timeline/components/ConversationLightweightPrompt.tsx",
      ),
      "utf8",
    );
    const rowRendererSource = readFileSync(
      resolve(
        process.cwd(),
        "src/features/messages/timeline/components/TimelineRowRenderer.tsx",
      ),
      "utf8",
    );

    expect(promptSource).not.toContain("<strong>{t(titleKey)}</strong>");
    expect(rowRendererSource).not.toContain(
      '<strong>\n            {t("messages.conversationLightweightRowTitle"',
    );
    expect(shellCss).not.toMatch(
      /\.messages-lightweight-mode-banner\s+strong,[\s\S]*?font-size:\s*var\(--message-title-font-size\)/,
    );
    expect(shellCss).not.toMatch(
      /\.messages-lightweight-row-summary-main\s*>\s*strong,[\s\S]*?white-space:\s*nowrap;/,
    );
  });
});
