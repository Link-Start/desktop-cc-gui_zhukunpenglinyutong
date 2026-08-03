## 1. Menu Group Contract

- [x] 1.1 [P0][Depends: none][Input: `WorkspaceMenuGroup` model][Output: explicit collapsible/default-collapsed fields and workspace-actions configuration][Verify: `useSidebarMenus.test.tsx`] 扩展 menu group contract，并仅将 workspace-actions 配置为默认折叠。

## 2. Overlay Interaction

- [x] 2.1 [P0][Depends: 1.1][Input: group collapse contract][Output: local collapse state, accessible toggle header, conditional action rendering][Verify: `SidebarWorkspaceMenuOverlay.test.tsx`] 实现 group toggle，不改变 action、pin 与 submenu handler。
- [x] 2.2 [P1][Depends: 2.1][Input: toggle markup][Output: feature-scoped chevron/header styles][Verify: lint + visual selector review] 补齐默认折叠 affordance 与 theme-token 样式。

## 3. Verification

- [x] 3.1 [P0][Depends: 2.1, 2.2][Input: completed implementation][Output: regression evidence][Verify: focused Vitest + `npm run typecheck` + `npm run lint` + strict OpenSpec validation] 运行 frontend 与 behavior contract 门禁。
