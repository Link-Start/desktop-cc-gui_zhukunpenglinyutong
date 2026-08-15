// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TodoList } from "./TodoList";
import type { TodoItem } from "../types";

const LIST: TodoItem[] = [
  { content: "搭骨架", status: "completed" },
  { content: "写组件", status: "in_progress" },
  { content: "补测试", status: "pending" },
];

describe("TodoList", () => {
  it("renders the empty state when there are no tasks", () => {
    render(<TodoList todos={[]} />);
    expect(screen.getByText("No tasks")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("does not repeat the Tasks title unless showTitle is set", () => {
    render(<TodoList todos={LIST} />);
    expect(screen.queryByText("statusPanel.tabTodos")).toBeNull();
    expect(screen.getByText(/1 completed.*1 in progress.*1 pending/)).toBeTruthy();
  });

  it("shows a per-status progress summary and one row per item", () => {
    render(<TodoList todos={LIST} showTitle />);

    expect(screen.getByText("statusPanel.tabTodos")).toBeTruthy();
    expect(screen.getByText(/1 completed.*1 in progress.*1 pending/)).toBeTruthy();

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("data-status"))).toEqual([
      "completed",
      "in_progress",
      "pending",
    ]);
    expect(screen.getByText("搭骨架")).toBeTruthy();
    expect(screen.getByText("写组件")).toBeTruthy();
    expect(screen.getByText("补测试")).toBeTruthy();
    expect(items.every((item) => item.querySelector("svg") !== null)).toBe(true);
  });

  it("keeps status class names used by the status panel contract", () => {
    const { container } = render(<TodoList todos={LIST} />);
    expect(container.querySelector(".sp-todo-completed")).toBeTruthy();
    expect(container.querySelector(".sp-todo-in_progress")).toBeTruthy();
    expect(container.querySelector(".sp-todo-pending")).toBeTruthy();
  });

  it("counts every parallel in-progress item in the header", () => {
    render(
      <TodoList
        todos={[
          { content: "搭骨架", status: "completed" },
          { content: "写组件", status: "in_progress" },
          { content: "跑后台构建", status: "in_progress" },
          { content: "读源码", status: "in_progress" },
          { content: "补测试", status: "pending" },
        ]}
      />,
    );

    expect(screen.getByText(/1 completed.*3 in progress.*1 pending/)).toBeTruthy();
    expect(
      screen
        .getAllByRole("listitem")
        .filter((item) => item.getAttribute("data-status") === "in_progress"),
    ).toHaveLength(3);
  });
});
