import { describe, expect, it } from "vitest";
import type { EngineStatus } from "../../../types";
import type { FirstRunEngineCardState } from "../components/FirstRunCliStep";
import {
  resolveFirstRunPrimaryEngine,
  resolveFirstRunSelectedEngineAfterDetect,
} from "./resolvePrimaryEngine";

function status(
  engineType: EngineStatus["engineType"],
  installed: boolean,
): EngineStatus {
  return {
    engineType,
    installed,
    version: installed ? "1.0.0" : null,
    binPath: installed ? `/usr/local/bin/${engineType}` : null,
    features: {
      streaming: false,
      imageInput: false,
    },
    models: [],
    error: null,
  };
}

const installedCards: Partial<
  Record<"claude" | "dsh", FirstRunEngineCardState>
> = {
  claude: {
    installed: true,
    validated: true,
    version: "2.1.228",
    busy: false,
    error: null,
  },
  dsh: {
    installed: true,
    validated: true,
    version: "0.1.0-rc.6",
    busy: false,
    error: null,
  },
};

describe("resolveFirstRunPrimaryEngine", () => {
  it("prefers the user-selected installed engine over the first detected CLI", () => {
    expect(
      resolveFirstRunPrimaryEngine({
        selectedEngine: "dsh",
        profile: {
          primaryEngine: "claude",
          validatedEngines: ["claude", "dsh"],
        },
        engineStatuses: [status("claude", true), status("dsh", true)],
        cardStateByEngine: installedCards,
      }),
    ).toBe("dsh");
  });

  it("falls back to the stored primary when the highlight is not installed", () => {
    expect(
      resolveFirstRunPrimaryEngine({
        selectedEngine: "opencode",
        profile: {
          primaryEngine: "dsh",
          validatedEngines: ["claude", "dsh"],
        },
        engineStatuses: [status("claude", true), status("dsh", true)],
        cardStateByEngine: installedCards,
      }),
    ).toBe("dsh");
  });
});

describe("resolveFirstRunSelectedEngineAfterDetect", () => {
  it("keeps the current selection even when that engine is still missing", () => {
    expect(
      resolveFirstRunSelectedEngineAfterDetect({
        selectedEngine: "opencode",
        primaryEngine: "claude",
        installedEngines: ["claude", "codex", "dsh"],
      }),
    ).toBe("opencode");
  });

  it("does not snap back to the first detected engine after detect", () => {
    expect(
      resolveFirstRunSelectedEngineAfterDetect({
        selectedEngine: null,
        primaryEngine: "dsh",
        installedEngines: ["claude", "dsh"],
      }),
    ).toBe("dsh");
  });
});
