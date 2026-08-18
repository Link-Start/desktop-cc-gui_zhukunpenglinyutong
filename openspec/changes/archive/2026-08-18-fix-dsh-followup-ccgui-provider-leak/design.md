# Design: fix-dsh-followup-ccgui-provider-leak

## 决策

DSH 续聊的 model 账本必须 fail-closed。mossx 只 denylist 自己的保留 provider `ccgui`，不维护 DSH provider 白名单。

不可信时 `model=null`，`send_user_turn` 跳过 `session.selectModel`。已有 session 保持上一轮 provider/model。这比猜一个 DSH 默认值更安全。

## 数据流

```
resolver.id / runtime
        │
        ▼
resolveDshSendFallbackCatalogId
  dsh-pending-* → composerEnginePrefs.dsh.modelId
  dsh:<session> → null（禁止用全局 pref 改已有 session）
        │
        ▼
resolveDshModelForSend
  1. 候选：catalogId → runtimeModel → fallback（仅 pending）
  2. 必须是 `provider/model` 且 provider ≠ ccgui
  3. 否则 null
        │
        ▼
send_user_turn
  Some(trusted) → selectModel
  None          → 沿用 session / describe
  provider=ccgui（若仍漏进来）→ mossx Err，不打 host
```

## 为什么不锁 activeEngine

collision fix 已经锁 thread。再锁 `activeEngine` 会和「用户看一眼别的引擎 catalog」冲突。send 侧按 `resolvedEngine === "dsh"` 过滤 model 更小。

## picker

skip 轴是 **thread ownership**，不是 drifted `activeEngine`：

`threadEngine === "dsh" && targetEngine !== "dsh"`

`activeEngine` 已漂到 grok 时，点 `ccgui/grok-4.5` 仍 skip DSH ledger；点本 catalog `ggggg/grok-4.6` 仍写 DSH thread。跨引擎精确 id 仍写入 **目标引擎** pref，便于以后显式切到 Grok。

Claude 上点 kimi 精确 id 的既有用例保持：那不是 DSH thread。

## 风险

| 风险 | 处理 |
|---|---|
| 续聊省略 selectModel 后换不了 DSH 模型 | 用户在 DSH catalog 里点选仍走可信 id |
| 误伤 `ccgui` 作为用户 DSH provider 名 | 极低；`ccgui` 是 mossx managed 保留名，DSH 也没有该 adapter |
| 后端拒收文案 | mossx 可读错误，不再把 host 的 `model-unavailable` 丢给用户 |

## 不回写 ADR

未改 engine registry / Shared / provider binding / canonical fact / compiler / ACK / recovery exit。
