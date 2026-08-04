import { memo, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ConversationItem } from "../../../types";
import { useActiveCanvasSelector } from "../../layout/hooks/activeCanvasStore";
import { buildSubagentCardsFromToolItems } from "../utils/subagentViewModel";
import { enrichSubagentCardStatuses } from "../utils/subagentCardStatus";
import {
  syncSubagentInspectorFromCards,
  useSubagentInspectorSelection,
} from "../hooks/useSubagentInspectorStore";
import {
  mergeSubagentEnrichmentSources,
  useSubagentSessionProbeVersion,
} from "../hooks/useSubagentSessionProbeStore";
import { SubagentRingCard } from "./SubagentRingCard";

type ToolItem = Extract<ConversationItem, { kind: "tool" }>;

type SubagentSquadGridProps = {
  items: ToolItem[];
  className?: string;
};

type StatusCounts = {
  completed: number;
  running: number;
  error: number;
};

function countCardStatuses(
  cards: readonly { status: "running" | "completed" | "error" }[],
): StatusCounts {
  let completed = 0;
  let running = 0;
  let error = 0;
  for (const card of cards) {
    if (card.status === "completed") {
      completed += 1;
    } else if (card.status === "error") {
      error += 1;
    } else {
      running += 1;
    }
  }
  return { completed, running, error };
}

/** 只拼非 0 段，避免「4 完成 · 0 运行 · 0 失败」噪音 */
export function formatSquadStatusSummary(
  counts: StatusCounts,
  labels: { completed: string; running: string; error: string },
): string {
  const parts: string[] = [];
  if (counts.completed > 0) {
    parts.push(`${counts.completed} ${labels.completed}`);
  }
  if (counts.running > 0) {
    parts.push(`${counts.running} ${labels.running}`);
  }
  if (counts.error > 0) {
    parts.push(`${counts.error} ${labels.error}`);
  }
  return parts.join(" · ");
}

export const SubagentSquadGrid = memo(function SubagentSquadGrid({
  items,
  className,
}: SubagentSquadGridProps) {
  const { t } = useTranslation();
  const selected = useSubagentInspectorSelection();
  const probeVersion = useSubagentSessionProbeVersion();
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
    const enrichment = mergeSubagentEnrichmentSources({
      statusById: threadStatusById,
      itemsByThread: threadItemsByThread,
    });
    return enrichSubagentCardStatuses(raw, enrichment);
    // probeVersion：抽屉旁路 load 写入 probe 后强制 re-enrich
    // eslint-disable-next-line react-hooks/exhaustive-deps -- probeVersion 是订阅触发器
  }, [
    childSubagentThreads,
    items,
    nativeThreadIds,
    parentThreadId,
    probeVersion,
    threadItemsByThread,
    threadStatusById,
  ]);

  // 列表 re-enrich 后同步抽屉 header status（打破打开瞬间的 snapshot 冻结）
  useEffect(() => {
    syncSubagentInspectorFromCards(cards);
  }, [cards]);

  const statusCounts = useMemo(() => countCardStatuses(cards), [cards]);

  const statusSummary = useMemo(
    () =>
      formatSquadStatusSummary(statusCounts, {
        completed: t("subagentUi.statusShort.completed", { defaultValue: "完成" }),
        running: t("subagentUi.statusShort.running", { defaultValue: "运行" }),
        error: t("subagentUi.statusShort.error", { defaultValue: "失败" }),
      }),
    [statusCounts, t],
  );

  if (cards.length === 0) {
    return null;
  }

  return (
    <section
      className={cn("subagent-squad", className)}
      aria-label={t("subagentUi.squadAria", { defaultValue: "子代理小队" })}
    >
      <header className="subagent-squad-header is-segment">
        <span className="subagent-squad-title">
          {t("subagentUi.squadTitleCount", {
            total: cards.length,
            defaultValue: "{{total}} 个助手",
          })}
        </span>
        {statusSummary ? (
          <span className="subagent-squad-summary" title={statusSummary}>
            {statusSummary}
          </span>
        ) : null}
      </header>

      <div className="subagent-segment-track" aria-hidden>
        {cards.map((card) => (
          <span
            key={card.id}
            className={`subagent-segment is-${card.status}`}
          />
        ))}
      </div>

      <div className="subagent-ring-grid">
        {cards.map((card) => (
          <SubagentRingCard
            key={card.id}
            card={card}
            selected={selected?.id === card.id}
          />
        ))}
      </div>
    </section>
  );
});
