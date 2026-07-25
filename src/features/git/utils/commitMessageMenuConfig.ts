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
 * 一键生成的配置来源: 存在持久化配置且该引擎当前可执行才有效,
 * 否则返回 null, 调用方应回落到引擎菜单。
 */
export function readExecutableCommitMessageConfig(): LastCommitMessageConfig | null {
  const config = readLastCommitMessageConfig();
  return config && isEngineExecutionEnabled(config.engine) ? config : null;
}
