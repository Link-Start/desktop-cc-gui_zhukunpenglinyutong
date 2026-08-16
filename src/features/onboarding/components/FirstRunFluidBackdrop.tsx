import { useEffect, useMemo, useRef, useState } from "react";
import {
  isThemeMutationAttribute,
  readDocumentThemeAppearance,
} from "../../theme/utils/themeAppearance";
import {
  attachFluidShader,
  SITE_FLUID_PARAMS,
  type FluidParams,
} from "../utils/fluidShader";
import {
  FIRST_RUN_FLUID_DEPTH,
  FIRST_RUN_FLUID_HUE,
  fluidToneColors,
} from "../utils/fluidTones";

function buildFluidParams(dark: boolean): FluidParams {
  const tones = fluidToneColors(dark, FIRST_RUN_FLUID_HUE, FIRST_RUN_FLUID_DEPTH);
  return {
    ...SITE_FLUID_PARAMS,
    ...tones,
  };
}

export function FirstRunFluidBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dark, setDark] = useState(
    () => readDocumentThemeAppearance() === "dark",
  );
  const params = useMemo(() => buildFluidParams(dark), [dark]);

  useEffect(() => {
    if (typeof MutationObserver === "undefined" || typeof document === "undefined") {
      return undefined;
    }
    const root = document.documentElement;
    const sync = () => {
      const nextDark = readDocumentThemeAppearance() === "dark";
      setDark((current) => (current === nextDark ? current : nextDark));
    };
    const observer = new MutationObserver((records) => {
      if (records.some((record) => isThemeMutationAttribute(record.attributeName))) {
        sync();
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    sync();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const handle = attachFluidShader(canvas, params);
    return () => {
      handle.dispose();
    };
  }, [params]);

  return (
    <div
      className="first-run-fluid"
      aria-hidden
      data-testid="first-run-fluid"
      data-scheme={dark ? "dark" : "light"}
    >
      <canvas ref={canvasRef} className="first-run-fluid-canvas" />
    </div>
  );
}
