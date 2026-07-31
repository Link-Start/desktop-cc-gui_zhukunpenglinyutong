# unify-conversation-canvas 多角度 Review（2026-08-01）

> **范围**：工作树未提交改动（轻量墙下线 + Grok/Kimi/OpenCode live tool 水管 + Claude 对齐策略）  
> **用途**：产品/工程通读用；手测前对照  
> **关联**：`conversation-canvas-structure-2026-07-31.md` · `canvas-live-tool-projection-matrix-2026-08-01.md` · OpenSpec `unify-conversation-canvas`

---

## 0. 30 秒结论

| 问题 | 答案 |
|------|------|
| 这批改完「像 Claude 了吗」？ | **信息架构上更像**（读/写可见、bash 藏）；**过程保真度仍不如** Claude 原生协议 |
| 水管接好了吗？ | **Grok = jsonl 旁路桥（已硬化 baseline/offset）**；Kimi/OpenCode = 原有 stream + 映射补强 |
| 能不能上主线？ | 需手测三引擎；代码层 P0/P1 已修 resume 重放与增量 tail；**仍未 git commit** |

---

## 1. 换角度看：产品 / 架构 / 时序 / 可靠性 / 测试

### 1.1 产品视角（用户体感）

| 用户故事 | 改前 | 改后预期 |
|----------|------|----------|
| 长对话正文被「详情已延迟」挡住 | 常有 | **不应再有**行级/对话级摘要墙 |
| Grok 改文件只有 Diff 在动 | 幕布几乎无过程 | 幕布应出现 **读/写类** tool 卡（可滞后 ~200ms） |
| Grok/Kimi bash 刷屏 | 可能「原貌」很吵 | **与 Claude 一样藏 command/bashGroup** |
| 续聊第二轮闪旧 tool | 旧实现会 | **resume baseline=EOF 应不再重放** |
| 新会话第一批 tool 被吃掉 | 旧 baseline 竞态会 | **new session / saw_missing → 从 0 读** |

**仍不像 Claude 的地方**

- Grok 工具时序跟 **磁盘写 jsonl**，不是 CLI 事件时钟  
- fileChange **结构化 diff 字段**通常弱于 Codex  
- Status Panel 与幕布的分工要用户建立心智（bash 去 Status）

### 1.2 架构视角

```text
理想统一（目标）
  L1 各 CLI  → 统一 Tool* / Message* → 同一 Messages 核 → Claude 级策略（藏 bash）

当前实际
  Claude/Codex  ──原生协议──► Tool*
  Kimi/OpenCode ──原生 stream──► Tool*
  Grok          ──jsonl poll──► Tool*（旁路）
                    │
                    ▼
              同一 engine_event_to_app_server + FE adapter + Timeline
                    │
                    ▼
              shouldHideCodexCanvasCommandCard（五引擎藏 bash）
```

- **呈现核统一** ✅  
- **信号源不统一** ⚠️（Grok 旁路是正确工程取舍，不是完整对等）  
- **策略层向 Claude 收敛** ✅（bash 藏）

### 1.3 时序 / 竞态视角（重点）

| 场景 | 机制 | 状态 |
|------|------|------|
| Resume 续聊 | `for_turn(true)` → 首开 baseline=EOF | ✅ 已修 |
| 全新会话 | `for_turn(false)` 或 `saw_missing` → offset=0 | ✅ 已修 |
| 半行 JSON | carry 缓冲到下一 poll | ✅ |
| 文件截断 | offset 回 0 | ✅ |
| 首轮 path 未创建 | 等 exists 再 poll | ✅ |
| 新会话且**首字节写入前从未 missing 轮询** | 若第一次 poll 就已有文件且 resume=false → 从 0 读，OK；若误传 resume=true 会跳过 | 依赖 `resume_session` 正确 |
| poll 与 TurnCompleted 顺序 | stop 后 final poll 再结束 | ✅ 设计上有 final drain |
| broadcast lag | `let _ = send` 仍可能丢 | ⚠️ 原有问题 |

### 1.4 可靠性 / 性能

| 点 | 评价 |
|----|------|
| 增量 tail 避免整文件重读 | 好 |
| 200ms 轮询 | 可接受；长会话 CPU 低 |
| `find_workspace_session_dir` 首次仍可能扫目录 | 可缓存 path（已 cache） |
| 全量 `seen_*` set 随会话增长 | 单 turn 内 tool 数通常可控 |
| lightweight 死代码 | Prompt 已短路；i18n/状态 hooks 仍有残留 |

### 1.5 测试视角

| 有 | 缺 |
|----|-----|
| drain 幂等 | 端到端「幕布出现 read 卡」 |
| baseline + incremental 文件测 | 与 forwarder/FE 的集成测 |
| lightweight 单元 | bash 隐藏对 grok 的 focused Vitest |
| | 手测三引擎（矩阵清单） |

---

## 2. 目标完成度（对照任务清单）

| 项 | 完成度 | 证据 |
|----|--------|------|
| 砍对话/行级轻量墙 | **高** | mode 恒 inactive；Prompt return null |
| 块级显示详情保留 | **高** | 未改 heavy markdown/tool 块 |
| P0 resume 不重放 | **高** | `for_turn(true)` + baseline EOF |
| P1 增量 tail | **高** | seek + carry |
| P1 新会话不吞首批 tool | **高** | `for_turn(false)` / saw_missing |
| 对齐 Claude 藏 bash | **高** | 五引擎 hide command + bashGroup |
| 过程展示 ≈ Claude | **中** | 有卡；时序/字段仍弱 |
| settle 锚点行为改造 | **低** | 仅注释契约；流式结束仍 re-pin |
| commit | **无** | 用户约束 |

---

## 3. 与 Claude 幕布「像不像」再回答一次

**像的部分（产品策略）**

1. 同一套 Messages / Timeline / fileEdit 折叠  
2. bash/command **不污染幕布**  
3. 读/写类工具**意图上要可见**

**不像的部分（保真度）**

1. Claude：协议事件即时；Grok：文件 poll  
2. Claude 工具 payload 更结构化；Grok jsonl 常是 raw arguments 字符串  
3. Claude 过程与 Status 分工多年打磨；Grok 桥仍是「补可见性」

**产品一句话**  
> 目标不是像素级复刻 Claude，而是：**多 CLI 共用同一套「干净幕布」规则**——过程可读、shell 不吵、不造假。

---

## 4. 已知残留 / 后续

| 优先级 | 项 |
|--------|-----|
| 手测 | 矩阵三引擎读+写+搜+删任务 |
| 已补 | 特殊工具名表 / completed path 回填 / fileChange→Edit 块 / 非 mcp 名不进 Mcp 桶 |
| P2 | 删 lightweight i18n/handler 死状态 |
| P2 | capability matrix 并入正式 codegen |
| 观察 | Shared 目标=Grok；Task/Agent 长跑是否需专用卡 |

---

## 5. 建议你怎么看

1. 先扫本 Review §0–§3  
2. 再扫 `canvas-live-tool-projection-matrix-2026-08-01.md` 手测表  
3. 本地跑 Grok 写文档一轮：看幕布读/写卡、bash 是否安静、续聊是否无旧 tool 闪现  
4. 满意后再说 commit  

*Review 日期：2026-08-01；实现仍以工作树为准。*
