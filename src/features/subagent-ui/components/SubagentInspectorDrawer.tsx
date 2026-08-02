import { memo, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import X from "lucide-react/dist/esm/icons/x";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  closeSubagentInspector,
  useSubagentInspectorSelection,
} from "../hooks/useSubagentInspectorStore";
import { PersonaAvatar } from "./PersonaAvatar";
import { SubagentProgressBar } from "./SubagentProgressBar";
import { SubagentSessionCanvas } from "./SubagentSessionCanvas";

type SubagentInspectorDrawerProps = {
  className?: string;
  workspaceId?: string | null;
  workspacePath?: string | null;
};

/**
 * 右侧子代理详情：persona 头 + 子会话幕布（与侧栏打开子代理 session 同源 Messages 渲染）。
 */
export const SubagentInspectorDrawer = memo(function SubagentInspectorDrawer({
  className,
  workspaceId = null,
  workspacePath = null,
}: SubagentInspectorDrawerProps) {
  const { t } = useTranslation();
  const card = useSubagentInspectorSelection();

  useEffect(() => {
    if (!card) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSubagentInspector();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [card]);

  const sessionThreadId = useMemo(() => {
    if (!card) {
      return null;
    }
    return card.sessionThreadId?.trim() || card.taskOutput?.threadId?.trim() || null;
  }, [card]);

  if (!card) {
    return null;
  }

  return (
    <aside
      className={cn("subagent-inspector-drawer", className)}
      aria-label={t("subagentUi.inspectorAria", { defaultValue: "子代理详情" })}
    >
      <header className="subagent-inspector-header">
        <div className="subagent-inspector-identity">
          <PersonaAvatar
            displayName={card.displayName}
            avatarSrc={card.avatarSrc}
            githubProfileUrl={card.githubProfileUrl}
            size={36}
          />
          <div className="min-w-0">
            <div className="subagent-inspector-name-row">
              <strong className="subagent-inspector-name">{card.displayName}</strong>
              <span className="subagent-persona-index">{card.indexLabel}</span>
            </div>
            <div className="subagent-inspector-type" title={card.description}>
              {card.typeLabel}
              {card.description ? ` · ${card.description}` : ""}
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="subagent-inspector-close"
          onClick={() => closeSubagentInspector()}
          aria-label={t("subagentUi.close", { defaultValue: "关闭" })}
        >
          <X size={16} aria-hidden />
        </Button>
      </header>

      <div className="subagent-inspector-meta-bar">
        <SubagentProgressBar progress={card.progress} status={card.status} />
      </div>

      <div className="subagent-inspector-body is-session-canvas">
        {sessionThreadId ? (
          <SubagentSessionCanvas
            sessionThreadId={sessionThreadId}
            workspaceId={workspaceId}
            workspacePath={workspacePath}
          />
        ) : card.outputText || card.description ? (
          <div className="subagent-session-canvas-fallback">
            <div className="subagent-inspector-label">
              {t("subagentUi.fields.output", { defaultValue: "交付报告" })}
            </div>
            <pre className="subagent-session-canvas-fallback-body">
              {card.outputText?.trim() || card.description}
            </pre>
          </div>
        ) : (
          <div className="subagent-session-canvas-status">
            {t("subagentUi.noSessionYet", {
              defaultValue:
                "尚未关联到子代理会话（agentId 未解析或 transcript 仍在索引中）。可从左侧会话树打开「子代理」行查看。",
            })}
          </div>
        )}
      </div>
    </aside>
  );
});
