/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FluidParams, FluidShaderHandle } from "../utils/fluidShader";
import { FirstRunFluidBackdrop } from "./FirstRunFluidBackdrop";

const attachFluidShader = vi.hoisted(() =>
  vi.fn<
    (
      canvas: HTMLCanvasElement,
      params: FluidParams,
      profile?: "full" | "lite",
    ) => FluidShaderHandle
  >(() => ({
    setParams: vi.fn(),
    stir: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    dispose: vi.fn(),
  })),
);

vi.mock("../utils/fluidShader", async () => {
  const actual = await vi.importActual<typeof import("../utils/fluidShader")>(
    "../utils/fluidShader",
  );
  return {
    ...actual,
    attachFluidShader,
  };
});

describe("FirstRunFluidBackdrop", () => {
  afterEach(() => {
    attachFluidShader.mockClear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("mounts the fluid canvas and disposes on unmount", () => {
    document.documentElement.dataset.theme = "light";
    const handle: FluidShaderHandle = {
      setParams: vi.fn(),
      stir: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      dispose: vi.fn(),
    };
    attachFluidShader.mockReturnValue(handle);

    const { unmount } = render(<FirstRunFluidBackdrop />);
    expect(screen.getByTestId("first-run-fluid")).not.toBeNull();
    expect(attachFluidShader).toHaveBeenCalledTimes(1);
    expect(attachFluidShader.mock.calls[0]?.[0]).toBeInstanceOf(HTMLCanvasElement);
    expect(attachFluidShader.mock.calls[0]?.[2]).toBe("full");

    unmount();
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });

  it("pauses and resumes the shader without remounting", () => {
    const handle: FluidShaderHandle = {
      setParams: vi.fn(),
      stir: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      dispose: vi.fn(),
    };
    attachFluidShader.mockReturnValue(handle);

    const { rerender } = render(<FirstRunFluidBackdrop paused />);
    expect(handle.pause).toHaveBeenCalled();

    rerender(<FirstRunFluidBackdrop paused={false} />);
    expect(handle.resume).toHaveBeenCalled();
    expect(attachFluidShader).toHaveBeenCalledTimes(1);
  });

  it("forwards the lite profile to the shader", () => {
    render(<FirstRunFluidBackdrop profile="lite" />);
    expect(attachFluidShader.mock.calls[0]?.[2]).toBe("lite");
  });
});
