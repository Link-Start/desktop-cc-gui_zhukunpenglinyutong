/**
 * 静态 subAgent 显示名池（ccgui / desktop-cc-gui 贡献者）。
 *
 * 事实源：GitHub
 *   https://github.com/zhukunpenglinyutong/desktop-cc-gui/contributors
 * 快照：2026-08（gh api，已去掉 bot）。
 *
 * weight = GitHub contributions 原值，加权循环使用，不额外拉高。
 * 运行时禁止再拉 git log / GitHub API。
 */
export type PersonaAuthorEntry = {
  name: string;
  /** 与 GitHub contributions 一致的权重 */
  weight: number;
  githubLogin?: string | null;
  avatarKey?: string | null;
};

export const PERSONA_AUTHOR_POOL: readonly PersonaAuthorEntry[] = [
  {
    name: "chenxiangning",
    weight: 3475,
    githubLogin: "chenxiangning",
    avatarKey: "chenxiangning",
  },
  {
    name: "zhukunpenglinyutong",
    weight: 770,
    githubLogin: "zhukunpenglinyutong",
    avatarKey: "zhukunpenglinyutong",
  },
  {
    name: "godilley",
    weight: 20,
    githubLogin: "godilley",
    avatarKey: "godilley",
  },
  {
    name: "watsonctl",
    weight: 20,
    githubLogin: "watsonctl",
    avatarKey: "watsonctl",
  },
  {
    name: "AlphaCatMeow",
    weight: 14,
    githubLogin: "AlphaCatMeow",
    avatarKey: "AlphaCatMeow",
  },
  {
    name: "hpstream",
    weight: 14,
    githubLogin: "hpstream",
    avatarKey: "hpstream",
  },
  {
    name: "Juddd",
    weight: 14,
    githubLogin: "Juddd",
    avatarKey: "Juddd",
  },
  {
    name: "zhanghangdr",
    weight: 4,
    githubLogin: "zhanghangdr",
    avatarKey: "zhanghangdr",
  },
  {
    name: "youcaizhang",
    weight: 1,
    githubLogin: "youcaizhang",
    avatarKey: "youcaizhang",
  },
  {
    name: "junxin367",
    weight: 1,
    githubLogin: "junxin367",
    avatarKey: "junxin367",
  },
] as const;

export const PERSONA_FALLBACK_NAME = "Agent";

export function resolveGithubProfileUrl(login: string | null | undefined): string | null {
  const normalized = login?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  return `https://github.com/${encodeURIComponent(normalized)}`;
}

export function resolveGithubAvatarUrl(
  login: string | null | undefined,
  size = 80,
): string | null {
  const normalized = login?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  return `https://github.com/${encodeURIComponent(normalized)}.png?size=${size}`;
}
