import { memo, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SubagentInfo } from "../types";
import {
  buildSubagentCardFromSubagentInfo,
  enrichSubagentCardStatuses,
  openSubagentInspector,
  SubagentPersonaCard,
} from "../../subagent-ui";
import {
  mergeSubagentEnrichmentSources,
  useSubagentSessionProbeVersion,
} from "../../subagent-ui/hooks/useSubagentSessionProbeStore";
import { syncSubagentInspectorFromCards } from "../../subagent-ui/hooks/useSubagentInspectorStore";
import { useActiveCanvasSelector } from "../../layout/hooks/activeCanvasStore";

interface SubagentListProps {
  subagents: SubagentInfo[];
  /** 打开幕布 inspector 后的副作用（如关闭 popover） */
  onInspectSubagent?: (agent: SubagentInfo) => void;
}

/**
 * 右下角子代理：单行列表（无定位 icon、无选中底）。
 * 点击 → 打开幕布内 SubAgent inspector 抽屉。
 */
export const SubagentList = memo(function SubagentList({
  subagents,
  onInspectSubagent,
}: SubagentListProps) {
  const { t } = useTranslation();
  const probeVersion = useSubagentSessionProbeVersion();
  const parentThreadId = useActiveCanvasSelector((snapshot) => snapshot.threadId);
  const threadStatusById = useActiveCanvasSelector(
    (snapshot) => snapshot.threadStatusById,
  );
  const threadItemsByThread = useActiveCanvasSelector(
    (snapshot) => snapshot.threadItemsByThread,
  );

  const cards = useMemo(() => {
    const raw = subagents.map((agent, index) =>
      buildSubagentCardFromSubagentInfo(agent, {
        index,
        parentThreadId,
      }),
    );
    const enrichment = mergeSubagentEnrichmentSources({
      statusById: threadStatusById,
      itemsByThread: threadItemsByThread,
    });
    const enriched = enrichSubagentCardStatuses(raw, enrichment);
    return subagents.map((agent, index) => ({
      agent,
      card: enriched[index] ?? raw[index]!,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- probeVersion 订阅旁路 load
  }, [
    parentThreadId,
    probeVersion,
    subagents,
    threadItemsByThread,
    threadStatusById,
  ]);

  useEffect(() => {
    syncSubagentInspectorFromCards(cards.map((entry) => entry.card));
  }, [cards]);

  if (subagents.length === 0) {
    return <div className="sp-empty">{t("statusPanel.emptySubagents")}</div>;
  }

  return (
    <div className="sp-subagent-list-rows" aria-label={t("statusPanel.tabSubagents")}>
      {cards.map(({ agent, card }) => (
        <div key={agent.id} className="sp-subagent-list-row">
          <SubagentPersonaCard
            card={card}
            layout="row"
            selected={false}
            onSelect={(next) => {
              openSubagentInspector(next);
              onInspectSubagent?.(agent);
            }}
          />
        </div>
      ))}
    </div>
  );
});
