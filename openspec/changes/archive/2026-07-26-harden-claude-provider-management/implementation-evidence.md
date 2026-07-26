# Implementation Evidence

## Storage ownership

- `claude-model-mapping` 是唯一 write owner；两个 legacy key 只由
  `migrateModelMappingStorage` 读取与 best-effort 删除。
- canonical value 存在时永远优先；legacy-only 会一次性写 canonical；
  repeated migration 幂等。malformed 与 cleanup failure 进入 typed warning。
- provider activation sync 只 dispatch canonical storage event，不再 triple
  write / triple event。

## Typed error contract

- load、save、switch、reorder、delete、storage 统一返回
  `ClaudeProviderActionResult`，error 保留 action、message 与原始 cause。
- reorder / switch 失败会 reload durable state，再暴露错误；save / delete
  失败不会关闭为成功状态。
- `VendorSettingsPanel` 用 `role="alert"` 显示 provider error，用户不再面对
  静默失败。

## Verification

- focused Vitest 覆盖 canonical-wins、legacy-only、repeat、malformed、
  save/switch/reorder/delete failure。
- existing reorder 与 active provider behavior 保持；TypeScript 与 strict
  OpenSpec validation 通过。
