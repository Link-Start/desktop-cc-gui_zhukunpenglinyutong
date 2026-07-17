import { describe, expect, it } from "vitest";
import type { GitPullStrategyOption } from "@/services/tauri";
import enGit from "@/i18n/locales/en/git";
import esGit from "@/i18n/locales/es/git";
import frGit from "@/i18n/locales/fr/git";
import hiGit from "@/i18n/locales/hi/git";
import jaGit from "@/i18n/locales/ja/git";
import koGit from "@/i18n/locales/ko/git";
import ptBrGit from "@/i18n/locales/pt-BR/git";
import ruGit from "@/i18n/locales/ru/git";
import zhTwGit from "@/i18n/locales/zh-TW/git";
import zhGit from "@/i18n/locales/zh/git";
import { resolveGitPullExplanation } from "./gitPullExplanation";

const STRATEGIES: Array<GitPullStrategyOption | null> = [
  null,
  "--rebase",
  "--ff-only",
  "--no-ff",
  "--squash",
];

const MERGE_ONLY_CONFIG_CAVEAT_KEYS = [
  "historyPullExplanationIntentNoFf",
  "historyPullExplanationIntentSquash",
  "historyPullExplanationWillNotNoFf",
  "historyPullExplanationWillNotSquash",
] as const;

type MergeOnlyConfigCaveatCopy = Record<
  (typeof MERGE_ONLY_CONFIG_CAVEAT_KEYS)[number],
  string
>;

const PULL_COPY_LOCALES: Array<{
  locale: string;
  copy: MergeOnlyConfigCaveatCopy;
}> = [
  { locale: "en", copy: enGit.git },
  { locale: "es", copy: esGit.git },
  { locale: "fr", copy: frGit.git },
  { locale: "hi", copy: hiGit.git },
  { locale: "ja", copy: jaGit.git },
  { locale: "ko", copy: koGit.git },
  { locale: "pt-BR", copy: ptBrGit.git },
  { locale: "ru", copy: ruGit.git },
  { locale: "zh-TW", copy: zhTwGit.git },
  { locale: "zh", copy: zhGit.git },
];

describe("resolveGitPullExplanation", () => {
  it.each(
    STRATEGIES.flatMap((strategy) =>
      [false, true].flatMap((noCommit) =>
        [false, true].map((noVerify) => ({ strategy, noCommit, noVerify })),
      ),
    ),
  )("returns one row per active option for %o", (selection) => {
    const explanation = resolveGitPullExplanation(selection);

    expect(explanation.effectRows).toHaveLength(
      1 + Number(selection.noCommit) + Number(selection.noVerify),
    );
    expect(explanation.effectRows[0]?.option).toBe(selection.strategy ?? "default");
    expect(explanation.intentKey).toMatch(/^git\.historyPullExplanationIntent/);
    expect(explanation.willNotHappenKey).toMatch(
      /^git\.historyPullExplanationWillNot/,
    );
  });

  it.each([
    {
      selection: { strategy: "--no-ff" as const, noCommit: true, noVerify: false },
      expectedKey: "git.historyPullExplanationEffectNoCommitNoFf",
    },
    {
      selection: { strategy: "--ff-only" as const, noCommit: true, noVerify: false },
      expectedKey: "git.historyPullExplanationEffectNoCommitFfOnly",
    },
    {
      selection: { strategy: "--squash" as const, noCommit: true, noVerify: false },
      expectedKey: "git.historyPullExplanationEffectNoCommitSquash",
    },
    {
      selection: { strategy: "--rebase" as const, noCommit: true, noVerify: true },
      expectedKey: "git.historyPullExplanationEffectNoVerifyRebase",
    },
  ])("uses context-aware additive copy for $selection", ({ selection, expectedKey }) => {
    const explanation = resolveGitPullExplanation(selection);

    expect(
      explanation.effectRows.some((effect) => effect.descriptionKey === expectedKey),
    ).toBe(true);
  });

  it("distinguishes active hook bypass from no-additional-effect combinations", () => {
    const mergeExplanation = resolveGitPullExplanation({
      strategy: "--no-ff",
      noCommit: false,
      noVerify: true,
    });
    const rebaseExplanation = resolveGitPullExplanation({
      strategy: "--rebase",
      noCommit: false,
      noVerify: true,
    });

    expect(mergeExplanation.effectRows.at(-1)?.tone).toBe("attention");
    expect(rebaseExplanation.effectRows.at(-1)?.tone).toBe("muted");
  });

  it.each(PULL_COPY_LOCALES)(
    "keeps merge-only outcomes conditional on Git rebase configuration in $locale",
    ({ copy }) => {
      for (const key of MERGE_ONLY_CONFIG_CAVEAT_KEYS) {
        expect(copy[key]).toMatch(/rebase/i);
      }
    },
  );
});
