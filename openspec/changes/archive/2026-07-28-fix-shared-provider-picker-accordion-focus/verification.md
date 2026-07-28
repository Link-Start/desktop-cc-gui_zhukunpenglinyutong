## 验证报告：fix-shared-provider-picker-accordion-focus

### 摘要

| 维度 | 状态 |
|---|---|
| 完整性 | 5/5 tasks；1 modified requirement |
| 正确性 | 4/4 scenarios 已有实现与测试证据 |
| 一致性 | 遵循 design；只修改 Shared nested menu event lifecycle |

### 实现证据

- `ModelSelect.tsx`
  - Shared CLI submenu 使用受控 active group，并在 hover/keyboard activation 后保持当前
    submenu。
  - Shared Provider pointer path 在 `pointerdown` 阶段切换 accordion，避免 submenu 在
    `onSelect` 前卸载。
  - Pointer-generated click 被消费；keyboard synthesized click 继续进入 Radix
    `onSelect`。
  - Native `profiles` path 与 terminal Model selection 保持原行为。
- `ModelSelect.test.tsx`
  - 修复前回归测试稳定失败：点击 Shared Provider 后 menu 数量从 2 降为 1。
  - 修复后覆盖 A → B → B 的互斥展开/折叠、root/submenu 保持、Model terminal
    selection 关闭菜单。

### Gate Evidence

- Focused Vitest：8 suites，130 tests passed。
- `npm run typecheck`：passed。
- `npm run lint`：0 errors；8 个既存、非本次文件 warnings。
- Touched-file ESLint：passed。
- `npm run check:runtime-contracts`：passed。
- `openspec validate fix-shared-provider-picker-accordion-focus --strict --no-interactive`：
  passed。
- `git diff --check`：passed。

### 问题

- CRITICAL：无。
- WARNING：无。
- SUGGESTION：无。

### 最终评估

所有检查通过，满足归档条件。
