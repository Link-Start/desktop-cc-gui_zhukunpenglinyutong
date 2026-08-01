## Why

Code annotation 当前只保存 `path + lineRange + body + source`。文件在标注后插入或删除行时，
marker 仍绑定旧行号，发送给 Composer 的引用也可能指向错误代码。单纯扩大 fuzzy search 会把
重复代码错误绑定到另一个位置，因此需要可验证、有限范围的 anchor contract。

## What Changes

- annotation 创建时保存选中代码 snapshot、前后 context 与 versioned fingerprint。
- 文件内容变化时，在原位置附近做 bounded exact relocation。
- 无 anchor 的历史 annotation 保持兼容；无法唯一定位时保留原引用并报告 stale，不猜测位置。
- prompt 附带选中代码 snapshot，使模型不只依赖可能漂移的行号。

## Capabilities

### New Capabilities

- `code-annotation-anchor-stability`: 定义 annotation anchor 的创建、持久化、重定位与降级行为。

## Impact

- Contract：`src/features/code-annotations/types.ts`
- Anchor helpers：`src/features/code-annotations/utils/codeAnnotations.ts`
- File surface：`src/features/files/components/FileViewPanel.tsx`
- Focused tests：code annotation helper 与 FileView annotation tests
- Dependency：无新增 package
