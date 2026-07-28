## 1. Regression And Root Cause

- [x] 1.1 [P0, depends: none] 输入当前 controlled Shared submenu；输出连续 Provider interaction 的回归测试与 stall/focus root-cause evidence。

## 2. Minimal Fix

- [x] 2.1 [P0, depends: 1.1] 输入 `ModelSelect` Shared nested path；输出删除 controlled/pinned submenu state，并只忽略焦点回弹到父 root content 的误关闭。
- [x] 2.2 [P0, depends: 2.1] 输入 keyboard、Escape、Model selection 与 Native path；输出无行为回退的 focused tests。

## 3. Closure

- [x] 3.1 [P0, depends: 2.2] 输入实现 diff；输出 focused Vitest、typecheck、lint、runtime contracts、diff check 与 strict OpenSpec validation。
- [x] 3.2 [P1, depends: 3.1] 输入验证 evidence；输出 verification、main spec sync 与 OpenSpec/Trellis archive。
