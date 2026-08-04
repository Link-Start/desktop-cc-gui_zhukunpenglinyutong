import { describe, expect, it } from "vitest";
import {
  buildGitHistoryGraphLayout,
  compactSparseCommitParents,
  filterFirstParentCommits,
  filterNoiseCommits,
  getGitHistoryGraphRowWidth,
  isGitHistoryNoiseCommit,
  layoutGitHistoryGraph,
  projectCommitsForGraph,
} from "./gitHistoryGraphLayout";

function commit(
  sha: string,
  parents: string[] = [],
  summary = `msg ${sha}`,
) {
  return { sha, parents, summary };
}

describe("layoutGitHistoryGraph", () => {
  it("places a linear history on a single lane", () => {
    const commits = [
      commit("c", ["b"]),
      commit("b", ["a"]),
      commit("a", []),
    ];
    const layout = layoutGitHistoryGraph(commits);
    expect(layout.laneCount).toBe(1);
    expect(layout.rows.map((row) => row.lane)).toEqual([0, 0, 0]);
    expect(layout.rows[0]!.edges.some((edge) => edge.kind === "parent")).toBe(true);
  });

  it("assigns a second lane for a merge parent and joins back", () => {
    // Newest-first:
    //   M (merge of main tip A and feature F)
    //   A
    //   F
    //   B (common ancestor)
    const commits = [
      commit("M", ["A", "F"]),
      commit("A", ["B"]),
      commit("F", ["B"]),
      commit("B", []),
    ];
    const layout = layoutGitHistoryGraph(commits);
    expect(layout.laneCount).toBeGreaterThanOrEqual(2);
    expect(layout.rows[0]!.lane).toBe(0);
    expect(layout.rows[0]!.edges.some((edge) => edge.kind === "merge")).toBe(true);

    const featureRow = layout.rows.find((row) => row.sha === "F");
    expect(featureRow).toBeTruthy();
    expect(featureRow!.lane).toBeGreaterThanOrEqual(1);
  });

  it("keeps the side-branch color on the join curve back to main", () => {
    // Mirrors PR merge history (newest-first):
    //   *   M
    //   |\
    //   | * F2
    //   | * F1
    //   |/
    //   * B
    // The curve under F1 must stay on the feature lane color, not flip to
    // main (lane 0 / blue).
    const commits = [
      commit("M", ["B", "F2"]),
      commit("F2", ["F1"]),
      commit("F1", ["B"]),
      commit("B", []),
    ];
    const layout = layoutGitHistoryGraph(commits);
    const featureBase = layout.rows.find((row) => row.sha === "F1");
    expect(featureBase).toBeTruthy();
    expect(featureBase!.lane).toBeGreaterThanOrEqual(1);

    const joinEdge = featureBase!.edges.find(
      (edge) => edge.kind === "parent" && edge.toLane !== edge.fromLane,
    );
    expect(joinEdge).toBeTruthy();
    expect(joinEdge!.fromLane).toBe(featureBase!.lane);
    expect(joinEdge!.toLane).toBe(0);
    expect(joinEdge!.colorLane).toBe(featureBase!.lane);
  });

  it("handles a side branch fork without merge in the window", () => {
    const commits = [
      commit("feature-tip", ["feature-base"]),
      commit("main-tip", ["main-base"]),
      commit("feature-base", ["root"]),
      commit("main-base", ["root"]),
      commit("root", []),
    ];
    const layout = layoutGitHistoryGraph(commits);
    expect(layout.laneCount).toBeGreaterThanOrEqual(2);
    const lanes = new Set(layout.rows.map((row) => row.lane));
    expect(lanes.size).toBeGreaterThanOrEqual(2);
  });

  it("returns empty layout for empty input", () => {
    expect(layoutGitHistoryGraph([])).toEqual({ rows: [], laneCount: 0 });
  });

  it("sets per-row laneSpan so inactive high lanes do not inflate every row", () => {
    // Early commits open many side lanes; later commits only sit on lane 0.
    const commits = [
      commit("tip", ["m1"]),
      commit("m1", ["m0", "s2"]),
      commit("s2", ["s1"]),
      commit("s1", ["m0"]),
      commit("m0", []),
    ];
    const layout = layoutGitHistoryGraph(commits);
    const tipRow = layout.rows[0]!;
    expect(tipRow.laneSpan).toBe(1);
    expect(getGitHistoryGraphRowWidth(tipRow.laneSpan)).toBeLessThan(
      getGitHistoryGraphRowWidth(layout.laneCount),
    );
    const mergeRow = layout.rows.find((row) => row.sha === "m1");
    expect(mergeRow).toBeTruthy();
    expect(mergeRow!.laneSpan).toBeGreaterThanOrEqual(2);
  });

  it("left-packs after main joins a higher-lane parent (VS Code style)", () => {
    // Mirrors the PR #1006 parallel history that previously left an empty
    // left column under feat(git):
    //   *   M
    //   |\
    //   | * T
    //   | * C
    //   * | F   ← join into parent already reserved on lane 1
    //   |/
    //   * B     ← must sit on lane 0 after left-pack, not stay on lane 1
    //   * R
    const commits = [
      commit("M", ["F", "T"]),
      commit("T", ["C"]),
      commit("C", ["B"]),
      commit("F", ["B"]),
      commit("B", ["R"]),
      commit("R", []),
    ];
    const layout = layoutGitHistoryGraph(commits);

    expect(layout.rows.find((row) => row.sha === "F")!.lane).toBe(0);
    expect(layout.rows.find((row) => row.sha === "B")!.lane).toBe(0);
    expect(layout.rows.find((row) => row.sha === "R")!.lane).toBe(0);

    // Join row ends at packed lane 0 so the next node top-stub connects.
    const featureRow = layout.rows.find((row) => row.sha === "F")!;
    expect(
      featureRow.edges.some(
        (edge) => edge.kind === "parent" && edge.fromLane === 0 && edge.toLane === 0,
      ),
    ).toBe(true);
    // Side-branch pass slides left with the pack (1 → 0) instead of vanishing.
    expect(
      featureRow.edges.some(
        (edge) => edge.kind === "pass" && edge.fromLane === 1 && edge.toLane === 0,
      ),
    ).toBe(true);
  });
});

describe("filterFirstParentCommits", () => {
  it("keeps only the first-parent spine from the tip", () => {
    const commits = [
      commit("M", ["A", "F"]),
      commit("A", ["B"]),
      commit("F", ["B"]),
      commit("B", []),
    ];
    const filtered = filterFirstParentCommits(commits);
    expect(filtered.map((item) => item.sha)).toEqual(["M", "A", "B"]);
  });
});

describe("filterNoiseCommits / isGitHistoryNoiseCommit", () => {
  it("detects trellis session commits", () => {
    expect(isGitHistoryNoiseCommit(commit("x", [], "chore(trellis): 记录会话"))).toBe(
      true,
    );
    expect(isGitHistoryNoiseCommit(commit("x", [], "fix(ui): real work"))).toBe(false);
  });

  it("drops noise and rewrites parents across gaps", () => {
    const commits = [
      commit("c3", ["noise"], "feat: after"),
      commit("noise", ["c1"], "chore(trellis): 记录会话"),
      commit("c1", [], "feat: before"),
    ];
    const filtered = filterNoiseCommits(commits);
    expect(filtered.map((item) => item.sha)).toEqual(["c3", "c1"]);
    expect(filtered[0]!.parents).toEqual(["c1"]);
  });
});

describe("compactSparseCommitParents", () => {
  it("keeps parents that are still present in the filtered list", () => {
    const commits = [
      commit("c3", ["c2"]),
      commit("c2", ["c1"]),
      commit("c1", []),
    ];
    const compacted = compactSparseCommitParents(commits);
    expect(compacted.map((item) => item.parents)).toEqual([
      ["c2"],
      ["c1"],
      [],
    ]);
  });

  it("rewrites missing parents to the next older displayed commit", () => {
    // Author filter: only this user's commits remain; intermediates gone.
    const commits = [
      commit("a3", ["other2"]),
      commit("a2", ["other1"]),
      commit("a1", ["root-outside"]),
    ];
    const compacted = compactSparseCommitParents(commits);
    expect(compacted.map((item) => item.sha)).toEqual(["a3", "a2", "a1"]);
    expect(compacted.map((item) => item.parents)).toEqual([
      ["a2"],
      ["a1"],
      [],
    ]);
  });

  it("drops missing merge parents but keeps present ones", () => {
    const commits = [
      commit("M", ["A", "missing-side"]),
      commit("A", ["B"]),
      commit("B", []),
    ];
    const compacted = compactSparseCommitParents(commits);
    expect(compacted[0]!.parents).toEqual(["A"]);
  });
});

describe("projectCommitsForGraph + buildGitHistoryGraphLayout", () => {
  it("combines first-parent and noise filters", () => {
    const commits = [
      commit("M", ["A", "F"], "Merge PR"),
      commit("A", ["noise"], "fix on main"),
      commit("noise", ["B"], "chore(trellis): 记录会话"),
      commit("F", ["B"], "feature work"),
      commit("B", [], "base"),
    ];
    const projected = projectCommitsForGraph(commits, {
      firstParentOnly: true,
      hideNoise: true,
    });
    expect(projected.map((item) => item.sha)).toEqual(["M", "A", "B"]);
    expect(projected[1]!.parents).toEqual(["B"]);

    const { layout } = buildGitHistoryGraphLayout(commits, {
      firstParentOnly: true,
      hideNoise: true,
    });
    expect(layout.laneCount).toBe(1);
    expect(layout.rows).toHaveLength(3);
  });

  it("sparseList collapses author-filtered gaps into a single lane", () => {
    // Simulates author filter: same author, parents point at other authors
    // who were removed from the page → without sparseList this opens
    // phantom lanes (rainbow lines with no nodes).
    const commits = [
      commit("a4", ["x3"]),
      commit("a3", ["x2"]),
      commit("a2", ["x1"]),
      commit("a1", ["root"]),
    ];
    const { layout } = buildGitHistoryGraphLayout(commits, {
      sparseList: true,
    });
    expect(layout.laneCount).toBe(1);
    expect(layout.rows.map((row) => row.lane)).toEqual([0, 0, 0, 0]);
    expect(layout.rows.every((row) => row.laneSpan === 1)).toBe(true);
  });

  it("without sparseList, missing parents still open extra lanes", () => {
    const commits = [
      commit("a3", ["x2"]),
      commit("a2", ["x1"]),
      commit("a1", []),
    ];
    const { layout } = buildGitHistoryGraphLayout(commits, {
      sparseList: false,
    });
    // Phantom parent placeholders force laneCount > 1 for this sparse set.
    expect(layout.laneCount).toBeGreaterThan(1);
  });
});
