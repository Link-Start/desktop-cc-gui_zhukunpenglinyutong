import type { ProjectMapApiEndpoint } from "../../project-map/types";
import type { SearchResult } from "../types";

const HTTP_METHOD_QUERY = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\s+(.+)$/i;

export type WorkspaceApiSearchSource = {
  workspaceId: string;
  workspaceName: string;
  endpoints: ProjectMapApiEndpoint[];
};

function endpointSearchText(endpoint: ProjectMapApiEndpoint): string {
  return [endpoint.protocol, endpoint.method, endpoint.path, endpoint.operationName,
    endpoint.handlerSymbol, endpoint.description, endpoint.framework, endpoint.sourceFile]
    .filter(Boolean).join(" ").toLowerCase();
}

function endpointSourceLine(endpoint: ProjectMapApiEndpoint): number | undefined {
  const evidence = endpoint.evidence.find(
    (item) =>
      item.path === endpoint.sourceFile &&
      Number.isInteger(item.line) &&
      (item.line ?? 0) >= 1,
  );
  return evidence?.line;
}

export function searchApiEndpoints(
  query: string,
  source: WorkspaceApiSearchSource,
): SearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const methodQuery = HTTP_METHOD_QUERY.exec(query.trim());
  return source.endpoints.flatMap((endpoint) => {
    const method = endpoint.method?.toLowerCase() ?? "";
    const path = endpoint.path?.toLowerCase() ?? "";
    let score: number | null = null;
    if (methodQuery) {
      const requestedMethod = methodQuery[1]?.toLowerCase() ?? "";
      const requestedPath = methodQuery[2]?.trim().toLowerCase() ?? "";
      if (method === requestedMethod && path.includes(requestedPath)) {
        score = path === requestedPath ? 0 : 10 + path.indexOf(requestedPath);
      }
    } else if (normalizedQuery.startsWith("/") && path.includes(normalizedQuery)) {
      score = path === normalizedQuery ? 5 : 20 + path.indexOf(normalizedQuery);
    } else {
      const index = endpointSearchText(endpoint).indexOf(normalizedQuery);
      if (index >= 0) score = 100 + index;
    }
    if (score === null) return [];
    const sourceLine = endpointSourceLine(endpoint);
    const title = [endpoint.method ?? endpoint.protocol.toUpperCase(),
      endpoint.path ?? endpoint.operationName].filter(Boolean).join(" ");
    return [{
      id: `api:${source.workspaceId}:${endpoint.id}`,
      kind: "api" as const,
      title: title || endpoint.handlerSymbol || endpoint.id,
      subtitle: endpoint.handlerSymbol ?? endpoint.framework ?? endpoint.protocol,
      score,
      workspaceId: source.workspaceId,
      workspaceName: source.workspaceName,
      filePath: endpoint.sourceFile,
      fileLine: sourceLine,
      fileColumn: sourceLine !== undefined ? 1 : undefined,
      apiEndpointId: endpoint.id,
      sourceKind: "apis" as const,
      locationLabel: sourceLine
        ? `${endpoint.sourceFile}:${sourceLine}`
        : endpoint.sourceFile,
    }];
  });
}
