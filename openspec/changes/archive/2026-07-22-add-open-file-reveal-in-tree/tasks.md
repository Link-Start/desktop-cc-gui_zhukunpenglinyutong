## 1. Reveal Contract

- [x] 1.1 [P0] 定义一次性 file-tree reveal request 与 ancestor path derivation；输入为 workspace-relative file path，输出为 normalized target、全部 ancestor directories 与 monotonic request identity。依赖：无。验证：focused unit/component assertions。
- [x] 1.2 [P0] 在 `FileTreePanel` 消费 reveal request，复用既有 expansion/selection state 并在目标 row render 后执行 nearest scroll。依赖：1.1。验证：深层目录、重复请求、特殊字符 path 测试。

## 2. Surface Wiring

- [x] 2.1 [P0] 在 `FileViewPanel` content context menu 增加本地化“定位到文件”动作，仅调用 optional callback，不改变 tab/editor/filesystem state。依赖：1.1。验证：菜单 item 与 callback target 测试。
- [x] 2.2 [P0] 在 `useLayoutNodes` 连接 main surface：切换 Files panel 并发出 reveal request。依赖：1.2、2.1。验证：现有 layout contract/typecheck。
- [x] 2.3 [P0] 在 `FileExplorerWorkspace` 连接 detached surface：展开 collapsed sidebar 并发出 session-local reveal request。依赖：1.2、2.1。验证：workspace integration test。

## 3. Localization And Regression

- [x] 3.1 [P1] 为所有 `files` locale 增加 reveal action label，保持 key parity。依赖：2.1。验证：i18n key scan/typecheck。
- [x] 3.2 [P0] 补齐 `FileViewPanel`、`FileTreePanel`、`FileExplorerWorkspace` focused regression tests。依赖：1.2、2.2、2.3。验证：focused Vitest suites 全部通过。

## 4. Closure Gates

- [x] 4.1 [P0] 运行 lint、typecheck、focused tests 与 large-file gate，修复本变更引入的问题；full suite 按用户明确指令跳过。依赖：3.2。输出：零新增 error。验证：命令 exit 0。
- [x] 4.2 [P0] 执行 strict OpenSpec validation、implementation verification、spec sync 与 archive。依赖：4.1。输出：main specs 已同步且 change 已归档。验证：本 change 与两份 main specs strict valid；workspace 既有无关 change `fix-claude-cli-native-installer` 仍失败并已留痕。

## 5. Progressive Lazy Reveal Fix

- [x] 5.1 [P0] 修复单次 reveal request 在 progressive lazy directory chain 中被 expansion cleanup 提前裁剪的问题；仅展开当前 tree snapshot 已存在的 ancestor，并在下一层目录到达后自动继续。实现不得依赖文件扩展名、语言或固定目录深度。依赖：1.2。验证：通用无扩展名文件的单次请求回归测试。
- [x] 5.2 [P0] 运行受影响 focused Vitest、lint、typecheck、large-file gate 与 strict OpenSpec validation；更新 verification 并重新 sync/archive。full suite 按用户明确指令跳过。依赖：5.1。
