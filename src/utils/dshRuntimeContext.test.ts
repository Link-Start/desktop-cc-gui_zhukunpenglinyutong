import { describe, expect, it } from "vitest";
import {
  buildDshGoalPresentationMetadata,
  isDshGoalInjection,
  isDshInjectedContextMessage,
  isDshRuntimeContextText,
  readDshMessageSourceKind,
} from "./dshRuntimeContext";

const AGENTS_REMINDER = `<system-reminder>
The following workspace instructions may be relevant to your work.
Instructions from: AGENTS.md
# 项目规则入口
</system-reminder>`;

const SKILLS_REMINDER = `<system-reminder>
A skill is a reusable set of task-specific instructions.
<available_skills>
- \`deploy-to-vercel\`: Deploy applications
</available_skills>
</system-reminder>`;

const RUNTIME_SNAPSHOT = `Current runtime context. This snapshot supersedes earlier runtime-context snapshots.

Current DSH file policy: workspace-write.
Approval policy: ask.`;

describe("isDshRuntimeContextText", () => {
  it("hides DSH instruction, snapshot, and skill catalog envelopes", () => {
    expect(isDshRuntimeContextText(AGENTS_REMINDER)).toBe(true);
    expect(isDshRuntimeContextText(SKILLS_REMINDER)).toBe(true);
    expect(isDshRuntimeContextText(RUNTIME_SNAPSHOT)).toBe(true);
    expect(
      isDshRuntimeContextText(
        "Current runtime context: none. Earlier runtime-context snapshots no longer apply.",
      ),
    ).toBe(true);
  });

  it("keeps ordinary user prose", () => {
    expect(isDshRuntimeContextText("你好")).toBe(false);
    expect(isDshRuntimeContextText("what is a system-reminder?")).toBe(false);
  });
});

describe("isDshInjectedContextMessage", () => {
  it("hides non-user source kinds even when text looks ordinary", () => {
    expect(
      isDshInjectedContextMessage({
        text: "Instructions from: AGENTS.md",
        sourceKind: "agent-instructions",
      }),
    ).toBe(true);
    expect(
      isDshInjectedContextMessage({
        text: "skill list",
        sourceKind: "plugin",
      }),
    ).toBe(true);
  });

  it("keeps real user prompts even if they mention reminder tags", () => {
    expect(
      isDshInjectedContextMessage({
        text: "please explain <system-reminder>",
        sourceKind: "user",
      }),
    ).toBe(false);
    expect(
      isDshInjectedContextMessage({
        text: "Current runtime context: prod is down",
        sourceKind: "user",
      }),
    ).toBe(false);
  });

  it("falls back to text when source is missing", () => {
    expect(isDshInjectedContextMessage({ text: AGENTS_REMINDER })).toBe(true);
    expect(isDshInjectedContextMessage({ text: "hello" })).toBe(false);
  });

  it("keeps Goal injections visible so they can render as a card", () => {
    expect(
      isDshInjectedContextMessage({
        text: "<goal_round>\nContinue the active goal.\n</goal_round>",
        sourceKind: "goal",
      }),
    ).toBe(false);
  });

  it("hides sourceless goal_round envelopes as runtime context", () => {
    expect(
      isDshInjectedContextMessage({
        text: "<goal_round>\nContinue the active goal.\n</goal_round>",
      }),
    ).toBe(true);
  });
});

describe("isDshGoalInjection", () => {
  it("matches goal source kinds only", () => {
    expect(isDshGoalInjection("goal")).toBe(true);
    expect(isDshGoalInjection("Goal")).toBe(true);
    expect(isDshGoalInjection("user")).toBe(false);
    expect(isDshGoalInjection("plugin")).toBe(false);
    expect(isDshGoalInjection(null)).toBe(false);
  });
});

describe("buildDshGoalPresentationMetadata", () => {
  it("builds an empty-bubble dsh-goal context", () => {
    const metadata = buildDshGoalPresentationMetadata(
      "<goal_round>\nContinue the active goal.\n</goal_round>",
    );
    expect(metadata.displayText).toBe("");
    expect(metadata.stickyCandidateText).toBe("");
    expect(metadata.contexts).toEqual([
      {
        kind: "dsh-goal",
        title: "Context injection",
        sourceLabel: "goal",
        body: "<goal_round>\nContinue the active goal.\n</goal_round>",
      },
    ]);
  });
});

describe("readDshMessageSourceKind", () => {
  it("reads camelCase, snake_case, and nested source.kind", () => {
    expect(readDshMessageSourceKind({ sourceKind: "User" })).toBe("user");
    expect(readDshMessageSourceKind({ source_kind: "plugin" })).toBe("plugin");
    expect(readDshMessageSourceKind({ source: { kind: "agent-instructions" } })).toBe(
      "agent-instructions",
    );
    expect(readDshMessageSourceKind({ text: "hello" })).toBeNull();
  });
});
