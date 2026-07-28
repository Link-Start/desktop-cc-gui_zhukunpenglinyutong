# 补齐 Shared terminal final 持久化基石

关联 OpenSpec：`fix-shared-terminal-final-persistence`

## 问题

`liveTextExternalization` 只让首 delta 进入 reducer，但 Shared `turn/completed`
在见过 delta 后跳过 authoritative final。Shared snapshot 因此把流式壳文本当作
完成态落盘。

## 交付

1. terminal final 原位收敛到同一 assistant item。
2. canonical metadata overlay 不降级完整正文。
3. 恢复当前已截断会话，操作前备份。
4. 增量测试与 OpenSpec/Trellis 闭环。

## 验收

- `Cl` + 完整 final 收敛为一条完整 assistant message。
- 重载后全文、reasoning、target badge 均保留。
- 不恢复逐 delta 根 reducer dispatch。
