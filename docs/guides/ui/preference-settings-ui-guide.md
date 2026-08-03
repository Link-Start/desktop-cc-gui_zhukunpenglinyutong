---
type: guide
status: active
---

# Preference Settings UI / UX Guide

> **内容类型**：UI Guide
> **生命周期**：active
> **最后校准**：2026-08-03 · mossx `0.7.16`
> **事实源**：Settings components、`src/styles/settings.part2.basic-redesign.css`、`src/styles/settings.session-management.css`
> **更新触发器**：Settings information architecture、shared preference class 或 responsive breakpoint 变化
> **Audience**：参与设置页、偏好面板、表单型管理界面的工程师与 AI agent
> **Scope**：Settings 内偏好列表型界面；对话主界面、Composer 不在本指南主范围
> **导航**：[`README.md`](README.md) · [`../../README.md`](../../README.md)

---

## 1. 设计目标（What “好看” means here）

本产品设置页追求的不是「功能展示墙」，而是 **克制的桌面偏好面板**：

| 目标 | 含义 |
|------|------|
| **清新** | 白/浅底卡片、细分隔、少装饰色、无大块黑底选中 |
| **可扫读** | 左标题+说明、右控件；一眼完成「改什么 / 现在是什么」 |
| **主次分明** | 主路径常驻；高级项折叠；批量操作按需出现 |
| **少框套框** | 同一工作区尽量 **一块外壳 + 内部分割**，避免层层卡片 |
| **实色可读** | 弹窗/浮层必须 **不透明**；禁止透出背后内容 |

**参考气质**: macOS System Settings / Cursor Preferences / 现代 desktop preference list。  
**非目标**: 营销落地页、炫技动画、信息密度极高的运维控制台（除非明确是 power-user 工作台并单独设计）。

---

## 2. 核心版式：Preference Row

### 2.1 标准行

```
┌──────────────────────────────────────────────────────────┐
│  标题（13–14px / 600）              [ 控件 ]              │
│  说明（12px / muted，≤ ~44–52ch）                         │
└──────────────────────────────────────────────────────────┘
```

- **左**：`title` + 可选 `description`
- **右**：switch / select / segmented / 主操作按钮组
- **分隔**：同卡内用 **1px hairline**，不用再包一层小卡

### 2.2 推荐 class（实现约定）

| Class | 用途 |
|-------|------|
| `settings-basic-surface` | 页面内容纵向 stack |
| `settings-pref-card` / `settings-basic-group-card--list` | 圆角分组卡 |
| `settings-pref-row` | 标准左右行 |
| `settings-pref-row--stack` | 纵向：主行 + 展开控件/提示 |
| `settings-pref-meta` / `settings-pref-title` / `settings-pref-desc` | 左文案 |
| `settings-pref-control` | 右控件区 |
| `settings-pref-segmented` / `settings-pref-segment` | 分段选择 |
| `settings-pref-select` / `settings-pref-select-wrap` | 下拉 |
| `settings-pref-reset` | 脏态文字链「重置」 |
| `settings-pref-hint` / `settings-pref-hint-badge` | 状态提示 |
| `settings-web-btn` / `settings-web-btn--primary` | 轻量动作按钮（跨页复用风格） |

主要样式落点：

- `src/styles/settings.part2.basic-redesign.css` — 基础设置 / 偏好列表
- `src/styles/settings.session-management.css` — 会话管理工作台（含 `--redesign`）

### 2.3 何时用 Stack 行

- 开关下方还有 **二级输入**（如代理 URL、Token 输入）
- 一行装不下的 **字段 + 说明**
- 需要 **hint / 错误 / 成功** 附属信息

---

## 3. 信息架构原则

### 3.1 分组

设置内容按 **用户任务** 分组，而不是按技术模块堆叠：

| 好的分组 | 差的分组 |
|----------|----------|
| 运行状态 / 服务配置 / 访问信息 | 所有字段从上到下无边界 |
| 启用 → 表单 → 操作 | 标题重复出现两次 + 大黑卡 |
| 列表浏览 / 点进编辑 | 每行塞满 5 个输入框 |

### 3.2 三级信息

1. **主路径**（永远可见）：开关、常用下拉、启动/停止、列表  
2. **次要操作**（轻按钮）：刷新、复制、测试  
3. **高级 / 危险**（折叠或选中后出现）：拉取模式细节、批量删除、脏态重置  

### 3.3 页面内子导航

多子页（如邮件：文档 / 发送 / 收信 / 会话）使用 **浅底分段 Tab**，禁止：

- 大面积黑底「选中块」
- 与侧栏导航同级的厚重样式抢戏

推荐模式：`settings-email-seg-tabs` / `settings-pref-segmented` 同类视觉。

---

## 4. 控件模式库

### 4.1 Switch

- 右对齐，与标题垂直居中
- 标题描述说明「开了会怎样」，不要只写技术名词

### 4.2 Segmented control（2–4 选项）

用于：主题浅/深、幕布宽窄、发送快捷键、布局左右、类型应用/命令/访达  

```
[ 选项A ][ 选项B ][ 选项C ]
  ↑ 浅轨 + 选中 pill（白底细阴影）
```

- 选中态：**表面色 + 轻阴影**，不是 primary 黑底大块  
- 选项内可有小图标，但不要每行左侧再加装饰 icon 列表

### 4.3 Select / 预设下拉

- 有限枚举优先 **下拉预设**，避免 range 滑块（除非连续微调是刚需）  
- 示例：界面缩放 `80%–150%` 每 10%；代码字号 `10–15px`  
- 历史非法值可 **临时插入选项** 保持 controlled，用户改回预设后消失  

### 4.4 脏态（Dirty）操作

| 规则 | 示例 |
|------|------|
| 等于默认 → 隐藏「重置」 | UI 缩放 100%、字号 11px |
| 有未保存变更 → 才显示「保存」 | 端口改过、Token 草稿变更 |
| 选中 0 条 → 隐藏批量危险操作 | 归档/删除/移动 |

### 4.5 列表 + 弹窗编辑（复杂实体）

**适用**: 打开方式（多字段应用目标）、未来类似「可增删实体」  

| 浏览态 | 编辑态 |
|--------|--------|
| 图标 + 名称 + 副标题 + 轻操作 | **不透明 Dialog** 内纵向表单 |
| 一行可扫读 | 完成/关闭时 commit |

**禁止**: 在列表行内横向塞满 label/type/name/args 输入框。

弹窗硬性要求：

- `background` 必须实色（`#fff` / 深色 `#1c1c1e`）  
- 禁止 `color-mix(..., transparent)` 导致透底  
- 禁止依赖 `backdrop-filter` 当「设计」  

参考实现：`OpenAppsSection.tsx` + `.settings-open-app-dialog*`

### 4.6 摘要列表 / 工作台（复杂管理）

**适用**: 会话管理（树 + 筛选 + 列表）  

推荐：

```
┌ topbar: 标题·数量 | 模式分段 | 刷新 ─────────────┐
│ [高级：拉取模式 ▾]  默认折叠，只显示当前徽章        │
├────────────┬────────────────────────────────────┤
│ 左导航树    │  面包屑 / 筛选 / 统计                 │
│            │  批量条（仅 has-selection）            │
│            │  列表                                  │
└────────────┴────────────────────────────────────┘
```

- **一块外壳** `shell`，左右用内部分割线，不要左右各一套大卡再外包第三层  
- 高级配置（attribution mode 等）**折叠**，不要占首屏一半  
- 批量操作 **contextual**  

参考：`SessionManagementSection` + `.settings-project-sessions--redesign`

---

## 5. 视觉 token（经验值）

这些是会话改版中稳定下来的「手感」，可与主题变量混用，但 **观感应一致**：

| Token | 建议 |
|-------|------|
| 卡片圆角 | 12–14px |
| 控件高 | 32–36px（设置区） |
| 行左右 padding | ~14–18px |
| 行最小高度 | ~58–64px（含说明） |
| 标题 | 13–13.5px / font-weight 600–650 |
| 说明 | 12px / muted / line-height 1.4–1.5 |
| 分段轨道 | 2–4px gap，选中 pill radius ~8–10px |
| 阴影 | 仅选中 pill / 弹窗；列表本身尽量无重阴影 |
| 状态点 | 8px；绿=就绪/运行，灰=停止，红=失败 |

深色模式：弹窗与关键浮层用 **实色深底**，不要半透明 glass 透出列表。

---

## 6. 反模式清单（Do Not）

1. **大黑底选中卡**（发送快捷键、拉取模式、邮件 Tab）  
2. **行内图标墙**（每个字段左侧 Palette/Sparkles…）  
3. **滑块 + 百分比 + 保存 + 重置** 四件套抢戏  
4. **0 选中时展示一排 disabled 危险按钮**  
5. **标题写两遍**（Card 头 + 表单内 Label 同文案）  
6. **嵌套卡片超过两层**（卡中卡中卡）  
7. **半透明弹窗**导致背后按钮文字透出  
8. **把运维日志式长句**直接塞进主列表打断扫描（应进 hint / 折叠）  
9. **横向表单地狱**：一行 4+ 输入控件  
10. **为了「功能完整」牺牲主路径**（高级项默认展开）

---

## 7. 页面类型 → 推荐模板

### A. 简单偏好页（外观 / 行为）

```
surface
  ├─ pref-card (list of pref-rows)
  ├─ pref-card (另一组相关开关)
  └─ pref-card (字体 / 颜色等)
```

范例：`BasicAppearanceSection`、`BasicBehaviorSection`

### B. 配置 + 运行状态（Web 服务）

```
page head
card: 运行状态（服务 / daemon）
card: 服务配置（资源 / 端口 / token）
card: 访问信息（RPC / URL / runtime token）
```

范例：`WebServiceSettings`

### C. 多 Tab 表单（邮件）

```
page head
seg-tabs（浅分段）
active tab:
  pref-card
    enable row
    form-grid (2 col on desktop)
    status banner
    actions row
```

范例：`EmailSenderSettings`

### D. 实体列表（打开方式）

```
pref-card
  summary list (icon + title + meta + light actions)
  footer add button
Dialog (opaque) for edit
```

范例：`OpenAppsSection`

### E. 管理型工作台（会话管理）

```
topbar
advanced details (collapsed)
workbench shell
  nav | main (filters + contextual bulk + list)
```

范例：`SessionManagementSection`（`settings-project-sessions--redesign`）

---

## 8. 文案与 i18n

- 标题：动宾或名词短语，短  
- 说明：说明 **影响范围 / 后果**，不复述标题  
- 按钮：`保存` / `完成` / `重置` / `刷新`；危险操作用明确动词 `删除已选`  
- 新增 key 时至少补 `zh` + `en`（`src/i18n/locales/*/settings.ts`）  
- 测试环境可能回退为 key 本身，交互测试应用 role/label/testid，勿写死某一语言文案（除非 fixture 固定 locale）

---

## 9. 实现检查清单（给 AI 的 Definition of Done）

改完设置类 UI 后自检：

- [ ] 主路径是否 **5 秒内能扫完**？  
- [ ] 是否仍有 **黑底大选中块** 或 **半透明弹窗**？  
- [ ] 同卡是否用 hairline 分隔，而非再包小卡？  
- [ ] 默认态是否隐藏重置/保存/批量危险操作？  
- [ ] 复杂实体是否 **列表浏览 + 弹窗/抽屉编辑**？  
- [ ] 高级项是否默认折叠？  
- [ ] 控件高度是否与邻行一致（~32–36px）？  
- [ ] 窄屏（≤900px）是否改为单列且控件可点？  
- [ ] 相关 unit test 是否更新并通过？  
- [ ] 新增 class 是否落在现有 settings CSS 分层，而非散落 magic style？

---

## 10. 关键代码索引

| 区域 | 入口 |
|------|------|
| 基础设置壳 | `src/features/settings/components/SettingsView.tsx` |
| 外观 | `src/features/settings/components/settings-view/sections/BasicAppearanceSection.tsx` |
| 行为 | `src/features/settings/components/settings-view/sections/BasicBehaviorSection.tsx` |
| 打开方式 | `src/features/settings/components/settings-view/sections/OpenAppsSection.tsx` |
| Web 服务 | `src/features/settings/components/settings-view/sections/WebServiceSettings.tsx` |
| 邮件 | `src/features/settings/components/settings-view/sections/EmailSenderSettings.tsx` |
| 会话管理 | `src/features/settings/components/settings-view/sections/SessionManagementSection.tsx` |
| 偏好列表 CSS | `src/styles/settings.part2.basic-redesign.css` |
| 会话工作台 CSS | `src/styles/settings.session-management.css` |
| 设置样式入口 | `src/styles/settings.css` |

---

## 11. 给后续 AI 的最短指令（可复制）

```text
改造本项目设置/偏好 UI 时，遵循 docs/guides/ui/preference-settings-ui-guide.md：
- 左标题+说明、右控件的 preference row
- 浅色分段/下拉，禁止大黑底选中卡
- 脏态才显示保存/重置；选中后才显示批量危险操作
- 复杂实体用列表+不透明 Dialog 编辑
- 高级设置默认折叠；工作台用单外壳内分割
- 样式优先复用 settings-pref-* / settings-web-btn / session --redesign
完成后按文档 §9 检查清单自检并跑相关测试。
```

---

## 12. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-01 | 初版：汇总基础设置（外观/行为/打开方式/Web/邮件）与项目管理-会话管理改版共识 |
