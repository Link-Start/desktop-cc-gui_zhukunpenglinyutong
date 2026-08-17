import type { CodexDoctorResult, DshHostDescribeSnapshot } from "../../../types";

export type DshHostKind = "checking" | "missing" | "down" | "connected";

export type DshHostViewModel = {
  kind: DshHostKind;
  origin: string;
  provider: string | null;
  model: string | null;
  attachedSessions: number | null;
  error: string | null;
};

export function buildDshOrigin(host: string | null | undefined, port: number | null | undefined): string {
  const nextHost = host?.trim() || "127.0.0.1";
  const nextPort = port && port > 0 && port <= 65535 ? port : 3080;
  return `http://${nextHost}:${nextPort}`;
}

function readDescribe(
  describe: DshHostDescribeSnapshot | null | undefined,
): Pick<DshHostViewModel, "provider" | "model" | "attachedSessions"> {
  const attached = describe?.attachedSessions;
  return {
    provider: describe?.provider?.trim() || null,
    model: describe?.model?.trim() || null,
    attachedSessions:
      typeof attached === "number" && Number.isFinite(attached) ? attached : null,
  };
}

export function mapDshDoctorToHostView(input: {
  doctor: CodexDoctorResult | null;
  loading: boolean;
  host: string | null | undefined;
  port: number | null | undefined;
}): DshHostViewModel {
  const fallbackOrigin = buildDshOrigin(input.host, input.port);
  const describe = input.doctor?.hostDescribe ?? null;
  const origin = describe?.origin?.trim() || fallbackOrigin;
  const facts = readDescribe(describe?.describe);

  if (!input.doctor && input.loading) {
    return {
      kind: "checking",
      origin,
      provider: null,
      model: null,
      attachedSessions: null,
      error: null,
    };
  }

  if (!input.doctor) {
    return {
      kind: "checking",
      origin,
      provider: null,
      model: null,
      attachedSessions: null,
      error: null,
    };
  }

  // Host down must not look like a missing binary. Version present = CLI exists.
  if (!input.doctor.version) {
    return {
      kind: "missing",
      origin,
      provider: null,
      model: null,
      attachedSessions: null,
      error: input.doctor.details ?? input.doctor.nodeDetails ?? null,
    };
  }

  if (describe?.ok === true) {
    return {
      kind: "connected",
      origin,
      ...facts,
      error: null,
    };
  }

  return {
    kind: "down",
    origin,
    provider: null,
    model: null,
    attachedSessions: null,
    error: describe?.error ?? describe?.details ?? input.doctor.details ?? null,
  };
}

export function dshConnectionSummary(
  view: DshHostViewModel,
  autoStart: boolean,
): { originLabel: string; autoStartOn: boolean } {
  return {
    originLabel: view.origin.replace(/^https?:\/\//, ""),
    autoStartOn: autoStart,
  };
}

export type DshHostErrorKind = "transport" | "missing" | "generic";

export function classifyDshHostError(error: string | null | undefined): DshHostErrorKind | null {
  if (!error?.trim()) {
    return null;
  }
  const lower = error.toLowerCase();
  if (lower.includes("not installed") || lower.includes("未安装")) {
    return "missing";
  }
  if (
    lower.includes("host.describe") ||
    lower.includes("error sending request") ||
    lower.includes("connection refused") ||
    lower.includes("timed out") ||
    lower.includes("transport")
  ) {
    return "transport";
  }
  return "generic";
}
