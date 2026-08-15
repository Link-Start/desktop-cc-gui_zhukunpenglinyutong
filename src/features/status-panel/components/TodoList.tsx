import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import ListChecks from "lucide-react/dist/esm/icons/list-checks";
import type { TodoItem } from "../types";
import { formatTodoProgressLabel } from "../utils/todoProgress";

interface TodoListProps {
  todos: TodoItem[];
  /** Composer 展开层展示「任务」标题；StatusPanel tab 已自带标题时关闭。 */
  showTitle?: boolean;
}

function CompletedGlyph() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="sp-todo-glyph-completed"
    >
      <circle cx="7" cy="7" r="6.4" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M10.9631 5.71411L7.70154 8.97571C7.48011 9.19714 7.27736 9.40099 7.09229 9.54993C6.89742 9.70669 6.66314 9.85279 6.3634 9.90027C6.2049 9.92534 6.04339 9.92534 5.88489 9.90027C5.58515 9.85279 5.35087 9.70669 5.15601 9.54993C4.97093 9.40099 4.76818 9.19714 4.54675 8.97571L3.03516 7.46411L3.96313 6.53613L5.47473 8.04773C5.7169 8.28989 5.86196 8.43389 5.97888 8.52795C6.08597 8.61409 6.10875 8.60701 6.08997 8.604C6.11259 8.60758 6.13571 8.60758 6.15833 8.604C6.13954 8.60701 6.16232 8.61409 6.26941 8.52795C6.38633 8.43389 6.53139 8.28989 6.77356 8.04773L10.0352 4.78613L10.9631 5.71411Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ProgressGlyph() {
  const gradientId = useId();
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="sp-todo-glyph-progress"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="2.5"
          y1="12"
          x2="10.5"
          y2="3.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle
        cx="7"
        cy="7"
        r="6.4"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.2"
      />
    </svg>
  );
}

function PendingGlyph() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="sp-todo-glyph-pending"
    >
      <circle
        cx="7"
        cy="7"
        r="6.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2.4 2.4"
      />
    </svg>
  );
}

function StatusGlyph({ status }: { status: TodoItem["status"] }) {
  if (status === "completed") return <CompletedGlyph />;
  if (status === "in_progress") return <ProgressGlyph />;
  return <PendingGlyph />;
}

export const TodoList = memo(function TodoList({
  todos,
  showTitle = false,
}: TodoListProps) {
  const { t } = useTranslation();
  if (todos.length === 0) {
    return <div className="sp-empty">{t("statusPanel.emptyTodos")}</div>;
  }

  const progress = formatTodoProgressLabel(todos, (key, opts) => t(key, opts));

  return (
    <div className="sp-todo-list" data-testid="todo-list">
      <div className="sp-todo-header">
        <span className="sp-todo-header-icon" aria-hidden>
          <ListChecks size={14} strokeWidth={2} />
        </span>
        {showTitle ? (
          <span className="sp-todo-header-title">{t("statusPanel.tabTodos")}</span>
        ) : null}
        <span className="sp-todo-header-progress" title={progress}>
          {progress}
        </span>
      </div>
      <ul className="sp-todo-items" aria-label={t("statusPanel.tabTodos")}>
        {todos.map((todo, index) => (
          <li
            key={`${todo.content}-${index}`}
            className={`sp-todo-item sp-todo-${todo.status}`}
            data-status={todo.status}
          >
            <span className="sp-todo-icon" aria-hidden>
              <StatusGlyph status={todo.status} />
            </span>
            <span className="sp-todo-text">{todo.content}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
