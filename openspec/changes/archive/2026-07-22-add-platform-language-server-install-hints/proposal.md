## Why

Navigation fallback 只说明 language server 不可用，普通用户仍不知道下一步该运行什么。当前最小收益方案是在原提示内按 language 与 operating system 展示可复制的安装建议，不扩展 Settings 或 installer。

## 目标与边界

- 仅在 `provider-unavailable` fallback 中显示建议，避免 timeout/process exit 被误判为未安装。
- 区分 macOS、Windows、Linux command syntax，并区分 Java、TypeScript/JavaScript、Rust。
- 保持 explicit-query-only，不新增 backend query、polling 或 editor hot-path work。

## What Changes

- 在现有 navigation fallback note 中增加 platform/language-specific command hint。
- 支持复制 command；clipboard 不可用时保持提示可手工选择，不中断导航结果。
- Java 在 macOS 使用 Homebrew command；Windows/Linux 使用各自 shell 打开 Eclipse 官方下载入口，避免承诺不存在的统一 package manager。
- TS/JS 使用官方 npm global install command；Rust 使用 rustup component command。

## 非目标

- 不自动下载、执行安装、修改 PATH 或环境变量。
- 不新增 language server Settings 页面、状态探测或 installer backend。
- 不改变 semantic provider 与 fast-search fallback 算法。

## 方案对比

1. **现有提示内展示命令（采用）**：改动小、与失败上下文最近、无后台成本。
2. Settings 安装中心：闭环更完整，但引入检测、下载、权限和持久化，本轮不需要。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `file-view-code-intelligence-navigation`: provider 缺失时展示 platform/language-specific install hint 与 copy action。

## Impact

- Frontend：navigation utility、result panel、localized copy、focused tests 与 compact styles。
- Backend/API/dependencies：无变更、无新增依赖。

## 验收标准

- macOS/Windows/Linux × Java/TS-JS/Rust 生成正确且有界的提示。
- 只有 `provider-unavailable` 显示安装建议。
- command 可复制；结果列表、重试、typing/hover performance contract 不变。
