import type { GitPullStrategyOption } from "@/services/tauri";

export type GitPullExplanationKey = `git.historyPullExplanation${string}`;
export type GitPullExplanationOption =
  | "default"
  | GitPullStrategyOption
  | "--no-commit"
  | "--no-verify";
export type GitPullExplanationTone = "neutral" | "attention" | "muted";

export type GitPullExplanationEffect = {
  option: GitPullExplanationOption;
  descriptionKey: GitPullExplanationKey;
  tone: GitPullExplanationTone;
};

export type GitPullExplanation = {
  intentKey: GitPullExplanationKey;
  effectRows: GitPullExplanationEffect[];
  willNotHappenKey: GitPullExplanationKey;
};

type GitPullExplanationInput = {
  strategy: GitPullStrategyOption | null;
  noCommit: boolean;
  noVerify: boolean;
};

type StrategyExplanation = {
  intentKey: GitPullExplanationKey;
  effectKey: GitPullExplanationKey;
  willNotHappenKey: GitPullExplanationKey;
};

type AdditiveEffect = {
  descriptionKey: GitPullExplanationKey;
  tone: GitPullExplanationTone;
};

type StrategyContext = GitPullStrategyOption | "default";

const STRATEGY_EXPLANATIONS: Record<StrategyContext, StrategyExplanation> = {
  default: {
    intentKey: "git.historyPullExplanationIntentDefault",
    effectKey: "git.historyPullExplanationEffectDefault",
    willNotHappenKey: "git.historyPullExplanationWillNotDefault",
  },
  "--rebase": {
    intentKey: "git.historyPullExplanationIntentRebase",
    effectKey: "git.historyPullExplanationEffectRebase",
    willNotHappenKey: "git.historyPullExplanationWillNotRebase",
  },
  "--ff-only": {
    intentKey: "git.historyPullExplanationIntentFfOnly",
    effectKey: "git.historyPullExplanationEffectFfOnly",
    willNotHappenKey: "git.historyPullExplanationWillNotFfOnly",
  },
  "--no-ff": {
    intentKey: "git.historyPullExplanationIntentNoFf",
    effectKey: "git.historyPullExplanationEffectNoFf",
    willNotHappenKey: "git.historyPullExplanationWillNotNoFf",
  },
  "--squash": {
    intentKey: "git.historyPullExplanationIntentSquash",
    effectKey: "git.historyPullExplanationEffectSquash",
    willNotHappenKey: "git.historyPullExplanationWillNotSquash",
  },
};

const NO_COMMIT_EFFECTS: Record<StrategyContext, AdditiveEffect> = {
  default: {
    descriptionKey: "git.historyPullExplanationEffectNoCommitDefault",
    tone: "neutral",
  },
  "--rebase": {
    descriptionKey: "git.historyPullExplanationEffectNoCommitRebase",
    tone: "muted",
  },
  "--ff-only": {
    descriptionKey: "git.historyPullExplanationEffectNoCommitFfOnly",
    tone: "muted",
  },
  "--no-ff": {
    descriptionKey: "git.historyPullExplanationEffectNoCommitNoFf",
    tone: "neutral",
  },
  "--squash": {
    descriptionKey: "git.historyPullExplanationEffectNoCommitSquash",
    tone: "muted",
  },
};

const NO_VERIFY_EFFECTS: Record<StrategyContext, AdditiveEffect> = {
  default: {
    descriptionKey: "git.historyPullExplanationEffectNoVerifyDefault",
    tone: "attention",
  },
  "--rebase": {
    descriptionKey: "git.historyPullExplanationEffectNoVerifyRebase",
    tone: "muted",
  },
  "--ff-only": {
    descriptionKey: "git.historyPullExplanationEffectNoVerifyFfOnly",
    tone: "muted",
  },
  "--no-ff": {
    descriptionKey: "git.historyPullExplanationEffectNoVerifyNoFf",
    tone: "attention",
  },
  "--squash": {
    descriptionKey: "git.historyPullExplanationEffectNoVerifySquash",
    tone: "muted",
  },
};

export function resolveGitPullExplanation({
  strategy,
  noCommit,
  noVerify,
}: GitPullExplanationInput): GitPullExplanation {
  const strategyContext = strategy ?? "default";
  const strategyExplanation = STRATEGY_EXPLANATIONS[strategyContext];
  const effectRows: GitPullExplanationEffect[] = [
    {
      option: strategyContext,
      descriptionKey: strategyExplanation.effectKey,
      tone: "neutral",
    },
  ];

  if (noCommit) {
    effectRows.push({
      option: "--no-commit",
      ...NO_COMMIT_EFFECTS[strategyContext],
    });
  }

  if (noVerify) {
    effectRows.push({
      option: "--no-verify",
      ...NO_VERIFY_EFFECTS[strategyContext],
    });
  }

  return {
    intentKey: strategyExplanation.intentKey,
    effectRows,
    willNotHappenKey: strategyExplanation.willNotHappenKey,
  };
}
