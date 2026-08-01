# Messages Tests Explorer Nesting PRD

## 关联变更

- OpenSpec change: `refactor-messages-presentation-architecture`
- Scope: VS Code workspace Explorer presentation
- Delivery mode: configuration-only, zero runtime behavior change

## 目标

1. 保持所有 tests 与源码的物理路径不变。
2. 将 `Messages.*` tests、smoke test 与 heavy-history fixture 折叠到 `Messages.tsx`。
3. 将 `Markdown.*` tests 折叠到 `Markdown.tsx`。
4. 将 `MessagesRows.*` tests 折叠到 `MessagesRows.tsx`。
5. 默认收起 nested files，降低 `components` 一级目录的视觉噪音。

## 硬约束

- 不移动、拆分或重命名测试文件。
- 不修改 import、mock、runtime code 或 test discovery。
- 不改变 large-file baseline。
- 不覆盖仓库其他 VS Code settings。

## 验收标准

- `.vscode/settings.json` 是合法 JSON。
- 32 个 `components` 一级 test / fixture 文件全部被 nesting patterns 覆盖。
- `MessagesRows.*` 不被 `Messages.*` pattern 误收纳。
- `git diff --check` 通过。
