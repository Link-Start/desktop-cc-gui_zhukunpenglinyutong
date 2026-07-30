## 1. Anchor preview model

- [x] 1.1 [P0, no dependency] 输入：现有 user message text；输出：bounded title/description anchor model；验证：空行、单行、长文本均 deterministic 且不读取 assistant rows
- [x] 1.2 [P0, depends on 1.1] 输入：完整 anchors 与 active id；输出：最多 32 个按原始 index 定位的 representative anchors 且保留 active；验证：focused component test 覆盖 40+ anchors

## 2. Rail interaction and styling

- [x] 2.1 [P0, depends on 1.1-1.2] 输入：visible anchors；输出：左侧全高 button dash rail、active emphasis、hover/focus 单 preview、click/keyboard jump；验证：focused Vitest 断言 DOM 中最多一个 preview 且目标 id 正确
- [x] 2.2 [P0, depends on 2.1] 输入：首部/中部/尾部 anchor position；输出：down/center/up placement class 与 bounded card CSS；验证：style contract test 覆盖 left/top/bottom/max-width/line-clamp/reduced-motion

## 3. Verification

- [x] 3.1 [P1, depends on 2.1-2.2] 运行 focused Messages tests、lint、typecheck、large-file check；输出：全部命令通过或记录既有 blocker
- [x] 3.2 [P1, depends on 3.1] 运行 `openspec validate refine-message-anchor-rail-preview --type change --strict --no-interactive` 并审查 scoped diff；输出：artifact validation 通过且未覆盖工作区既有 scroll 修改

## 4. Compact rail calibration

- [x] 4.1 [P0, depends on 2.1-2.2] 输入：参考图的紧凑 rail；输出：顶部 bounded-gap 排列、active 等长加深、仅 hover/focus 拉长；验证：component/style contract tests 锁定无 inline percentage position 与 hover-only width
- [x] 4.2 [P1, depends on 4.1] 运行 focused Messages tests、lint、typecheck、large-file check 与 strict OpenSpec validation；输出：全部 gate 通过或记录既有 blocker

## 5. Reference-scale visual calibration

- [x] 5.1 [P0, depends on 4.1] 输入：用户确认的图1视觉比例；输出：`6px × 2px` normal dash、`26px` hover/focus、`8px + 2px gap` row pitch 与紧凑 preview card；验证：style contract test 锁定关键尺寸
- [x] 5.2 [P1, depends on 5.1] 运行 focused Messages tests、targeted/full lint、typecheck、large-file check、strict OpenSpec validation 与 scoped diff audit

## 6. Local protrusion calibration

- [x] 6.1 [P0, depends on 5.1] 输入：当前 preview anchor visible index；输出：distance `0/1/2/3` 对应 `26px/20px/12px/8px` 的对称 proximity classes；验证：focused component/style tests 覆盖中心、双侧邻居与 mouse leave reset
- [x] 6.2 [P1, depends on 6.1] 按用户要求仅运行 focused Messages tests、targeted ESLint、typecheck、large-file check、strict OpenSpec validation 与 scoped diff audit；不运行全量 test suite
