## 1. Claude turn identity mapping

- [x] 1.1 修改 `engine/events.rs`：`RequestUserInput` 的 `params.turnId` 使用 `turn_id_context`（缺失时回退 `item_id`）
- [x] 1.2 更新 `request_user_input_anchors_item_id_to_its_own_request_not_assistant_head` 断言：itemId 仍独立，turnId 对齐 turn context

## 2. Shared projection control override

- [x] 2.1 修改 `project_app_server_event_to_shared_owner`：对 `item/tool/requestUserInput` 强制覆盖 `turnId`/`turn_id` 为 `owner.runtime_turn_id`
- [x] 2.2 增加 Rust unit：assistant-item turnId 入站经 projection 后与 sharedOwner.runtimeTurnId 一致

## 3. Frontend regression

- [x] 3.1 确认/补充 Vitest：对齐后的 Shared `requestUserInput` 能解析 control owner；错位/缺字段仍 fail-closed
- [x] 3.2 运行相关 cargo test + vitest 聚焦用例

## 4. Review & handoff

- [x] 4.1 独立角度 code review（身份契约 / fail-closed / 回归面）
- [x] 4.2 输出用户手测提示词
