/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { attachFluidShader, SITE_FLUID_PARAMS } from "./fluidShader";

describe("attachFluidShader", () => {
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
});
