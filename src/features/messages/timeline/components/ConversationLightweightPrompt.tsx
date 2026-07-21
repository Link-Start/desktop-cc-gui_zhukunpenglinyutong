import { useTranslation } from "react-i18next";

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

export function ConversationLightweightPrompt({
  active,
  heavyRowCount,
  onEnable,
  onHydrateVisible,
  oversized,
  renderWeight,
  rowCount,
  visible,
}: ConversationLightweightPromptProps) {
  const { t } = useTranslation();

  if (!visible) {
    return null;
  }

  const titleKey = oversized
    ? "messages.conversationOversizedHistoryTitle"
    : active
      ? "messages.conversationLightweightModeTitle"
      : "messages.conversationLightweightSuggestionTitle";
  const descriptionKey = oversized
    ? "messages.conversationOversizedHistoryDescription"
    : active
      ? "messages.conversationLightweightModeDescription"
      : "messages.conversationLightweightSuggestionDescription";

  return (
    <div
      className="messages-lightweight-mode-banner"
      data-conversation-lightweight-mode={active ? "active" : "suggested"}
      role="status"
    >
      <div className="messages-lightweight-mode-banner-copy">
        <span className="messages-lightweight-mode-banner-eyebrow">
          {t("messages.conversationLightweightModeEyebrow")}
        </span>
        <strong>{t(titleKey)}</strong>
        <span>
          {t(descriptionKey, {
            heavyRows: heavyRowCount,
            renderWeight,
            rows: rowCount,
          })}
        </span>
      </div>
      <div className="messages-lightweight-mode-banner-actions">
        {!active ? (
          <button type="button" onClick={onEnable}>
            {t("messages.conversationLightweightUse")}
          </button>
        ) : null}
        <button type="button" onClick={onHydrateVisible}>
          {t("messages.conversationLightweightHydrateVisible")}
        </button>
      </div>
    </div>
  );
}
