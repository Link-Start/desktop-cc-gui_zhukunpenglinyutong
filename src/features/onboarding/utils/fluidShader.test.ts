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
    expect(chase).toContain("i <= 20");
    expect(chase).not.toContain("u_flowmap");
  });

  it("sends chase dragons across the stage instead of looping in place", () => {
    const chase = buildDisplayFragmentShader(4);
    expect(chase).toContain("edgePoint");
    expect(chase).toContain("tourCtrl");
    expect(chase).toContain("tourFwd");
    expect(chase).toContain("float ahead = 0.12");
    expect(chase).toContain("addSlot(p, t, 1.0");
    expect(chase).not.toContain("addSlot(p, t, 2.0");
    expect(chase).not.toContain("addSlot(p, t, 3.0");
    expect(chase).toContain("mix(0.92, 1.78, roll)");
    expect(chase).toContain("mix(0.62, 1.48, roll)");
    expect(chase).not.toContain("mix(1.85, 2.36");
    expect(chase).toContain("exitSide");
    expect(chase).toContain("float tail = 0.40");
    expect(chase).not.toContain("hornLen");
    expect(chase).not.toContain("float trot");
    expect(chase).not.toContain("float scales");
    expect(chase).not.toContain("inkW = 0.0042");
    expect(chase).not.toContain("mix(fillCol, vec3(0.03");
    expect(chase).not.toContain("0.26 * sin(t * 0.13");
    expect(chase).not.toContain("0.55 * sin(t * 0.19");
    expect(chase).not.toContain("dragonHead");
  });

  it("offers a reduced chase variant for ANGLE compile fallback", () => {
    const reduced = buildDisplayFragmentShader(4, { reduced: true });
    expect(reduced).toContain("dragonStroke");
    expect(reduced).toContain("i <= 14");
    expect(reduced).not.toContain("i <= 20");
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
