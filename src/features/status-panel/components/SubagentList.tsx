import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SubagentInfo } from "../types";
import {
  buildSubagentCardFromSubagentInfo,
  openSubagentInspector,
  SubagentPersonaCard,
} from "../../subagent-ui";
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
  const parentThreadId = useActiveCanvasSelector((snapshot) => snapshot.threadId);

  const cards = useMemo(
    () =>
      subagents.map((agent, index) => ({
        agent,
        card: buildSubagentCardFromSubagentInfo(agent, {
          index,
          parentThreadId,
        }),
      })),
    [parentThreadId, subagents],
  );

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
