import { useTranslation } from "react-i18next";
import { FIRST_RUN_IDE_META } from "@/features/onboarding/constants";
import { useEditorHabit } from "@/features/onboarding/hooks/useEditorHabit";
import type { FirstRunIdeId } from "@/features/onboarding/types";
import { EDITOR_HABIT_CHOICES } from "@/features/onboarding/utils/editorHabit";

export function EditorHabitPreference() {
  const { t } = useTranslation();
  const { preferredIde, setEditorHabit } = useEditorHabit();

  return (
    <div className="settings-pref-row">
      <div className="settings-pref-meta">
        <div className="settings-pref-title">{t("settings.editorHabitTitle")}</div>
        <div className="settings-pref-desc">{t("settings.editorHabitDesc")}</div>
      </div>
      <div className="settings-pref-control">
        <div className="settings-pref-select-wrap settings-pref-select-wrap--grow">
          <select
            className="settings-pref-select"
            aria-label={t("settings.editorHabitTitle")}
            data-testid="settings-editor-habit"
            value={preferredIde ?? ""}
            onChange={(event) => {
              const next = event.target.value as FirstRunIdeId;
              if (!next) {
                return;
              }
              void setEditorHabit(next);
            }}
          >
            {preferredIde === null ? (
              <option value="" disabled>
                {t("settings.editorHabitUnset")}
              </option>
            ) : null}
            {EDITOR_HABIT_CHOICES.map((ide) => (
              <option key={ide} value={ide}>
                {t(FIRST_RUN_IDE_META[ide].titleKey)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
