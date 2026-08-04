/**
 * Git History multi-lane graph layout.
 *
 * Input commits must already be in display order (newest-first topological /
 * time order as returned by get_git_commit_history). Parents are full SHAs.
 */

export type GitHistoryGraphCommitInput = {
  sha: string;
  parents: readonly string[];
  summary?: string;
  refs?: readonly string[];
};

export type GitHistoryGraphEdgeKind = "parent" | "merge" | "pass";

export type GitHistoryGraphEdge = {
  /** Lane of the edge start (top or mid of row). */
  fromLane: number;
  /** Lane of the edge end (mid or bottom of row). */
  toLane: number;
  /**
   * Stable color index: the lane whose identity this edge continues.
   * For parent/join edges this is the source (branch) lane so side branches
   * keep their color through the join curve; for merge edges it is the
   * second-parent lane; for pass edges it is the through lane itself.
   */
  colorLane: number;
  kind: GitHistoryGraphEdgeKind;
};

export type GitHistoryGraphRow = {
  sha: string;
  /** Horizontal lane of this commit's node. */
  lane: number;
  /**
   * Edges drawn inside this row:
   * - pass: vertical through-lines (top → bottom)
   * - parent/merge: from node mid to bottom at parent lane
   */
  edges: readonly GitHistoryGraphEdge[];
  /**
   * How many lane columns this row actually paints (max used lane index + 1).
   * Used for per-row graph width so inactive high lanes do not reserve empty
   * space before the commit text.
   */
  laneSpan: number;
};

export type GitHistoryGraphLayout = {
  rows: readonly GitHistoryGraphRow[];
  /** Peak concurrent lanes across the loaded window (diagnostic / cap). */
  laneCount: number;
};

export type GitHistoryGraphViewOptions = {
  /** Keep only the first-parent spine from the tip (list[0]). */
  firstParentOnly?: boolean;
  /**
   * Drop "session noise" commits (default: chore(trellis) summaries).
   * Parent links are rewritten so the graph stays continuous.
   */
  hideNoise?: boolean;
  isNoise?: (commit: GitHistoryGraphCommitInput) => boolean;
  /**
   * List is a sparse subset (author / query / date filter): parent SHAs often
   * point at commits not present in the page. Compact those links so multi-lane
   * layout does not open phantom rainbow lanes with no nodes.
   */
  sparseList?: boolean;
};

export const GIT_HISTORY_GRAPH_LANE_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#84cc16",
  "#6366f1",
  "#14b8a6",
  "#e11d48",
] as const;

export const GIT_HISTORY_GRAPH_LANE_WIDTH = 14;
/** Small inset so the leftmost node is not flush against the pane edge. */
export const GIT_HISTORY_GRAPH_LEFT_PAD = 4;
export const GIT_HISTORY_GRAPH_NODE_RADIUS = 3.5;
/** Default/fallback graph slice height; live rows pass measured virtualizer size. */
export const GIT_HISTORY_GRAPH_ROW_HEIGHT = 58;

/** Pixel width for a graph row that paints `laneSpan` columns. */
export function getGitHistoryGraphRowWidth(laneSpan: number): number {
  const span = Math.max(1, laneSpan);
  return GIT_HISTORY_GRAPH_LEFT_PAD + span * GIT_HISTORY_GRAPH_LANE_WIDTH;
}

/** Highest lane index touched by a node or any edge in the row (+1 => span). */
export function getGitHistoryGraphRowLaneSpan(
  lane: number,
  edges: readonly GitHistoryGraphEdge[],
): number {
  let maxLane = lane;
  for (const edge of edges) {
    if (edge.fromLane > maxLane) maxLane = edge.fromLane;
    if (edge.toLane > maxLane) maxLane = edge.toLane;
  }
  return Math.max(1, maxLane + 1);
}

export function getGitHistoryGraphLaneColor(lane: number): string {
  const palette = GIT_HISTORY_GRAPH_LANE_COLORS;
  return palette[((lane % palette.length) + palette.length) % palette.length]!;
}

/** Default noise heuristic: Trellis session-record commits. */
export function isGitHistoryNoiseCommit(commit: GitHistoryGraphCommitInput): boolean {
  const summary = (commit.summary ?? "").trim();
  if (!summary) {
    return false;
  }
  return /^chore\s*\(\s*trellis\s*\)/i.test(summary);
}

/**
 * Walk first-parent chain starting at the tip (first commit in display order).
 * Commits not on that chain are dropped; order is preserved.
 */
export function filterFirstParentCommits<T extends GitHistoryGraphCommitInput>(
  commits: readonly T[],
): T[] {
  if (commits.length === 0) {
    return [];
  }
  const bySha = new Map(commits.map((commit) => [commit.sha, commit]));
  const tip = commits[0]!;
  const kept = new Set<string>();
  let current: string | undefined = tip.sha;
  const guard = new Set<string>();
  while (current && bySha.has(current) && !guard.has(current)) {
    guard.add(current);
    kept.add(current);
    const node = bySha.get(current);
    current = node?.parents[0];
  }
  if (kept.size === 0) {
    return [...commits];
  }
  return commits.filter((commit) => kept.has(commit.sha));
}

/**
 * Drop noise commits and rewrite parents so remaining rows still form a graph.
 * Unloaded external parent SHAs are kept as-is for pagination continuity.
 */
export function filterNoiseCommits<T extends GitHistoryGraphCommitInput>(
  commits: readonly T[],
  isNoise: (commit: GitHistoryGraphCommitInput) => boolean = isGitHistoryNoiseCommit,
): Array<T & { parents: string[] }> {
  if (commits.length === 0) {
    return [];
  }
  const bySha = new Map(commits.map((commit) => [commit.sha, commit]));
  const keptList = commits.filter((commit) => !isNoise(commit));
  if (keptList.length === commits.length) {
    return keptList.map((commit) => ({
      ...commit,
      parents: [...commit.parents],
    }));
  }
  const kept = new Set(keptList.map((commit) => commit.sha));

  const resolveParent = (start: string): string | null => {
    let current: string | null = start;
    const seen = new Set<string>();
    while (current) {
      if (kept.has(current)) {
        return current;
      }
      if (seen.has(current)) {
        return null;
      }
      seen.add(current);
      const node = bySha.get(current);
      if (!node) {
        // Parent not in the loaded page — keep the dangling ref.
        return current;
      }
      current = node.parents[0] ?? null;
    }
    return null;
  };

  return keptList.map((commit) => {
    const rewritten: string[] = [];
    for (const parent of commit.parents) {
      const resolved = resolveParent(parent);
      if (resolved && !rewritten.includes(resolved) && resolved !== commit.sha) {
        rewritten.push(resolved);
      }
    }
    return {
      ...commit,
      parents: rewritten,
    };
  });
}

/**
 * Compact parent links when the visible list is a sparse subset.
 *
 * - Keep only parents that also appear in this list (real topology within page).
 * - If no parent remains in-list, fall back to the next older displayed commit
 *   so the graph becomes a continuous single-lane timeline instead of opening
 *   phantom lanes for missing authors / filtered-out intermediates.
 */
export function compactSparseCommitParents<T extends GitHistoryGraphCommitInput>(
  commits: readonly T[],
): Array<T & { parents: string[] }> {
  if (commits.length === 0) {
    return [];
  }

  const present = new Set(commits.map((commit) => commit.sha));

  return commits.map((commit, index) => {
    const rewritten: string[] = [];
    for (const parent of commit.parents) {
      if (
        present.has(parent)
        && parent !== commit.sha
        && !rewritten.includes(parent)
      ) {
        rewritten.push(parent);
      }
    }

    if (rewritten.length === 0 && index < commits.length - 1) {
      const nextOlder = commits[index + 1]!.sha;
      if (nextOlder !== commit.sha) {
        rewritten.push(nextOlder);
      }
    }

    return {
      ...commit,
      parents: rewritten,
    };
  });
}

/**
 * Apply view options then produce commits suitable for layout + list rendering.
 */
export function projectCommitsForGraph<T extends GitHistoryGraphCommitInput>(
  commits: readonly T[],
  options: GitHistoryGraphViewOptions = {},
): Array<T & { parents: string[] }> {
  let working: Array<T & { parents: string[] }> = commits.map((commit) => ({
    ...commit,
    parents: [...commit.parents],
  }));

  if (options.firstParentOnly) {
    working = filterFirstParentCommits(working).map((commit) => ({
      ...commit,
      parents: commit.parents[0] ? [commit.parents[0]] : [],
    }));
  }

  if (options.hideNoise) {
    working = filterNoiseCommits(working, options.isNoise ?? isGitHistoryNoiseCommit);
  }

  // Sparse compact runs last so author/query/date filters can heal parent gaps
  // left after first-parent / noise projection.
  if (options.sparseList) {
    working = compactSparseCommitParents(working);
  }

  return working;
}

function allocateLane(active: Array<string | null>, sha: string): number {
  const existing = active.indexOf(sha);
  if (existing !== -1) {
    return existing;
  }
  const free = active.findIndex((value) => value === null);
  if (free !== -1) {
    active[free] = sha;
    return free;
  }
  active.push(sha);
  return active.length - 1;
}

/**
 * Left-pack active lanes (VS Code SCM Graph style): remove holes so the
 * continuing spine stays on the leftmost columns instead of leaving empty
 * tracks after a join frees a lower lane.
 *
 * Returns oldLane → newLane for every non-null entry. Callers remap edge
 * `toLane` values so this row ends at the packed positions and the next row
 * connects without a visual jump.
 */
function recompactActiveLanes(active: Array<string | null>): Map<number, number> {
  const mapping = new Map<number, number>();
  let write = 0;
  for (let read = 0; read < active.length; read += 1) {
    const value = active[read];
    if (value === null) {
      continue;
    }
    if (read !== write) {
      active[write] = value;
    }
    mapping.set(read, write);
    write += 1;
  }
  active.length = write;
  return mapping;
}

/** Remap each edge's bottom endpoint after left-packing active lanes. */
function remapEdgeToLanes(
  edges: GitHistoryGraphEdge[],
  mapping: Map<number, number>,
): void {
  if (mapping.size === 0) {
    return;
  }
  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index]!;
    const nextTo = mapping.get(edge.toLane);
    if (nextTo === undefined || nextTo === edge.toLane) {
      continue;
    }
    edges[index] = {
      ...edge,
      toLane: nextTo,
    };
  }
}

/**
 * Classic newest-first multi-lane assignment (git log --graph style), with
 * left-packing after each commit so freed low lanes do not leave empty columns.
 */
export function layoutGitHistoryGraph(
  commits: readonly GitHistoryGraphCommitInput[],
): GitHistoryGraphLayout {
  if (commits.length === 0) {
    return { rows: [], laneCount: 0 };
  }

  /** active[lane] = next expected commit SHA on that lane (child already drawn above). */
  const active: Array<string | null> = [];
  const rows: GitHistoryGraphRow[] = [];
  let maxLane = 0;

  for (const commit of commits) {
    const sha = commit.sha;
    const parents = commit.parents;

    const lane = allocateLane(active, sha);
    maxLane = Math.max(maxLane, lane);

    // Collapse duplicate placeholders of the same SHA on other lanes.
    for (let index = 0; index < active.length; index += 1) {
      if (index !== lane && active[index] === sha) {
        active[index] = null;
      }
    }

    const edges: GitHistoryGraphEdge[] = [];

    // Pass-through lines for other active lanes (top → bottom).
    for (let index = 0; index < active.length; index += 1) {
      if (index === lane) {
        continue;
      }
      if (active[index] !== null) {
        edges.push({
          fromLane: index,
          toLane: index,
          colorLane: index,
          kind: "pass",
        });
      }
    }

    if (parents.length === 0) {
      active[lane] = null;
    } else {
      const firstParent = parents[0]!;
      const existingFirst = active.findIndex(
        (value, index) => value === firstParent && index !== lane,
      );

      if (existingFirst !== -1) {
        // Branch joins an existing lane (fork already drawn elsewhere).
        // Keep the source lane color so the side branch stays yellow/etc.
        // through the join curve instead of flipping to the main-lane blue.
        edges.push({
          fromLane: lane,
          toLane: existingFirst,
          colorLane: lane,
          kind: "parent",
        });
        active[lane] = null;
        maxLane = Math.max(maxLane, existingFirst);
      } else {
        active[lane] = firstParent;
        edges.push({
          fromLane: lane,
          toLane: lane,
          colorLane: lane,
          kind: "parent",
        });
      }

      for (let parentIndex = 1; parentIndex < parents.length; parentIndex += 1) {
        const parentSha = parents[parentIndex]!;
        const parentLane = allocateLane(active, parentSha);
        maxLane = Math.max(maxLane, parentLane);
        edges.push({
          fromLane: lane,
          toLane: parentLane,
          colorLane: parentLane,
          kind: "merge",
        });
      }
    }

    // Left-pack so subsequent commits hug the left edge (VS Code style).
    // Remap edge bottoms so the packed spine is continuous across row boundaries.
    const laneMapping = recompactActiveLanes(active);
    remapEdgeToLanes(edges, laneMapping);
    maxLane = Math.max(maxLane, Math.max(0, active.length - 1));

    rows.push({
      sha,
      lane,
      edges,
      laneSpan: getGitHistoryGraphRowLaneSpan(lane, edges),
    });
  }

  return {
    rows,
    laneCount: Math.max(1, maxLane + 1),
  };
}

export function buildGitHistoryGraphLayout(
  commits: readonly GitHistoryGraphCommitInput[],
  options: GitHistoryGraphViewOptions = {},
): {
  commits: Array<GitHistoryGraphCommitInput & { parents: string[] }>;
  layout: GitHistoryGraphLayout;
} {
  const projected = projectCommitsForGraph(commits, options);
  return {
    commits: projected,
    layout: layoutGitHistoryGraph(projected),
  };
}
