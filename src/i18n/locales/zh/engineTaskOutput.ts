// engineTaskOutput — Simplified Chinese UI strings
const engineTaskOutput = {
  engineTaskOutput: {
    label: "任务输出检查器",
    inspect: "查看输出",
    close: "关闭任务输出",
    engine: "{{engine}} task",
    identity: "身份",
    telemetry: "Token",
    recentOutput: "最近输出",
    refresh: "刷新",
    refreshing: "刷新中",
    pending: "待更新",
    telemetryPending: "暂无可信 token 数据",
    outputUnavailable:
      "暂无可用输出；任务可能仍在运行，或当前引擎未暴露实时输出。",
    artifactLive: "已从任务输出文件更新。",
    artifactTruncated: "输出较长，仅显示最近片段。",
    artifactUnavailable: "实时输出暂不可用，已保留当前快照。",
    status: {
      running: "运行中",
      completed: "已完成",
      error: "异常",
      unavailable: "不可用",
    },
    tokens: {
      input: "输入",
      cached: "缓存",
      output: "输出",
      total: "合计",
    },
    telemetryStatus: {
      live: "实时数据",
      estimated: "估算数据",
      pending: "等待数据",
      unavailable: "数据不可用",
    },
  },
};

export default engineTaskOutput;
