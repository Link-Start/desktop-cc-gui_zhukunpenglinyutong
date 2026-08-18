import { useEffect, useMemo, useRef, useState } from "react";
import { isWindowsPlatform } from "../../../utils/platform";
import {
  isThemeMutationAttribute,
  readDocumentThemeAppearance,
} from "../../theme/utils/themeAppearance";
import {
  attachFluidShader,
  SITE_FLUID_PARAMS,
  type FluidParams,
  type FluidShaderHandle,
  type FluidShaderProfile,
} from "../utils/fluidShader";
import {
  DEFAULT_WORKSPACE_FLUID_MOTION,
  DEFAULT_WORKSPACE_FLUID_PRESET,
  fluidPresetToneColors,
  resolveWorkspaceFluidMotion,
  resolveWorkspaceFluidPreset,
  type WorkspaceFluidMotionId,
  type WorkspaceFluidPresetId,
} from "../utils/fluidTones";

function buildFluidParams(
  dark: boolean,
  presetId: WorkspaceFluidPresetId,
  motionId: WorkspaceFluidMotionId,
  speed: number,
): FluidParams {
  const preset = resolveWorkspaceFluidPreset(presetId);
  const motion = resolveWorkspaceFluidMotion(motionId);
  return {
    ...SITE_FLUID_PARAMS,
    ...fluidPresetToneColors(dark, preset),
    motionMode: motion.mode,
    speed,
  };
}

export function FirstRunFluidBackdrop({
  paused = false,
  presetId = DEFAULT_WORKSPACE_FLUID_PRESET,
  motionId = DEFAULT_WORKSPACE_FLUID_MOTION,
  speed = SITE_FLUID_PARAMS.speed,
  profile = "full",
}: {
  paused?: boolean;
  presetId?: WorkspaceFluidPresetId;
  motionId?: WorkspaceFluidMotionId;
  speed?: number;
  profile?: FluidShaderProfile;
} = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<FluidShaderHandle | null>(null);
  const solidOnly = isWindowsPlatform();
  const [dark, setDark] = useState(
    () => readDocumentThemeAppearance() === "dark",
  );
  const params = useMemo(
    () => buildFluidParams(dark, presetId, motionId, speed),
    [dark, presetId, motionId, speed],
  );

  useEffect(() => {
    if (
      solidOnly ||
      typeof MutationObserver === "undefined" ||
      typeof document === "undefined"
    ) {
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
  }, [solidOnly]);

  // Params changes (preset / light-dark flip) are pushed through setParams so
  // the WebGL context survives; only a profile switch re-attaches.
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (solidOnly) {
      return undefined;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const handle = attachFluidShader(canvas, paramsRef.current, profile);
    handleRef.current = handle;
    if (paused) {
      handle.pause();
    }
    return () => {
      handleRef.current = null;
      handle.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, solidOnly]);

  useEffect(() => {
    handleRef.current?.setParams(params);
  }, [params]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) {
      return;
    }
    if (paused) {
      handle.pause();
      return;
    }
    handle.resume();
  }, [paused]);

  return (
    <div
      className="first-run-fluid"
      aria-hidden
      data-testid="first-run-fluid"
      data-scheme={dark ? "dark" : "light"}
      data-solid={solidOnly ? "true" : undefined}
    >
      {solidOnly ? null : (
        <canvas ref={canvasRef} className="first-run-fluid-canvas" />
      )}
    </div>
  );
}
