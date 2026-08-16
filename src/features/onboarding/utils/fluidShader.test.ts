/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { attachFluidShader, SITE_FLUID_PARAMS } from "./fluidShader";

describe("attachFluidShader", () => {
  it("returns a no-op handle when WebGL2 is unavailable", () => {
    const canvas = document.createElement("canvas");
    const handle = attachFluidShader(canvas, SITE_FLUID_PARAMS);
    expect(() => {
      handle.setParams(SITE_FLUID_PARAMS);
      handle.stir(0.5, 0.5, 0, 0);
      handle.dispose();
    }).not.toThrow();
  });
});
