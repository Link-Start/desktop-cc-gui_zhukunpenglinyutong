## Verification Plan

### Automated

```bash
openspec validate fix-codex-collab-subagent-live-parity --strict --no-interactive

# focused (adjust paths after implementation)
pnpm vitest run \
  src/features/status-panel/hooks/useStatusPanelData.test.ts \
  src/features/subagent-ui/utils/isSubagentTool.test.ts \
  src/features/subagent-ui/utils/syntheticSharedSubagentTools.test.ts \
  src/features/subagent-ui/utils/subagentViewModel.test.ts \
  src/utils/threadItems.test.ts \
  src/features/messages/utils/groupToolItems.test.ts

pnpm typecheck
```

### Manual — Codex (primary)

1. Native Codex 会话触发 multi-agent（spawn 3 子代理）。
2. **Live wait 阶段**（侧栏已有 3 子代理、幕布刷 wait）:
   - 幕布可见 3 张 SubAgent 卡（非仅 Collab: wait）。
   - 右侧 Agents tab 可见，可点开 inspector。
3. Turn 结束后不刷新或重开 history：小队仍正确，无双卡、无密文。
4. Shared Session 上 Codex 跑同类场景：live 不劣于 native 兜底。

### Manual — Other CLIs (isolation)

1. Claude：Agent/Task 实时 spawn — 行为与变更前一致。
2. Grok：Shared 或 native spawn_subagent — 小队与详情与变更前一致。
3. （可选）Kimi swarm — 无双卡回归。

### Pass criteria

- [ ] Automated gates green
- [ ] Codex live wait 验收 1–3 通过
- [ ] Other CLI smoke 无回归
- [ ] tasks.md 实现项全部勾选或显式 waiver
