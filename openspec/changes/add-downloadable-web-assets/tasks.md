## 1. Release Artifact

- [x] 1.1 [P0, depends: none] 在 `.github/workflows/release.yml` 新增单次 Web assets build/package job，输入为当前 `dist` 与 App version，输出为版本化 ZIP 和 `.sha256`；验证 workflow YAML、archive 内容检查与 final release upload 列表。

## 2. Rust Managed Assets

- [x] 2.1 [P0, depends: none] 在 `src-tauri/Cargo.toml` 引入最小 `zip` dependency，并将 `assets_export.rs` 改为 managed assets status/manifest/path validation；验证 missing/ready/version mismatch focused Rust tests。
- [x] 2.2 [P0, depends: 2.1] 实现 checksum/ZIP download、安全 staging extraction 与 rollback-safe activation，输入为 App version/release URL，输出为统一 `WebAssetsStatus`；验证 corrupt checksum、path traversal、missing entrypoint、成功替换与旧目录保留测试。
- [x] 2.3 [P0, depends: 2.2] 暴露并注册 `get_web_assets_status`、`install_web_assets` Tauri commands，更新 `src/services/tauri/appServer.ts` contract；验证 command/service 字段保持 camelCase 一致。

## 3. Daemon Resolution

- [x] 3.1 [P0, depends: 2.1] 将 daemon `data_dir` 注入 `WebServiceRuntime` 并把 `web-assets/current` 加入 asset candidates，同时保留 env/development/bundle 优先级；验证 already-running daemon candidate、explicit override 与 development fallback tests。
- [x] 3.2 [P0, depends: 2.1, 3.1] 收敛 desktop daemon bootstrap：仅对验证通过的 managed directory 设置 `MOSSX_WEB_ASSETS_DIR`，移除 embedded frontend export 依赖；验证 missing assets 不阻塞 daemon RPC，而 ready assets 可被 Web Service 使用。

## 4. Settings UI

- [x] 4.1 [P0, depends: 2.3] 在 `WebServiceSettings` 接入 checking/missing/installing/ready/failed 状态、安装/重检动作与 start gating，输入为 Tauri status contract，输出为可恢复 UI；验证 focused Vitest 的缺失、成功、失败、重复点击和启动禁用场景。
- [x] 4.2 [P1, depends: 4.1] 补齐中英文 i18n 与 scoped settings styles，验证所有用户可见文案均走 translation key 且 compact layout 不改变既有 Web Service 控件层级。
- [x] 4.3 [P1, depends: 4.1] ready 状态保留“重新下载安装”，并为下载安装、本地安装、重新检测增加按钮级 loading、busy 文案与 cross-action disabling；验证 focused Vitest 的覆盖安装与检测中反馈。
- [x] 4.4 [P1, depends: 4.3] 在 assets row 下方增加用户主动操作的开始、成功、backend error 日志，自动首屏检测保持静默；验证 focused Vitest 的安装、重检与取消反馈。

## 5. Verification

- [x] 5.1 [P0, depends: 1.1, 2.3, 3.2, 4.2] 执行 focused Vitest、focused Rust tests、`npm run typecheck`、`npm run lint`、`npm run check:runtime-contracts` 与 OpenSpec strict validation，输出通过项和任何 pre-existing failure，不执行 `git commit`。
- [x] 5.2 [P1, depends: 5.1] 执行 `check` 与 `check-cross-layer` 审核 UI → service → command → filesystem → daemon → Release contract，确认无未注册 command、字段 drift、旧 embedded export 残留或无关扩散。

## 6. Local Package Import

- [x] 6.1 [P0, depends: 2.2, 4.1] 扩展 OpenSpec 与 code-level contract，定义选择 ZIP、相邻 `.sha256`、取消 no-op 与旧安装保留边界。
- [x] 6.2 [P0, depends: 6.1] 实现 native ZIP picker、`install_web_assets_from_file` command/service 与共享校验安装路径，补齐 i18n 和 focused Rust/Vitest coverage。
- [x] 6.3 [P0, depends: 6.2] 在本地生成当前版本 ZIP/`.sha256`，执行 archive smoke、focused tests、lint/typecheck/build、OpenSpec strict validation，不执行 `git commit`。

## 7. Reinstall Correctness

- [x] 7.1 [P0, depends: 4.3] 修复 ready 状态 remote reinstall 的提前返回，确保用户主动操作真实进入 Release checksum/ZIP 下载链路。
- [x] 7.2 [P0, depends: 7.1] 覆盖安装失败时保留已验证的 current，并返回本次真实错误，禁止假成功或错误阻断现有 Web Service。
- [x] 7.3 [P0, depends: 7.2] 执行 focused Rust/Vitest、typecheck、lint、runtime contracts 与 OpenSpec strict validation，不执行 `git commit`。

## 8. Release Backward Compatibility

- [x] 8.1 [P0, depends: 1.1] 修复 Web archive smoke 在 `pipefail` 下的 SIGPIPE，并将 Web artifact 收敛为 optional release enhancement；Web ZIP 缺失或构建失败 MUST NOT 阻断原有 macOS、Windows、Linux Release。
- [x] 8.2 [P0, depends: 8.1] 验证 archive smoke、workflow dependency truth table、YAML 与 OpenSpec strict validation，不执行 `git commit`。
