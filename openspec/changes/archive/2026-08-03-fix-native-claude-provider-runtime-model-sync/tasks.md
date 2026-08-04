# Tasks: fix-native-claude-provider-runtime-model-sync

## 1. Backend — 进程 env 隔离

- [x] 1.1 `claude.rs` spawn：对 `CLAUDE_PROVIDER_ROUTING_ENV_KEYS` 先 `env_remove`，再 `cmd.envs(provider_env)`
- [x] 1.2 单测：`build_command_clears_parent_routing_env_before_provider_apply`
- [x] 1.3 local / 无 provider_env 路径不清理（保持跟随全局）

## 2. Frontend — send-time re-resolve + repair

- [x] 2.1 `claudeManagedRuntimeModel.ts`：`resolveClaudeManagedRuntimeModel` / legal set / foreign residue
- [x] 2.2 `useAppShellComposerModelSection`：Claude 用 resolver 产出 `resolvedModel`；repaired 时 auto `handleSelectModel`
- [x] 2.3 composerSelectionResolver 的 id/model 对齐 repair 结果
- [x] 2.4 单测：deepseek catalog + k3 repair

## 3. Frontend — native target 投影

- [x] 3.1 `Composer.nativeSessionTarget`：runtime 优先 catalog `model`，禁止档位 id / k3 冒充
- [x] 3.2 models 进入 useMemo deps

## 4. 回归验证

- [x] 4.1 vitest：`claudeManagedRuntimeModel.test.ts`
- [x] 4.2 cargo test --lib `clears_parent_routing`
- [x] 4.3 `openspec validate fix-native-claude-provider-runtime-model-sync --strict`
- [ ] 4.4 手工：DeepSeek 渠道发送无 `passed k3`；父 shell 导出脏 ANTHROPIC_MODEL 仍正确
