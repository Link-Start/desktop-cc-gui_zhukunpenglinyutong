export const MESSAGE_JUMP_EVENT_NAME = "ccgui:jump-to-message";
export const ASSISTANT_FINALIZING_LIVE_WINDOW_MS = 320;
export const CODEX_FINALIZING_LIVE_WINDOW_MS = 6_000;
// 对话结束后 live 尾窗回刷成全量 timeline 的收尾窗口：期间监听渲染源落地，把 armed
// 视口钉回底部，覆盖 useDeferredValue 延后 + 虚拟化行测量导致的 scrollHeight 暴增。
export const SETTLE_REPIN_WINDOW_MS = 2_400;
// 打开会话后的跟随窗口：虚拟化行测量 / content-visibility 真实布局要若干帧才收敛，
// 窗口内内容长高就把视口按回底部；超时停手，避免长对话里无限追赶。
export const INITIAL_BOTTOM_PIN_BUDGET_MS = 2_400;
export const VISIBLE_TEXT_REPORT_MIN_INTERVAL_MS = 120;
export const VISIBLE_TEXT_REPORT_MIN_GROWTH_CHARS = 160;
export const VISIBLE_TEXT_REPORT_EAGER_PREFIX_CHARS = 512;
