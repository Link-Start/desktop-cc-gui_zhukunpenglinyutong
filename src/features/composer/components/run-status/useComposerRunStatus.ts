import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TurnPlan } from "../../../../types";
import type { SubagentInfo, TodoItem } from "../../../status-panel/types";
import type { TurnFileChangesSummary } from "../../../messages/utils/turnFileChanges";
import { resolvePlanStepStatusForDisplay } from "../../../threads/utils/threadNormalize";
import type { RunStatusSection } from "./types";

export type ComposerRunStatusInput = {
  todos: TodoItem[];
  subagents: SubagentInfo[];
  plan: TurnPlan | null;
  isPlanMode: boolean;
  isProcessing: boolean;
  /** Codex + collaboration：plan 步骤并入任务 pill，不单独显示 Plan */
  mergePlanIntoTodos: boolean;
  /** 全会话文件变更汇总（与消息层 turnFileChanges 同口径） */
  sessionFileChanges: TurnFileChangesSummary | null;
};

export function useComposerRunStatus(input: ComposerRunStatusInput) {
  const {
    todos,
    subagents,
    plan,
    isPlanMode,
    isProcessing,
    mergePlanIntoTodos,
    sessionFileChanges,
  } = input;

  const displayTodos = useMemo(() => {
    if (mergePlanIntoTodos && plan && plan.steps.length > 0) {
      return plan.steps.map((step) => {
        const statusForDisplay = resolvePlanStepStatusForDisplay(
          step.status,
          isProcessing,
        );
        return {
          content: step.step,
          status:
            statusForDisplay === "completed"
              ? ("completed" as const)
              : statusForDisplay === "inProgress"
                ? ("in_progress" as const)
                : ("pending" as const),
        };
      });
    }
    return todos;
  }, [isProcessing, mergePlanIntoTodos, plan, todos]);

  const todoCompleted = displayTodos.filter((t) => t.status === "completed").length;
  const todoTotal = displayTodos.length;
  const todoRunning = displayTodos.some((t) => t.status === "in_progress");

  const subagentCompleted = subagents.filter((s) => s.status === "completed").length;
  const subagentTotal = subagents.length;
  const subagentRunning = subagents.some((s) => s.status === "running");
  const runningSubagentLabel =
    subagents.find((s) => s.status === "running")?.description?.trim() || null;

  const planSteps = plan?.steps ?? [];
  const planCompleted = planSteps.filter((s) => s.status === "completed").length;
  const planTotal = planSteps.length;
  const showPlanSection =
    !mergePlanIntoTodos && (isPlanMode || planTotal > 0);

  const editFileCount = sessionFileChanges?.files.length ?? 0;
  const totalAdditions = sessionFileChanges?.totalAdditions ?? 0;
  const totalDeletions = sessionFileChanges?.totalDeletions ?? 0;
  const showEditSection = editFileCount > 0;

  const showTodoSection = todoTotal > 0;
  const showSubagentSection = subagentTotal > 0;

  const visible =
    showTodoSection || showSubagentSection || showPlanSection || showEditSection;

  const [expandedSection, setExpandedSection] = useState<RunStatusSection | null>(
    null,
  );
  const userCollapsedRef = useRef(false);
  const autoExpandedSubagentRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setExpandedSection(null);
      userCollapsedRef.current = false;
      autoExpandedSubagentRef.current = false;
      return;
    }
    setExpandedSection((current) => {
      if (current === "todo" && !showTodoSection) return null;
      if (current === "subagent" && !showSubagentSection) return null;
      if (current === "plan" && !showPlanSection) return null;
      if (current === "edit" && !showEditSection) return null;
      return current;
    });
  }, [
    showEditSection,
    showPlanSection,
    showSubagentSection,
    showTodoSection,
    visible,
  ]);

  useEffect(() => {
    if (!subagentRunning || !showSubagentSection) return;
    if (userCollapsedRef.current || autoExpandedSubagentRef.current) return;
    autoExpandedSubagentRef.current = true;
    setExpandedSection("subagent");
  }, [showSubagentSection, subagentRunning]);

  const toggleSection = useCallback((section: RunStatusSection) => {
    setExpandedSection((current) => {
      if (current === section) {
        userCollapsedRef.current = true;
        return null;
      }
      userCollapsedRef.current = false;
      return section;
    });
  }, []);

  const collapse = useCallback(() => {
    userCollapsedRef.current = true;
    setExpandedSection(null);
  }, []);

  return {
    visible,
    expandedSection,
    toggleSection,
    collapse,
    displayTodos,
    todoCompleted,
    todoTotal,
    todoRunning,
    subagents,
    subagentCompleted,
    subagentTotal,
    subagentRunning,
    runningSubagentLabel,
    showTodoSection,
    showSubagentSection,
    showPlanSection,
    showEditSection,
    plan,
    planCompleted,
    planTotal,
    sessionFileChanges,
    editFileCount,
    totalAdditions,
    totalDeletions,
  };
}

export type ComposerRunStatusModel = ReturnType<typeof useComposerRunStatus>;
