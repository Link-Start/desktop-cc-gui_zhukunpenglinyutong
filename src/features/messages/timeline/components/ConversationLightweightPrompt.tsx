type ConversationLightweightPromptProps = {
  active: boolean;
  heavyRowCount: number;
  onEnable: () => void;
  onHydrateVisible: () => void;
  oversized: boolean;
  renderWeight: number;
  rowCount: number;
  visible: boolean;
};

/**
 * Conversation-level lightweight banner — permanently disabled
 * (unify-conversation-canvas). Call sites may still pass props; block-level
 * 「显示详情」 for heavy markdown/tools is unchanged elsewhere.
 */
export function ConversationLightweightPrompt(
  _props: ConversationLightweightPromptProps,
) {
  void _props;
  return null;
}
