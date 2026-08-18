/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachFluidShader,
  buildDisplayFragmentShader,
  clampFluidMotionMode,
  SITE_FLUID_PARAMS,
} from "./fluidShader";

describe("buildDisplayFragmentShader", () => {
  it("clamps unknown modes to drift", () => {
    expect(clampFluidMotionMode(undefined)).toBe(0);
    expect(clampFluidMotionMode(9)).toBe(0);
    expect(clampFluidMotionMode(3.4)).toBe(3);
  });

  it("keeps structured fields out of the drift shader", () => {
    const source = buildDisplayFragmentShader(0);
    expect(source).toContain("u_flowmap");
    expect(source).not.toContain("motionTaiji");
    expect(source).not.toContain("motionStorm");
    expect(source).not.toContain("dragonStroke");
    expect(source).not.toContain("u_motionMode");
  });

  it("builds a taiji-only display shader", () => {
    const source = buildDisplayFragmentShader(1);
    expect(source).toContain("motionTaiji");
    expect(source).not.toContain("dragonStroke");
    expect(source).not.toContain("u_flowmap");
    expect(source).not.toContain("u_motionMode");
  });

  it("builds storm, tornado, and chase as their own programs", () => {
    const storm = buildDisplayFragmentShader(2);
    const tornado = buildDisplayFragmentShader(3);
    const chase = buildDisplayFragmentShader(4);
    expect(storm).toContain("motionStorm");
    expect(storm).toContain("for (float i = 1.0; i <= 4.0; i++)");
    expect(storm).not.toContain("for (int i = 1; i <= 4; i++)");
    expect(storm).not.toContain("motionTornado");
    expect(tornado).toContain("motionTornado");
    expect(tornado).not.toContain("dragonStroke");
    expect(chase).toContain("dragonStroke");
    expect(chase).toContain("i <= 26");
    expect(chase).not.toContain("u_flowmap");
  });

  it("offers a reduced chase variant for ANGLE compile fallback", () => {
    const reduced = buildDisplayFragmentShader(4, { reduced: true });
    expect(reduced).toContain("dragonStroke");
    expect(reduced).toContain("i <= 14");
    expect(reduced).not.toContain("i <= 26");
  });
});

describe("attachFluidShader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a no-op handle when WebGL2 is unavailable", () => {
    const canvas = document.createElement("canvas");
    const handle = attachFluidShader(canvas, SITE_FLUID_PARAMS);
    expect(() => {
      handle.setParams(SITE_FLUID_PARAMS);
      handle.setParams({ ...SITE_FLUID_PARAMS, motionMode: 3, speed: 9 });
      handle.setParams({ ...SITE_FLUID_PARAMS, motionMode: 4, speed: 9 });
      handle.stir(0.5, 0.5, 0, 0);
      handle.pause();
      handle.resume();
      handle.dispose();
    }).not.toThrow();
  });

  it("retries WebGL2 context with alternate flags after the first attempt fails", () => {
    const canvas = document.createElement("canvas");
    const getContext = vi.spyOn(canvas, "getContext");
    getContext.mockImplementation(((
      type: string,
      attrs?: WebGLContextAttributes,
    ) => {
      if (type !== "webgl2") {
        return null;
      }
      if (attrs?.alpha === false) {
        throw new Error("opaque context unsupported");
      }
      return null;
    }) as typeof canvas.getContext);

    const handle = attachFluidShader(canvas, SITE_FLUID_PARAMS);
    expect(getContext).toHaveBeenCalled();
    expect(
      getContext.mock.calls.some(
        (call) => call[0] === "webgl2" && call[1]?.alpha === true,
      ),
    ).toBe(true);
    expect(() => handle.dispose()).not.toThrow();
  });
});
