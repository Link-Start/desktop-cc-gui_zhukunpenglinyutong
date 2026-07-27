import { useEffect, useRef } from "react";
import { pushGlobalRuntimeNotice } from "../../../services/globalRuntimeNotices";
import type { EngineType } from "../../../types";
import type { EngineDisplayInfo } from "./engineControllerAvailability";

export function useEngineRuntimeNotices(
  availableEngines: readonly EngineDisplayInfo[],
  isInitialized: boolean,
) {
  const previousAvailabilityRef = useRef<
    Partial<Record<EngineType, EngineDisplayInfo["availabilityState"]>>
  >({});

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const previousAvailability = previousAvailabilityRef.current;
    const nextAvailability: Partial<
      Record<EngineType, EngineDisplayInfo["availabilityState"]>
    > = {};

    availableEngines.forEach((engine) => {
      const nextState =
        engine.availabilityState ??
        (engine.installed ? "ready" : "unavailable");
      const previousState = previousAvailability[engine.type];
      nextAvailability[engine.type] = nextState;

      if (nextState === previousState) {
        return;
      }

      const transition =
        nextState === "requires-login"
          ? {
              severity: "warning" as const,
              messageKey: "runtimeNotice.engine.requiresLogin",
            }
          : nextState === "unavailable"
            ? {
                severity: "warning" as const,
                messageKey: "runtimeNotice.engine.unavailable",
              }
            : nextState === "ready" &&
                previousState != null &&
                previousState !== "ready"
              ? {
                  severity: "info" as const,
                  messageKey: "runtimeNotice.engine.ready",
                }
              : null;

      if (!transition) {
        return;
      }
      pushGlobalRuntimeNotice({
        ...transition,
        category: "diagnostic",
        messageParams: { engine: engine.displayName },
        dedupeKey: `engine:${engine.type}:${nextState}`,
      });
    });

    previousAvailabilityRef.current = nextAvailability;
  }, [availableEngines, isInitialized]);
}
