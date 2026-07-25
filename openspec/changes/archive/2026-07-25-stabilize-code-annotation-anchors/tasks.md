## 1. Contract 与 helper

- [x] 1.1 增加 optional versioned anchor type
- [x] 1.2 实现 anchor 创建与 bounded exact relocation
- [x] 1.3 补齐旧数据、行漂移、重复候选、越界测试

## 2. Production integration

- [x] 2.1 FileView 创建 annotation 时保存当前内容 anchor
- [x] 2.2 FileView 展示时消费 relocated line range
- [x] 2.3 Prompt 附带 selected snapshot

## 3. Verification

- [x] 3.1 运行 code-annotation/FileView 增量 Vitest
- [x] 3.2 运行 typecheck 与 touched-file ESLint
- [x] 3.3 完成 review、strict OpenSpec validate 与 archive
