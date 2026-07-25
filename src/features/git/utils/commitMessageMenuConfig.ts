import type { CommitMessageEngine } from "../../../services/tauri";
import { isEngineExecutionEnabled } from "../../../utils/engineExecutionPolicy";
import {
  readLastCommitMessageConfig,
  type LastCommitMessageConfig,
} from "../../../utils/commitMessage";

/**
 * GitDiffPanel 与 GitHistoryWorktreePanel 共享的 AI commit message 配置事实源。
 * 两个面板的引擎菜单项、一键生成配置判定必须从这里取, 避免再次平行演化。
 */
export const COMMIT_MESSAGE_MENU_ENGINES = ["codex", "claude"] as const satisfies readonly CommitMessageEngine[];

/**
 * 可见 quick option 的配置来源：persisted engine 必须仍在当前 menu catalog
 * 且允许执行；legacy/retired engine 不得绕过显式选择入口。
 */
export function readExecutableCommitMessageConfig(): LastCommitMessageConfig | null {
  const config = readLastCommitMessageConfig();
  return config &&
    COMMIT_MESSAGE_MENU_ENGINES.some((engine) => engine === config.engine) &&
    isEngineExecutionEnabled(config.engine)
    ? config
    : null;
}
