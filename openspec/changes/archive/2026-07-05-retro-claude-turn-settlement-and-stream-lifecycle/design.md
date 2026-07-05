## Context

记录移除 /context probe、result grace settlement、残留进程组 cleanup、stderr drain timeout 等 runtime critical path。

Claude runtime 的 turn lifecycle 是高风险链路。用户看到“生成中”是否结束，取决于 result event、stderr tail、process group cleanup、frontend live state 多个环节。任何一个环节无限等待，UI 就会卡在 generating。

## Decisions

- `result` 是 turn settlement 的 terminal signal，但允许 bounded tail handling。
- stderr drain 必须有 timeout，不能无限阻塞。
- 残留 process group 必须被 bounded cleanup，避免污染下一轮。
- Usage/context 不通过 `/context` 热路径探测。

## Risks And Guardrails

- 结算过早会丢尾部事件。
- 结算过晚会造成 generating 卡死。
- 防线：bounded grace + bounded drain + tests。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-claude-turn-settlement-and-stream-lifecycle --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
