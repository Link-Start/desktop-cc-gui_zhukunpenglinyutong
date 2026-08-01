// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { CollapsibleReveal } from "./CollapsibleReveal";

function Harness({
  initialOpen = false,
  keepMounted = false,
}: {
  initialOpen?: boolean;
  keepMounted?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen((value) => !value)}>
        toggle
      </button>
      <CollapsibleReveal open={open} keepMounted={keepMounted} data-testid="panel">
        <div data-testid="body">body-content</div>
      </CollapsibleReveal>
    </div>
  );
}

describe("CollapsibleReveal", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts closed without mounting body by default", () => {
    render(<Harness initialOpen={false} />);
    expect(screen.queryByTestId("body")).toBeNull();
    expect(screen.queryByTestId("panel")).toBeNull();
  });

  it("starts open without requiring a toggle", () => {
    render(<Harness initialOpen />);
    expect(screen.getByTestId("body").textContent).toBe("body-content");
    expect(screen.getByTestId("panel").getAttribute("data-state")).toBe("open");
  });

  it("mounts on expand and unmounts after collapse in jsdom", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("body")).toBeTruthy();
    expect(screen.getByTestId("panel").getAttribute("data-state")).toBe("open");

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    // jsdom has no CSS transition duration → immediate unmount fallback
    expect(screen.queryByTestId("body")).toBeNull();
    expect(screen.queryByTestId("panel")).toBeNull();
  });

  it("keepMounted retains body while closed", () => {
    render(<Harness keepMounted initialOpen />);
    expect(screen.getByTestId("body")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("body")).toBeTruthy();
    expect(screen.getByTestId("panel").getAttribute("data-state")).toBe("closed");
  });
});
