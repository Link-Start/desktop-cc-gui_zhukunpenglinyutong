// engineTaskOutput — English UI strings
const engineTaskOutput = {
  engineTaskOutput: {
    label: "Task output inspector",
    inspect: "View output",
    close: "Close task output",
    engine: "{{engine}} task",
    identity: "Identity",
    telemetry: "Tokens",
    recentOutput: "Recent output",
    refresh: "Refresh",
    refreshing: "Refreshing",
    pending: "Pending",
    telemetryPending: "No trustworthy token data yet",
    outputUnavailable:
      "No output is available yet. The task may still be running, or this engine does not expose live task output.",
    artifactLive: "Updated from the task output file.",
    artifactTruncated: "Output is long; showing the most recent segment.",
    artifactUnavailable:
      "Live output is unavailable. Keeping the current snapshot.",
    status: {
      running: "Running",
      completed: "Completed",
      error: "Error",
      unavailable: "Unavailable",
    },
    tokens: {
      input: "Input",
      cached: "Cached",
      output: "Output",
      total: "Total",
    },
    telemetryStatus: {
      live: "Live data",
      estimated: "Estimated data",
      pending: "Waiting for data",
      unavailable: "Data unavailable",
    },
  },
};

export default engineTaskOutput;
