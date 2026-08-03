## 任务清单

### 1. 瘦身 useComposerAutocompleteState

- [x] 1.1 [P0][Depends: none][Input: `useComposerAutocompleteState.ts` 980 行实现与 `Composer.tsx:1024-1053` 消费事实][Output: hook 仅保留 `isAutocompleteOpen`（trigger 上下文检测）+ `handleTextChange` + `handleSelectionChange`，删除记忆/便签 IPC effect、文件打分、item 构建、`applyAutocomplete`、`handleInputKeyDown` 与失效入参][Verify: hook 内无 `projectMemoryFacade`/`noteCardsFacade`/`useComposerAutocomplete` 引用]
- [x] 1.2 [P0][Depends: 1.1][Input: `useComposerAutocomplete.ts`][Output: 整文件删除][Verify: `grep -rn "useComposerAutocomplete\b" src/` 无结果]

### 2. 收敛 Composer.tsx 调用点

- [x] 2.1 [P0][Depends: 1.1][Input: `Composer.tsx:1024-1053`][Output: 解构只保留 3 个使用中的输出，入参只传 `text`/`selectionStart`/`setText`/`setSelectionStart`][Verify: `npm run typecheck` 通过]

### 3. 命名残留清理

- [x] 3.1 [P3][Depends: none][Input: `ChatInputBoxAdapter.tsx:1-7` 头部注释][Output: 移除 ComposerInput 迁移叙事，改写为当前职责描述][Verify: 注释不再出现 `ComposerInput`]
- [x] 3.2 [P3][Depends: none][Input: `ComposerInputResponsiveness.guard.test.ts`][Output: `git mv` 为 `ChatInputResponsiveness.guard.test.ts`，describe 文案同步][Verify: 测试通过]

### 4. 测试收敛与验证

- [x] 4.1 [P0][Depends: 1.1][Input: `useComposerAutocompleteState.test.tsx` 775 行][Output: 收敛为瘦身后契约测试：trigger 上下文检测（`/`/`$`/`@`/`@@`/`@#` 激活、非 trigger 不激活、前缀字符约束）、text/selection 透传][Verify: `npx vitest run src/features/composer/hooks/useComposerAutocompleteState.test.tsx` 通过]
- [x] 4.2 [P0][Depends: 2.1, 4.1][Input: 全部改动文件][Output: typecheck / lint / composer 相关测试全绿][Verify: `npm run typecheck`、`npm run lint`、composer feature Vitest 套件通过]
- [x] 4.3 [P1][Depends: 4.2][Input: OpenSpec artifacts][Output: proposal / design / tasks / specs 补全][Verify: `openspec validate prune-composer-autocomplete-dead-paths --strict --no-interactive`]

### 5. Review-Discovered Closure

- [x] 5.1 [P1][Depends: review][Input: review 发现项][Output: 自 review 无发现项——diff 净删 1665 行，消费面已逐字段核对，composer 75 个测试文件全绿][Verify: typecheck/lint/vitest 均通过]
