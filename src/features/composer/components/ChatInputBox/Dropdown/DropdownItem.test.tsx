// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DropdownItem } from "./DropdownItem";

describe("DropdownItem section header", () => {
  it("renders compact group metadata for the agent picker", () => {
    const { container } = render(
      <DropdownItem
        item={{
          id: "__section__:division:design",
          label: "设计",
          type: "section-header",
          icon: "codicon-symbol-namespace",
          data: { sectionCount: 9 },
        }}
      />,
    );

    expect(screen.getByText("设计")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
    expect(
      container
        .querySelector(".dropdown-section-header-icon")
        ?.classList.contains("codicon-symbol-namespace"),
    ).toBe(true);
    expect(
      container.querySelector(".dropdown-section-header-rule"),
    ).toBeTruthy();
  });
});
