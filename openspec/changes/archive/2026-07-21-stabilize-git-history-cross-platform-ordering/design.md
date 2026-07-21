## Context

Repository palette 先按 identity hash 取 slot；hash collision 时按 sorted repository roots 依次 linear probe。当前排序使用默认 `localeCompare()`，branch group 与 branch row 也使用同一 API。默认 collation 受 Windows/macOS/Linux 的 ICU 与 locale 影响，因此 collision winner 和 UI order 不是跨平台确定的。

## Goals / Non-Goals

**Goals:**

- 让 identity ordering 只依赖字符串 UTF-16 code units，不依赖 host locale。
- Repository color、local/remote group、branch leaf 使用一致 comparator。
- 保持 exact empty root、Windows `\` separator input、Unicode 与大小写 identity 不被 normalize/merge。

**Non-Goals:**

- 不实现 natural sort 或 case-insensitive sort。
- 不改 backend path normalization、palette 或 Git branch payload。

## Decisions

### 1. 在 Git feature utility 导出纯 comparator

新增 `compareGitIdentity(left, right)`，只使用严格 `<` / `>`。Repository color utility 已是 Composer 与 Git History 的 shared Git layer，把 comparator 放在同一文件可避免 parallel implementation。

Alternative：在两个组件内各写 inline comparator，代码更少但会再次产生排序语义漂移。

### 2. 保留 exact strings，不做 path normalization

Comparator 不转换 separator、case 或 Unicode normalization。`repositoryRoot` 来自 backend canonical summary，Windows-style input 仍可由 service/backend boundary 处理；UI identity 必须原样传递。

Alternative：UI 统一 `\` 为 `/` 会合并潜在不同 caller identity，扩大 contract 且可能破坏 Map lookup。

### 3. 用已知碰撞 identity 锁定 color determinism

Test 使用两个落入同一 initial slot 的已知 roots，随后对正序/逆序输入断言 mapping 相同；再覆盖 `services\\api`、大小写与 Unicode ordering。Branch component test 锁定 group/leaf 顺序。

## Risks / Trade-offs

- [Risk] code-unit order 不符合部分语言的自然阅读顺序 → identity tree 优先跨平台稳定；不承担 locale-aware catalog 排序。
- [Risk] 16 个以上 repository 必然复用颜色 → 保持现有 bounded palette；本次只保证同一 identity set 的稳定分配。

## Migration Plan

直接替换 pure comparator，无 persisted state 或 backend migration。Rollback 为恢复 `localeCompare()`，但会重新引入跨平台漂移。

## Open Questions

无。
