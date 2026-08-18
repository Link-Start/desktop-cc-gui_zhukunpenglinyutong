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
      options?: { forceAnimate?: boolean; deferChase?: boolean },
    ) => FluidShaderHandle
  >(() => ({
    attached: true,
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
      attached: true,
      setParams: vi.fn(),
      stir: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      dispose: vi.fn(),
    };
    attachFluidShader.mockReturnValue(handle);

    const { unmount } = render(<FirstRunFluidBackdrop />);
    expect(screen.getByTestId("first-run-fluid")).not.toBeNull();
    expect(screen.getByTestId("first-run-fluid").dataset.motion).toBe("drift");
    expect(screen.getByTestId("first-run-fluid").dataset.attached).toBe("true");
    expect(attachFluidShader).toHaveBeenCalledTimes(1);
    expect(attachFluidShader.mock.calls[0]?.[0]).toBeInstanceOf(HTMLCanvasElement);
    expect(attachFluidShader.mock.calls[0]?.[2]).toBe("full");
    expect(attachFluidShader.mock.calls[0]?.[3]).toEqual({
      forceAnimate: false,
      deferChase: false,
    });

    unmount();
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });

  it("pauses and resumes the shader without remounting", () => {
    const handle: FluidShaderHandle = {
      attached: true,
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
    render(<FirstRunFluidBackdrop profile="lite" forceAnimate deferChase />);
    expect(attachFluidShader.mock.calls[0]?.[2]).toBe("lite");
    expect(attachFluidShader.mock.calls[0]?.[3]).toEqual({
      forceAnimate: true,
      deferChase: true,
    });
  });

  it("keeps first-run speed and drift unless workspace overrides them", () => {
    render(<FirstRunFluidBackdrop />);
    const params = attachFluidShader.mock.calls[0]?.[1];
    expect(params?.speed).toBe(14);
    expect(params?.motionMode).toBe(0);
  });

  it("forwards workspace motion and speed through setParams without remounting", () => {
    const handle: FluidShaderHandle = {
      attached: true,
      setParams: vi.fn(),
      stir: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      dispose: vi.fn(),
    };
    attachFluidShader.mockReturnValue(handle);

    const { rerender } = render(
      <FirstRunFluidBackdrop motionId="drift" speed={9} />,
    );
    expect(attachFluidShader).toHaveBeenCalledTimes(1);

    rerender(<FirstRunFluidBackdrop motionId="tornado" speed={9} />);
    expect(attachFluidShader).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("first-run-fluid").dataset.motion).toBe("tornado");
    expect(handle.setParams).toHaveBeenCalledWith(
      expect.objectContaining({ motionMode: 3, speed: 9 }),
    );
  });

  it("reports attach success to the wallpaper host", () => {
    const onAttachChange = vi.fn();
    const { unmount } = render(
      <FirstRunFluidBackdrop onAttachChange={onAttachChange} />,
    );
    expect(onAttachChange).toHaveBeenCalledWith(true);
    unmount();
    expect(onAttachChange).toHaveBeenCalledWith(false);
  });

  it("mounts the fluid canvas even when the host reports Windows", () => {
    const { container } = render(<FirstRunFluidBackdrop />);
    const backdrop = screen.getByTestId("first-run-fluid");
    expect(backdrop.dataset.solid).toBeUndefined();
    expect(backdrop.dataset.attached).toBe("true");
    expect(container.querySelector("canvas")).toBeInstanceOf(HTMLCanvasElement);
    expect(attachFluidShader).toHaveBeenCalledTimes(1);
  });
});
