/** Light 层最短停留，避免冷启前几秒点权限/模型按钮同拍挂 ComposerImpl。 */
export const COMPOSER_GATE_MIN_LIGHT_MS = 6_000;
/** 有输入后还须再静默这么久，才允许升 full。 */
export const COMPOSER_GATE_INPUT_QUIET_MS = 1_800;
/** 无人操作时的升级上限；必须 ≥ MIN_LIGHT，不能再走旧的 2.8s。 */
export const COMPOSER_GATE_IDLE_UPGRADE_MS = 8_000;

export function shouldUpgradeComposerFromLight(input: {
  elapsedMs: number;
  hadInputSinceMount: boolean;
  quietForMs: number;
  recentInput: boolean;
  startupGateReady?: boolean;
  minLightMs?: number;
  inputQuietMs?: number;
  idleUpgradeMs?: number;
}): boolean {
  const minLightMs = input.minLightMs ?? COMPOSER_GATE_MIN_LIGHT_MS;
  const inputQuietMs = input.inputQuietMs ?? COMPOSER_GATE_INPUT_QUIET_MS;
  const idleUpgradeMs = input.idleUpgradeMs ?? COMPOSER_GATE_IDLE_UPGRADE_MS;
  if (!input.startupGateReady) {
    return false;
  }
  if (input.elapsedMs < minLightMs || input.recentInput) {
    return false;
  }
  const quietEnough =
    !input.hadInputSinceMount || input.quietForMs >= inputQuietMs;
  return quietEnough || input.elapsedMs >= idleUpgradeMs;
}
