## 1. Focused Regression Contract

- [x] 1.1 [P0][depends:none][I:`FileViewPanel` current marker tests + revised spec][O:default-open and Git-Blame-triggered assertions][V:focused Vitest proves ordinary open does not call `getGitFileFullDiff`, enabling Blame does] 更新 lazy marker behavior tests。
- [x] 1.2 [P0][depends:1.1][I:async Blame/diff mocks][O:failure isolation and stale-switch assertions][V:focused Vitest proves Blame reject does not suppress markers and file A result cannot update file B] 补齐 edge/error/race coverage。

## 2. Lazy Marker Implementation

- [x] 2.1 [P0][depends:1.1][I:`gitBlame.enabled`, `isLoading`, `currentFileRenderToken`, existing parser/service][O:Git-Blame-driven marker effect][V:tests from 1.1 pass] 移除 ordinary file-open eager diff，并在 initial read settled 后按需加载。
- [x] 2.2 [P0][depends:1.2,2.1][I:effect cleanup + marker state][O:disable/reset and stale-result isolation][V:error/race tests from 1.2 pass] 保证 toggle off、tab switch、snapshot replacement 不提交 stale markers。

## 3. Verification

- [x] 3.1 [P0][depends:2.2][I:touched frontend files][O:target test evidence][V:`npx vitest run src/features/files/components/FileViewPanel.test.tsx src/features/files/components/FileViewPanel.git-blame.test.tsx`] 运行 focused tests。
- [x] 3.2 [P0][depends:3.1][I:repository checks][O:static validation evidence][V:`npm run typecheck && npm run lint`] 运行 typecheck 与 lint。
- [x] 3.3 [P0][depends:3.2][I:OpenSpec artifacts][O:strict validation result][V:`openspec validate fix-file-editor-git-marker-load-race --type change --strict --no-interactive`] 验证 change artifacts。
