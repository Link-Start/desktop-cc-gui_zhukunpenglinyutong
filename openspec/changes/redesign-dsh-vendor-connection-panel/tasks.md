# redesign-dsh-vendor-connection-panel tasks

## 1. OpenSpec

- [x] 1.1 创建 change（proposal / design / tasks / spec delta）
- [x] 1.2 `openspec validate redesign-dsh-vendor-connection-panel --type change --strict --no-interactive`

## 2. Host status contract

- [x] 2.1 扩展 `CodexDoctorResult` 可选 `hostDescribe`，纯函数把 doctor 映射成 checking / missing / down / connected
- [x] 2.2 新增 `ensure_dsh_host` Tauri command + daemon 影子：走 `ensure_ready`，即使用户关了自动启动也允许显式 spawn
- [x] 2.3 前端 `ensureDshHost` / `runDshDoctor` 接线；探测路径 MUST NOT spawn

## 3. 设置页方案 A

- [x] 3.1 `DshConnectionPanel`：状态卡、所有权说明、可折叠连接设置（Host+Port 一行、自动启动、自定义路径）
- [x] 3.2 `VendorSettingsPanel` DSH 分支改用新面板，保留 CliLifecycle 安装/版本
- [x] 3.3 样式走 vendor-panels token，不另起主题
- [x] 3.4 i18n：zh / en 完整；其余 locale 已补齐 key

## 4. 测试

- [x] 4.1 vitest：状态映射 + 面板四态 + 打开 UI + 保存 host/port + 立即启动
- [x] 4.2 现有 `VendorSettingsPanel` DSH 用例改到新 IA
- [x] 4.3 focused vitest 绿
- [x] 4.4 已连接「关闭」、transport i18n、状态卡左右布局不压线
- [x] 4.5 Windows extra search path 含 Hermes / Scoop / mise

## 5. 跟进（用户验收后补）

- [x] 5.1 品牌头按钮靠右瘦身；启动中可关闭
- [x] 5.2 修 DSH 头泄漏 Claude 版本（provider key + request-id + engine filter）
- [x] 5.3 已连接页也提供「关闭」；`stop_host` 可停本机 adopted listener
- [x] 5.4 transport 错误映射 `dshDescribeFailed`
- [x] 5.5 状态卡单一子节点 + 按钮相对整卡垂直居中，去掉压线 hairline
- [x] 5.6 Windows 扫描 Hermes / Scoop / mise / fnm 常规 path

## 6. 验收

- [x] 6.1 用户确认设置页可用，回写提案后提交
- [ ] 6.2 归档本 change（verify / sync / archive 另做）

## 7. Windows 启动按钮

- [x] 7.1 supervisor 启动改走 `node.exe` + `bin.js`（或 `cmd /D /S /C`），禁止执行 POSIX shim
- [x] 7.2 子进程提前退出时带回 stderr；Windows `kill_child` 用 `taskkill /T`
- [ ] 7.3 本机点「立即启动」验收：host.describe 成功；关闭仍可用
- [x] 7.4 Windows spawn 前修复 0 字节 `sharp/dist/constructor.mjs`（Mac 不改写）；本机 `node lib/bin.js web` 已打出 `dsh web: http://127.0.0.1:13080`
