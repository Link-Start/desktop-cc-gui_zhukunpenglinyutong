import type { RuntimeLifecycleState, RuntimePoolRow } from "../../../types";

export type ExecutableSessionProjection = Readonly<{
  logicalSessionId: string;
  engine: string;
  runtimeGeneration: string | null;
  lifecycleState: RuntimeLifecycleState | null;
  nativeBinding: string | null;
}>;

export function createExecutableSessionProjectionSelector() {
  let previousSignature = "";
  let previousProjection: readonly ExecutableSessionProjection[] = Object.freeze([]);

  return (rows: readonly RuntimePoolRow[]): readonly ExecutableSessionProjection[] => {
    const signature = rows
      .map(
        (row) =>
          `${row.workspaceId}\u0000${row.engine}\u0000${row.runtimeGeneration ?? ""}\u0000${row.lifecycleState ?? ""}\u0000${row.pid ?? ""}`,
      )
      .join("\u0001");
    if (signature === previousSignature) {
      return previousProjection;
    }
    previousSignature = signature;
    previousProjection = Object.freeze(
      rows.map((row) =>
        Object.freeze({
          logicalSessionId: row.workspaceId,
          engine: row.engine,
          runtimeGeneration: row.runtimeGeneration ?? null,
          lifecycleState: row.lifecycleState ?? null,
          nativeBinding: row.pid === null ? null : `pid:${row.pid}`,
        }),
      ),
    );
    return previousProjection;
  };
}
