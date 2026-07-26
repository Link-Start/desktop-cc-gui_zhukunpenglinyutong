## Context

现有 annotation identity 只由 path、line range、body 生成。行号是位置描述，不是内容 identity；
文件编辑后无法判断旧行号是否仍指向原代码。

## Decisions

### Versioned exact anchor

`CodeAnnotationAnchor` 保存：

- `version: 1`
- `selectedText`
- 最多两行 `prefixText` / `suffixText`
- 基于三者生成的 deterministic fingerprint

Draft contract 将 `anchor` 设为 optional，保证旧调用方与历史内存数据继续可用。

### Bounded exact relocation

Resolver 先验证原行号内容。失配后只搜索原 start line 前后 120 行：

1. 候选必须与 `selectedText` exact match。
2. 单候选可直接重定位。
3. 多候选仅在 context fingerprint 唯一命中时重定位。
4. 仍有歧义或范围内无候选时返回 `stale`。

禁止 fuzzy matching 与无界全文件 scan，避免相似代码静默错绑。

### Consumer boundary

FileView 在已有 `visibleCodeAnnotations` memo 内解析 anchor，使 preview/editor 共用相同结果；
annotation 创建使用当前 `content` 生成 anchor。Prompt 额外携带 snapshot，旧 annotation 输出不变。

## Risks

- CRLF：anchor 创建与解析统一按 logical lines，snapshot 使用 `\n`。
- 大文件：搜索窗口固定，复杂度受选区长度与 241 个候选上限约束。
- 重复代码：宁可 `stale`，不做错误自动迁移。
