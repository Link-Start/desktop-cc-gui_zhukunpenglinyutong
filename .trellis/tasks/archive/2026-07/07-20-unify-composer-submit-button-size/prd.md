# 统一 Composer 发送按钮尺寸

## Goal

修复 Home 与 Conversation 两处发送按钮尺寸不一致的问题，并按产品确认将统一后的按钮整体缩至 `26px × 26px`。

## OpenSpec

- Change: `unify-composer-submit-button-size`

## Requirements

- 只修改 send/stop action 的 UI geometry。
- Home narrow responsive layout 不再将 action 放大到 `36px`。
- shared ArrowUp icon 使用 `14px`、stop icon 使用 `10px`、radius 使用 `8px`。
- 不修改颜色、icon glyph/asset、状态、事件或其他 Composer controls。

## Acceptance Criteria

- [x] Home 与 Conversation send/stop action 均为 `26px × 26px`。
- [x] focused style test 通过。
- [x] typecheck、large-file gate 与 OpenSpec strict validation 通过。

## Technical Notes

根因位于 `src/styles/home-chat.css` 的 `max-width: 640px` scoped override；复用现有 shared `.submit-button` contract，不新增 component variant。
