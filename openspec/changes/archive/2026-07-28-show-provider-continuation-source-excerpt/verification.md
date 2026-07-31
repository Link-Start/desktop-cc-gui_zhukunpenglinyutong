# Verification

## Automated evidence

- `npm exec vitest run src/features/shared-session/components/ProviderContinuationContextCard.test.tsx src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx`
  - PASS：2 files，36 tests。
- `npm run lint`
  - PASS：0 errors；8 warnings 均位于本次未修改的既有文件。
- `npm run typecheck`
  - PASS。
- `npm run build`
  - PASS；保留既有 CSS property、dynamic/static import 与 large chunk warnings。
- `openspec validate show-provider-continuation-source-excerpt --strict --no-interactive`
  - PASS。
- `openspec validate native-provider-continuation --type spec --strict --no-interactive`
  - PASS。
- `git diff --check`
  - PASS。

## Contract evidence

- Pure helper 覆盖 latest user + following assistant、空白 message、tool/reasoning trailing items、user-only、assistant-only 与 empty history。
- Layout focused test 证明 `threadItemsByThread[sourceSessionId]` 被投影到 continuation card。
- Component tests 保留 collapsed → expanded → source callback → collapsed 往返，并覆盖 line clamp、icon-only action、missing source 与 excerpt fallback。
- 实现没有 history loader、backend、persistence、streaming reducer 或 `Messages` render tree 变更。
- `openspec-verify-change`：6/6 tasks，1/1 modified requirement，7/7 scenarios 均有 implementation/test evidence；design decisions 与 code pattern 一致，无 CRITICAL/WARNING。

## Manual evidence

- 未启动 App，遵守用户“我自己测你别拉 app”的边界。
- 视觉密度、dark/light theme 与真实长文本效果由用户后续人工验收。
