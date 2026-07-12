## 1. Trigger Stability

- [x] 1.1 [P0][depends:none][I: TooltipIconButton props/events][O: standard Radix `asChild` native button composition][V: focused Tooltip tests] Replace compatibility render path.
- [x] 1.2 [P0][depends:1.1][I: real SidebarCollapseButton in StrictMode/layout host transitions][O: startup loop regression coverage][V: no maximum-depth console error] Add real-caller regression test.

## 2. Verification

- [x] 2.1 [P0][depends:1.2][I: implementation][O: Tooltip/AppShell focused test evidence, typecheck and lint][V: commands exit 0] Run frontend gates.
- [x] 2.2 [P0][depends:2.1][I: artifacts and code][O: strict OpenSpec validation and verification report][V: verify workflow] Close evidence.

## 3. Root Cause Correction

- [x] 3.1 [P0][depends:2.2][I: real WebView still reproduces through `SlotClone`][O: direct Radix button trigger with no `render/asChild` compatibility path][V: source contract and focused Tooltip tests] Remove Slot composition from TooltipIconButton.
- [x] 3.2 [P0][depends:3.1][I: corrected implementation and artifacts][O: refreshed tests, quality gates and strict validation][V: all commands exit 0] Re-verify after root-cause correction.

## 4. Radix Popper Exit

- [x] 4.1 [P0][depends:3.2][I: real WebView still reproduces through internal `PopperAnchor / SlotClone`][O: native button + Floating UI styled portal with preserved public props][V: Tooltip visual/placement/interaction tests] Replace icon Tooltip positioning runtime.
- [x] 4.2 [P0][depends:4.1][I: legacy production `App-CwNlTwcP.js` React #185 evidence][O: establish old-bundle provenance and validate new runtime through Tauri cold-start][V: user confirms new Tauri window starts without ErrorBoundary and Tooltip remains acceptable] Verify runtime closure.
