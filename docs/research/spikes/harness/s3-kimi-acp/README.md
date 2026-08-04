---
type: evidence
status: historical
---

# S3 Spike Harness — Kimi CLI 0.27.0 ACP 探测

针对 `kimi acp`（stdio, newline-delimited JSON-RPC）的可重复探测脚本。
报告见 `../../2026-07-27-s3-kimi-acp.md`。

## 结构

- `lib/acp-client.mjs` — 最小 ACP client：spawn `kimi acp`、NDJSON 收发、
  agent->client request 自动应答（permission 自动 allow、fs 读写直落沙箱）、
  全部 raw line 落 transcript。
- `probes/probe1-initialize.mjs` — initialize 握手 + session/new（含 model 参数探测）。
- `probes/probe2-prompt.mjs` — trivial prompt 全 lifecycle（1 次模型调用）。
- `probes/probe3-resume.mjs` — tool_call 捕获 + session/load 断连回放（1 次模型调用）。
- `probes/probe3c-load-text-session.mjs <sessionId>` — 对纯文本 session 交叉验证 replay（0 次模型调用）。
- `probes/probe4-cancel.mjs` — session/cancel 中断语义（1 次模型调用）。
- `probes/probe5-model.mjs` — model selection 三条路径（0 次模型调用）。
- `probes/probe6-list-resume.mjs [sessionId]` — session/list + session/resume（0 次模型调用）。
- `evidence/` — 仅提交 evidence policy；运行时 raw transcript（`>>` 发出 / `<<` 收到 / `!!` stderr）与结构化 updates dump 只做本地分析，不入库。

## 复跑

```bash
export SPIKE_CWD=/tmp/mossx-s3-spike   # 可选，默认即此值
node probes/probe1-initialize.mjs
node probes/probe2-prompt.mjs
node probes/probe3-resume.mjs
node probes/probe4-cancel.mjs
node probes/probe5-model.mjs
node probes/probe6-list-resume.mjs
```

注意：probe2/3/4 各消耗 1 次真实模型调用；全量复跑共 3 次。
实验 cwd 固定为 /tmp 沙箱；probe3 会在其中写入 `spike-marker.txt`。
