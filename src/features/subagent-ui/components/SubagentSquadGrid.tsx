import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ConversationItem } from "../../../types";
import { useActiveCanvasSelector } from "../../layout/hooks/activeCanvasStore";
import { buildSubagentCardsFromToolItems } from "../utils/subagentViewModel";
import { enrichSubagentCardStatuses } from "../utils/subagentCardStatus";
import { useSubagentInspectorSelection } from "../hooks/useSubagentInspectorStore";
import { SubagentPersonaCard } from "./SubagentPersonaCard";

type ToolItem = Extract<ConversationItem, { kind: "tool" }>;

type SubagentSquadGridProps = {
  items: ToolItem[];
  className?: string;
};

export const SubagentSquadGrid = memo(function SubagentSquadGrid({
  items,
  className,
}: SubagentSquadGridProps) {
  const { t } = useTranslation();
  const selected = useSubagentInspectorSelection();
  const parentThreadId = useActiveCanvasSelector((snapshot) => snapshot.threadId);
  const nativeThreadIds = useActiveCanvasSelector(
    (snapshot) => snapshot.activeNativeThreadIds,
  );
  const childSubagentThreads = useActiveCanvasSelector(
    (snapshot) => snapshot.childSubagentThreads,
  );
  const threadStatusById = useActiveCanvasSelector(
    (snapshot) => snapshot.threadStatusById,
  );
  const threadItemsByThread = useActiveCanvasSelector(
    (snapshot) => snapshot.threadItemsByThread,
  );
  const cards = useMemo(() => {
    const raw = buildSubagentCardsFromToolItems(items, {
      parentThreadId,
      nativeThreadIds,
      childThreads: childSubagentThreads.map((thread) => ({
        id: thread.id,
        name: thread.name,
      })),
    });
    return enrichSubagentCardStatuses(raw, {
      statusById: threadStatusById,
      itemsByThread: threadItemsByThread,
    });
  }, [
    childSubagentThreads,
    items,
    nativeThreadIds,
    parentThreadId,
    threadItemsByThread,
    threadStatusById,
  ]);
  const completedCount = cards.filter((card) => card.status === "completed").length;
  const titleHint =
    cards.find((card) => card.description)?.description ??
    t("subagentUi.squadFallbackTitle", { defaultValue: "并行子代理" });

  if (cards.length === 0) {
    return null;
  }

  if (cards.length === 1) {
    const only = cards[0];
    if (!only) {
      return null;
    }
    return (
      <div className={className ?? "subagent-squad-single"}>
        <SubagentPersonaCard
          card={only}
          compact
          selected={selected?.id === only.id}
        />
      </div>
    );
  }

  return (
    <section
      className={className ?? "subagent-squad"}
      aria-label={t("subagentUi.squadAria", { defaultValue: "子代理小队" })}
    >
      <header className="subagent-squad-header">
        <span className="subagent-squad-title">
          {t("subagentUi.squadTitle", {
            total: cards.length,
            completed: completedCount,
            defaultValue: "{{completed}}/{{total}} 个助手",
          })}
        </span>
        <span className="subagent-squad-badge" aria-hidden>
          {t("subagentUi.badge", { defaultValue: "SubAgent" })}
        </span>
        <span className="subagent-squad-subtitle" title={titleHint}>
          {titleHint}
        </span>
      </header>
      <div className="subagent-squad-grid">
        {cards.map((card) => (
          <SubagentPersonaCard
            key={card.id}
            card={card}
            compact
            selected={selected?.id === card.id}
          />
        ))}
      </div>
    </section>
  );
});
