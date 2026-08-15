import { describe, expect, it } from "vitest";
import {
  countTodoByStatus,
  formatTodoProgressLabel,
} from "./todoProgress";
import type { TodoItem } from "../types";

const t = (key: string, opts: Record<string, number>) => {
  if (key === "statusPanel.todoProgressDone") return `${opts.done} completed`;
  if (key === "statusPanel.todoProgressActive") return `${opts.active} in progress`;
  if (key === "statusPanel.todoProgressPending") return `${opts.pending} pending`;
  return key;
};

describe("countTodoByStatus", () => {
  it("splits completed / in_progress / pending", () => {
    const todos: TodoItem[] = [
      { content: "a", status: "completed" },
      { content: "b", status: "in_progress" },
      { content: "c", status: "pending" },
      { content: "d", status: "pending" },
    ];
    expect(countTodoByStatus(todos)).toEqual({
      done: 1,
      active: 1,
      pending: 2,
    });
  });

  it("treats unknown status as pending", () => {
    const todos = [
      { content: "x", status: "blocked" },
    ] as unknown as TodoItem[];
    expect(countTodoByStatus(todos)).toEqual({
      done: 0,
      active: 0,
      pending: 1,
    });
  });
});

describe("formatTodoProgressLabel", () => {
  it("joins only non-zero segments with a middle-dot", () => {
    const todos: TodoItem[] = [
      { content: "搭骨架", status: "completed" },
      { content: "写组件", status: "in_progress" },
      { content: "补测试", status: "pending" },
    ];
    expect(formatTodoProgressLabel(todos, t)).toBe(
      "1 completed\u2002·\u20021 in progress\u2002·\u20021 pending",
    );
  });

  it("omits the completed segment while nothing is done", () => {
    const todos: TodoItem[] = [
      { content: "写组件", status: "in_progress" },
      { content: "补测试", status: "pending" },
    ];
    expect(formatTodoProgressLabel(todos, t)).toBe(
      "1 in progress\u2002·\u20021 pending",
    );
  });

  it("collapses an all-completed list to the done count", () => {
    const todos: TodoItem[] = [{ content: "都完了", status: "completed" }];
    expect(formatTodoProgressLabel(todos, t)).toBe("1 completed");
  });
});
