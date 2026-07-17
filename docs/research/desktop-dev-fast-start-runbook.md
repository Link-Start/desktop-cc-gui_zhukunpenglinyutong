# ccgui 桌面开发版快速启动 Runbook

## 目标

把“启动桌面开发版”固化成可重复、可观测、可恢复的最短路径。以下命令均从当前 `mossx` repository root 执行。

## 当前入口

- 启动脚本：`scripts/dev-local.sh`
- npm script：`npm run tauri:dev`
- 运行模式：Tauri desktop dev（Vite frontend + Rust backend）
- 默认 Vite port：`1420`

## 标准快启流程

1. 确认处于 repository root：`git rev-parse --show-toplevel`。
2. 前台执行 `scripts/dev-local.sh`；需要后台运行时，保存本次启动 PID 和独立日志。
3. 验证：
   - 启动进程仍存活；
   - `1420` 端口由本次 Vite dev server 监听；
   - 日志没有新的 `Error`、`panic` 或 port conflict。
4. 回传启动 PID、日志路径与“可开始测试 / 尚未就绪”结论。

## 推荐命令

### 前台启动

```bash
zsh -lc 'source ~/.zshrc && scripts/dev-local.sh'
```

### 后台启动

```bash
zsh -lc 'source ~/.zshrc && nohup scripts/dev-local.sh > /tmp/mossx-dev-local.log 2>&1 & echo $! > /tmp/mossx-dev-local.pid && cat /tmp/mossx-dev-local.pid'
```

### 查看日志与端口

```bash
zsh -lc 'source ~/.zshrc && tail -f /tmp/mossx-dev-local.log'
zsh -lc 'source ~/.zshrc && lsof -nP -iTCP:1420 -sTCP:LISTEN || true'
```

### 停止本次后台启动

先停止 `/tmp/mossx-dev-local.pid` 记录的启动进程，不使用会误伤其他项目的全局 `pkill "tauri|vite|cargo"`：

```bash
zsh -lc 'source ~/.zshrc && pid=$(cat /tmp/mossx-dev-local.pid 2>/dev/null) && test -n "$pid" && kill -TERM "$pid" && rm -f /tmp/mossx-dev-local.pid'
```

随后用 `lsof` 复核 port；若 parent 已退出但 child 仍占用 `1420`，先确认该 PID 的 cwd/command 确属本项目，再人工结束对应进程。

## 常见问题

### `tauri: command not found`

按仓库 Shell Baseline 先从 login shell 验证本地 CLI：

```bash
zsh -lc 'source ~/.zshrc && npm run tauri -- --version'
zsh -lc 'source ~/.zshrc && test -x node_modules/.bin/tauri && echo found || echo missing'
```

仍失败时再检查 `npm install` 是否完成、当前 cwd 是否为 repository root、`node_modules/.bin` 是否存在；不要在第一次报错时直接断言 Tauri 未安装。

### `Port 1420 is already in use`

```bash
zsh -lc 'source ~/.zshrc && lsof -nP -iTCP:1420 -sTCP:LISTEN'
```

核对占用进程属于本项目后，执行 `kill <PID>`，再重新运行 `scripts/dev-local.sh`。未经 cwd/command 核验不要强制结束进程。

## Ready for Test

满足以下条件才判定“可测试”：

- `scripts/dev-local.sh` 启动的 Tauri/Vite/Rust process tree 仍在运行；
- `1420` port 已监听；
- app window 已出现或日志显示 Tauri dev 启动完成；
- 日志没有新的 fatal error、panic 或 port conflict。

首次启动或 Rust dependency 变化后会进行较长编译，这本身不是失败。实际 npm script、Tauri config 与 port 若发生变化，以 `package.json`、`scripts/dev-local.sh` 和 `src-tauri/tauri.conf.json` 为准。
