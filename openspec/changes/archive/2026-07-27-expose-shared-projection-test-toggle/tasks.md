## 1. Shared Projection Flag Contract

- [x] 1.1 [P0, depends: none] 在 Shared Projection DataSource 导出 storage key 与读写 helper；输入为 boolean，输出为 localStorage override，验证默认/开启/关闭单测。

## 2. Settings Test Control

- [x] 2.1 [P0, depends: 1.1] 在 `OtherSection` 增加带 i18n 文案的测试开关；输入为 effective flag，输出为 local override + reload，验证 toggle focused test。
- [x] 2.2 [P1, depends: 2.1] 补齐中英文文案，明确 dark launch、自动刷新与 V0 fallback。

## 3. Foundation Checklist Cognition Pass

- [x] 3.1 [P0, depends: none] 为 Wave 0–6 每张任务表新增“大白话说明 / 改变点 / UI 变化”，输出保持原编号、依赖、验收、状态不变。
- [x] 3.2 [P1, depends: 3.1] 整理远期任务说明并复核 Change A/B 边界，不把计划项写成已实现。

## 4. Verification

- [x] 4.1 [P0, depends: 2.2] 运行 Shared Projection DataSource 与 OtherSection focused Vitest。
- [x] 4.2 [P0, depends: 3.2] 运行 typecheck、scoped lint、Markdown table/check 与 OpenSpec strict validation。
