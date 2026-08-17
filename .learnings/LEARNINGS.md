# Learnings

## [LRN-20260817-006] user_feedback

**Logged**: 2026-08-17T19:17:54+08:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
思考区展开后段落之间空得太开，用户觉得「很多回车分隔」，观感不好。

### Details
User circled the large gaps inside a live thinking block (paragraph → “I’ll update 3 places:” → numbered items). This is mixed: reasoning models often emit one short sentence per blank-line paragraph, and our UI then amplifies it.

Two UI amplifiers:
1. `.reasoning-markdown > * + * { margin-top: 10px }` is overridden by later `.markdown > * + * { margin-top: 1.5em }` (same specificity). At 11px thinking font, that is ~16.5px plus list `margin: 0.4rem 0`.
2. Live lightweight parser flushes lists on a blank line, so `1. / 2. / 3.` with empty lines become three separate `<ol>` that all start at `1.` and each take a full paragraph gap.

Existing fragment normalizers only merge very short CJK shards (≤14 chars, ≥5 run), not ordinary English planning paragraphs.

### Suggested Action
Tighten thinking-only spacing (restore compact gap, beat `.markdown > * + *`), and optionally keep loose numbered lists as one list in lightweight mode. Do not collapse assistant body the same way.

### Metadata
- Source: user_feedback
- Related Files: src/styles/messages.part2.css, src/features/messages/rows/components/ReasoningRow.tsx, src/markdown/runtime/LiveMarkdown.tsx
- Tags: thinking, spacing, markdown, live-render

### Resolution
- **Resolved**: 2026-08-17T19:27:00+08:00
- **Notes**: Thinking markdown now uses a more specific 0.4em gap so it beats `.markdown > * + * { 1.5em }`. Lightweight parser keeps loose numbered/bulleted items in one list across blank lines.

---

## [LRN-20260817-005] correction

**Logged**: 2026-08-17T02:50:47+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
First-run uninstalled engine rows must install only from the explicit 安装 button, never from clicking the row/tab.

### Details
User clicked the PI CLI row and it started installing. They want the install chip to be a deliberate action. The row used a hover/selected swap: `.first-run-engine-block.is-missing:hover` and `.is-selected` hide「未安装」and reveal an absolutely positioned「安装」chip over the same hit target. Clicking the tab/right side of the row therefore fires install.

### Suggested Action
Always show a static 安装 chip on missing engines. Row/card click only selects. Remove the hover/selected overlay swap.

### Metadata
- Source: user_feedback
- Related Files: src/features/onboarding/components/FirstRunCliStep.tsx, src/styles/first-run-setup.css, src/features/onboarding/components/FirstRunCliStep.test.tsx
- Tags: onboarding, engines, install
- See Also: LRN-20260817-002

### Resolution
- **Resolved**: 2026-08-17T02:55:00+08:00
- **Notes**: Missing engine rows now always show a static 安装 chip. Card/row click only selects; install runs only from the chip.

---

## [LRN-20260817-004] correction

**Logged**: 2026-08-17T02:13:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
CLI onboarding footer needs a short skip-and-enter action next to Back, even after an engine is validated.

### Details
User circled the empty space beside 返回 and asked for “稍后安装，直接进入”, with shorter copy. After validation, the primary button becomes 验证通过，继续 and the old skip action disappears from the footer.

### Suggested Action
Keep a persistent text action `稍后再装` / `Install later` next to Back on the CLI step. It should call the existing skip handler and enter the app immediately.

### Metadata
- Source: user_feedback
- Related Files: src/features/onboarding/components/FirstRunSetupWizard.tsx, src/i18n/locales/zh/onboarding.ts, src/i18n/locales/en/onboarding.ts
- Tags: onboarding, engines, skip
- See Also: LRN-20260817-002

### Resolution
- **Resolved**: 2026-08-17T02:13:00+08:00
- **Notes**: Footer now shows 返回 + 稍后再装 on the CLI step.

---

## [LRN-20260817-003] correction

**Logged**: 2026-08-17T02:05:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
First-run engine rows should show a short version number, not the raw CLI string with product suffix.

### Details
User circled the truncated `版本 2.1.228 (Claude Co...` label and asked to keep version info on the same row without the long text. The raw detect/validate string includes `(Claude Code)` / `codex-cli`, and CSS `max-width: 9rem` plus ellipsis cut it off.

### Suggested Action
Reuse `formatEngineVersionLabel` so the row shows `版本 2.1.228`. Show the short version for every installed engine, not only the selected one. Do not ellipsis a short version.

### Metadata
- Source: user_feedback
- Related Files: src/features/onboarding/components/FirstRunCliStep.tsx, src/styles/first-run-setup.css, src/features/engine/utils/engineLabels.ts
- Tags: onboarding, engines, version
- See Also: LRN-20260817-002

### Resolution
- **Resolved**: 2026-08-17T02:05:00+08:00
- **Notes**: Short version on every installed engine row.

---

## [LRN-20260817-002] correction

**Logged**: 2026-08-17T01:45:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
First-run CLI step felt bulky: two large cards plus long marketing hints. Default list should be five compact engine rows.

### Details
User asked to default-show Claude Code, Codex, DeepSeek Harness, Kimi CLI, and OpenCode, and said the current cards occupied too much space. Primary list was only `claude` + `codex`; selected engine expanded into a second block with version + action. Marketing hints made every row two lines.

### Suggested Action
`FIRST_RUN_PRIMARY_ENGINES` = `claude`, `codex`, `dsh`, `kimi`, `opencode`. Keep `grok` / `pi` behind “更多引擎”. Compact engine rows: title + status on one line, version truncated inline, Install/Test on the same row. Do not nest buttons inside the choice card.

### Metadata
- Source: user_feedback
- Related Files: src/features/onboarding/types.ts, src/features/onboarding/components/FirstRunCliStep.tsx, src/styles/first-run-setup.css
- Tags: onboarding, engines, density

### Resolution
- **Resolved**: 2026-08-17T01:45:00+08:00
- **Notes**: Default five engines; compact single-row layout.

---

## [LRN-20260817-001] correction

**Logged**: 2026-08-17T01:39:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
Onboarding IDE step should only offer VS Code, Cursor, and IntelliJ; the previous IntelliJ glyph was a fake three-bar placeholder, not the official IJ product icon.

### Details
User reviewed the first-run editor picker and asked to keep only three choices. They also flagged that the IntelliJ icon looked wrong. The built-in fallback was a black rounded square with three magenta bars (`IDEA_SVG`), which reads more like a generic hamburger/menu mark than JetBrains' current "IJ + underscore" product icon. VS Code / Cursor already used official PNGs under `src/assets/app-icons/`.

### Suggested Action
Keep onboarding choices in `FIRST_RUN_IDE_CHOICES` (`vscode`, `cursor`, `idea`). Retain retired ids (`zed`, `sublime`, `none`) in `FIRST_RUN_IDES` so existing profiles still normalize. Use the official IntelliJ product icon (`src/assets/app-icons/idea.png`, exported from `/Applications/IntelliJ IDEA.app/Contents/Resources/idea.icns`) as `IDEA_APP_ICON`.

### Metadata
- Source: user_feedback
- Related Files: src/features/onboarding/types.ts, src/features/onboarding/components/FirstRunSetupWizard.tsx, src/features/app/utils/openAppIcons.ts, src/assets/app-icons/idea.png
- Tags: onboarding, icons, intellij

### Resolution
- **Resolved**: 2026-08-17T01:39:00+08:00
- **Notes**: Wizard now lists only the three editors; IntelliJ uses the official 256px product icon.

---
