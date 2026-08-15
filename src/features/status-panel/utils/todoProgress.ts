import type { TodoItem } from "../types";

export interface TodoProgressCounts {
  done: number;
  active: number;
  pending: number;
}

export function countTodoByStatus(
  todos: readonly TodoItem[],
): TodoProgressCounts {
  let done = 0;
  let active = 0;
  let pending = 0;
  for (const todo of todos) {
    if (todo.status === "completed") {
      done += 1;
    } else if (todo.status === "in_progress") {
      active += 1;
    } else {
      pending += 1;
    }
  }
  return { done, active, pending };
}

/** En space around the middle-dot so HTML will not collapse the separator. */
const PROGRESS_SEPARATOR = "\u2002·\u2002";

export function formatTodoProgressLabel(
  todos: readonly TodoItem[],
  t: (key: string, opts: Record<string, number>) => string,
): string {
  const { done, active, pending } = countTodoByStatus(todos);
  return [
    ...(done > 0 ? [t("statusPanel.todoProgressDone", { done })] : []),
    ...(active > 0 ? [t("statusPanel.todoProgressActive", { active })] : []),
    ...(pending > 0 ? [t("statusPanel.todoProgressPending", { pending })] : []),
  ].join(PROGRESS_SEPARATOR);
}
