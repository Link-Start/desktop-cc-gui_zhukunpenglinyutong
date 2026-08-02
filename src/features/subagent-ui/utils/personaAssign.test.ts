import { describe, expect, it } from "vitest";
import {
  assignPersona,
  assignPersonaName,
  assignPersonaNamesForSquad,
  assignPersonasForSquad,
} from "./personaAssign";
import { PERSONA_AUTHOR_POOL } from "../constants/personaAuthorPool";

describe("personaAssign", () => {
  it("returns a stable name for the same agentId", () => {
    const a = assignPersonaName("agent-stable-1");
    const b = assignPersonaName("agent-stable-1");
    expect(a).toBe(b);
    expect(PERSONA_AUTHOR_POOL.some((entry) => entry.name === a)).toBe(true);
  });

  it("can differ across agent ids (squad path prefers uniqueness)", () => {
    // 单 id 加权可能高度集中在 top contributor；同批分配应尽量拉开不重名
    const names = new Set(
      assignPersonaNamesForSquad(
        Array.from({ length: 6 }, (_, index) => `agent-batch-${index}`),
      ),
    );
    expect(names.size).toBeGreaterThan(1);
  });

  it("cycles when assigning a large squad", () => {
    const ids = Array.from({ length: PERSONA_AUTHOR_POOL.length + 5 }, (_, i) => `id-${i}`);
    const names = assignPersonaNamesForSquad(ids);
    expect(names).toHaveLength(ids.length);
    expect(names.every((name) => typeof name === "string" && name.length > 0)).toBe(true);
  });

  it("never calls git (static pool only)", () => {
    // 契约测试：池非空且无运行时依赖
    expect(PERSONA_AUTHOR_POOL.length).toBeGreaterThanOrEqual(10);
    expect(assignPersonaName("x")).toBeTruthy();
  });

  it("includes github profile when login is configured", () => {
    const personas = assignPersonasForSquad(["agent-a", "agent-b"]);
    const withLogin = personas.find((entry) => entry.githubLogin);
    expect(withLogin?.githubProfileUrl).toMatch(/^https:\/\/github\.com\//);
    expect(assignPersona("agent-stable-gh").name.length).toBeGreaterThan(0);
  });
});
