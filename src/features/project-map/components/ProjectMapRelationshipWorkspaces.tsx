import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

import { cn } from "../../../lib/utils";
import {
  buildProjectMapApiEndpointDetail,
  buildProjectMapApiEndpointRow,
} from "./projectMapRelationshipApiModel";
import {
  getProjectMapRelationshipCallCandidate,
  getProjectMapRelationshipRoleColor,
  type ProjectMapRelationshipDashboardData,
} from "../utils/relationshipDashboardModel";
import {
  buildProjectMapApiExportFile,
  type ProjectMapApiExportFormat,
} from "../utils/apiContractExport";
import type {
  ProjectMapApiCallChain,
  ProjectMapApiEndpoint,
  ProjectMapApiGroup,
  ProjectMapFileRelation,
  ProjectMapScannedFile,
} from "../types";

type ProjectMapRelationshipDashboardViewMode = "graph" | "files" | "read" | "api";
type ProjectMapRelationshipLayoutPreset = "radial" | "tree" | "force";

type ProjectMapApiGroupWithCount = ProjectMapApiGroup & {
  endpointCount: number;
};

type ProjectMapApiEndpointSection = {
  id: string;
  title: string;
  hint: string;
  endpoints: ProjectMapApiEndpoint[];
};

type ProjectMapRelationshipFileTreeGroup = {
  id: string;
  label: string;
  files: ProjectMapScannedFile[];
  relationCount: number;
};

type ProjectMapRelationshipFileDirectionCount = {
  incoming: number;
  outgoing: number;
};

type ProjectMapRelationshipRelationGroup = {
  id: string;
  title: string;
  relations: ProjectMapFileRelation[];
};

type ProjectMapRelationshipReadPathLayer = "entry" | "focus" | "dependency" | "verify";

type ProjectMapRelationshipReadPathStep = {
  id: string;
  layer: ProjectMapRelationshipReadPathLayer;
  layerLabel: string;
  title: string;
  reason: string;
  meta: string;
  path: string;
  relationId: string | null;
};

type ProjectMapRelationshipScopeWarning = {
  kind: string;
  path?: string | null;
  message: string;
};

type ProjectMapRelationshipScanStatus = {
  status: "idle" | "running" | "success" | "failed";
};

type ProjectMapApiMethodChainTreeNode = {
  symbol: string;
  incomingEdge?: ProjectMapApiCallChain["edges"][number];
  children: ProjectMapApiMethodChainTreeNode[];
};

const PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT = 80;
const API_LEFT_PANE_DEFAULT_WIDTH = 20;
const API_RIGHT_PANE_DEFAULT_WIDTH = 60;
const API_LEFT_PANE_MIN_WIDTH = 16;
const API_LEFT_PANE_MAX_WIDTH = 30;
const API_RIGHT_PANE_MIN_WIDTH = 34;
const API_RIGHT_PANE_MAX_WIDTH = 68;
const API_METHOD_CHAIN_MAX_TREE_DEPTH = 5;
const API_METHOD_CHAIN_MAX_RENDERED_NODES = 32;
const READ_PATH_MAX_ENTRY_STEPS = 2;
const READ_PATH_MAX_DEPENDENCY_STEPS = 4;
const READ_PATH_MAX_VERIFY_STEPS = 3;

const RELATION_CONFIDENCE_WEIGHT: Record<ProjectMapFileRelation["confidence"], number> = {
  high: 4,
  medium: 3,
  low: 2,
  unknown: 1,
};

function clampApiPaneWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function downloadProjectMapApiExport(file: { filename: string; mimeType: string; content: string }) {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function buildProjectMapApiMethodChainTree(
  chain: ProjectMapApiCallChain,
  rootSymbol: string | null | undefined,
): ProjectMapApiMethodChainTreeNode[] {
  const childrenBySource = new Map<string, ProjectMapApiCallChain["edges"]>();
  const targetSymbols = new Set<string>();
  for (const edge of chain.edges) {
    const children = childrenBySource.get(edge.sourceSymbol) ?? [];
    children.push(edge);
    childrenBySource.set(edge.sourceSymbol, children);
    targetSymbols.add(edge.targetSymbol);
  }
  const roots = rootSymbol
    ? [rootSymbol]
    : Array.from(childrenBySource.keys()).filter((symbol) => !targetSymbols.has(symbol));
  const fallbackRoots = roots.length ? roots : chain.edges[0] ? [chain.edges[0].sourceSymbol] : [];
  let renderedCount = 0;
  const visit = (
    symbol: string,
    incomingEdge: ProjectMapApiCallChain["edges"][number] | undefined,
    depth: number,
    path: Set<string>,
  ): ProjectMapApiMethodChainTreeNode => {
    renderedCount += 1;
    if (
      depth >= API_METHOD_CHAIN_MAX_TREE_DEPTH
      || renderedCount >= API_METHOD_CHAIN_MAX_RENDERED_NODES
      || path.has(symbol)
    ) {
      return { symbol, incomingEdge, children: [] };
    }
    const nextPath = new Set(path);
    nextPath.add(symbol);
    const children = (childrenBySource.get(symbol) ?? [])
      .slice(0, 8)
      .map((edge) => visit(edge.targetSymbol, edge, depth + 1, nextPath));
    return { symbol, incomingEdge, children };
  };
  return fallbackRoots.map((symbol) => visit(symbol, undefined, 0, new Set()));
}

function formatProjectMapReadPathEvidence(relation: ProjectMapFileRelation): string {
  const evidence = relation.evidence[0];
  if (!evidence) {
    return relation.confidence;
  }
  return `${relation.confidence} · ${evidence.path}${evidence.line ? `:${evidence.line}` : ""}`;
}

function getProjectMapReadPathRelationTitle(input: {
  relation: ProjectMapFileRelation;
  sourceFile?: ProjectMapScannedFile;
  targetFile?: ProjectMapScannedFile;
}): string {
  const source = input.sourceFile?.basename ?? input.relation.sourceFileId;
  const target = input.targetFile?.basename ?? input.relation.targetFileId;
  return `${source} -> ${target}`;
}

function getProjectMapReadPathBasename(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] || path;
}

function pushUniqueProjectMapReadPathStep(
  steps: ProjectMapRelationshipReadPathStep[],
  seenStepKeys: Set<string>,
  step: ProjectMapRelationshipReadPathStep,
) {
  const key = `${step.layer}:${step.path}:${step.title}`;
  if (seenStepKeys.has(key)) {
    return;
  }
  seenStepKeys.add(key);
  steps.push(step);
}

type ProjectMapRelationshipApiWorkspaceProps = {
  activeWorkspaceId: string | null;
  apiConfidenceFilter: string;
  apiContractScanExists: boolean;
  apiControllerFilter: string;
  apiControllerGroupsByModuleId: ReadonlyMap<string, ProjectMapApiGroupWithCount[]>;
  apiEndpointCount: number;
  apiEndpointSections: ProjectMapApiEndpointSection[];
  apiFilterOptions: {
    protocols: Set<string>;
    languages: Set<string>;
    frameworks: Set<string>;
    modules: Set<string>;
    controllers: Set<string>;
    confidences: Set<string>;
  };
  apiFrameworkFilter: string;
  apiGraphMode: string;
  apiGroups: ProjectMapApiGroupWithCount[];
  apiLanguageFilter: string;
  apiModuleFilter: string;
  apiModuleGroups: ProjectMapApiGroupWithCount[];
  apiProtocolFilter: string;
  apiSearchQuery: string;
  expandedApiModuleGroupIds: ReadonlySet<string>;
  handleRelationshipScanClick: () => void;
  openProjectMapRelationshipPath: (path: string | null | undefined, line?: number | null) => void;
  relationshipDashboardData: ProjectMapRelationshipDashboardData;
  relationshipDashboardLayoutPreset: ProjectMapRelationshipLayoutPreset;
  relationshipGraphZoom: number;
  relationshipScanState: ProjectMapRelationshipScanStatus;
  selectedApiCallChains: ProjectMapApiCallChain[];
  selectedApiEndpoint: ProjectMapApiEndpoint | null;
  selectedApiGroup: ProjectMapApiGroupWithCount | null;
  selectedApiGroupEndpoints: ProjectMapApiEndpoint[];
  selectedApiModuleGroup: ProjectMapApiGroupWithCount | null;
  setApiConfidenceFilter: (value: string) => void;
  setApiControllerFilter: (value: string) => void;
  setApiFrameworkFilter: (value: string) => void;
  setApiLanguageFilter: (value: string) => void;
  setApiModuleFilter: (value: string) => void;
  setApiProtocolFilter: (value: string) => void;
  setExpandedApiModuleGroupIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedApiEndpointId: (value: string | null) => void;
  setSelectedApiGroupId: (value: string | null) => void;
};

export function ProjectMapRelationshipApiWorkspace({
  activeWorkspaceId,
  apiConfidenceFilter,
  apiContractScanExists,
  apiControllerFilter,
  apiControllerGroupsByModuleId,
  apiEndpointCount,
  apiEndpointSections,
  apiFilterOptions,
  apiFrameworkFilter,
  apiGraphMode,
  apiGroups,
  apiLanguageFilter,
  apiModuleFilter,
  apiModuleGroups,
  apiProtocolFilter,
  apiSearchQuery,
  expandedApiModuleGroupIds,
  handleRelationshipScanClick,
  openProjectMapRelationshipPath,
  relationshipDashboardData,
  relationshipDashboardLayoutPreset,
  relationshipGraphZoom,
  relationshipScanState,
  selectedApiCallChains,
  selectedApiEndpoint,
  selectedApiGroup,
  selectedApiGroupEndpoints,
  selectedApiModuleGroup,
  setApiConfidenceFilter,
  setApiControllerFilter,
  setApiFrameworkFilter,
  setApiLanguageFilter,
  setApiModuleFilter,
  setApiProtocolFilter,
  setExpandedApiModuleGroupIds,
  setSelectedApiEndpointId,
  setSelectedApiGroupId,
}: ProjectMapRelationshipApiWorkspaceProps) {
  const { t } = useTranslation();
  const apiContractWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const [apiLeftPaneWidth, setApiLeftPaneWidth] = useState(API_LEFT_PANE_DEFAULT_WIDTH);
  const [apiRightPaneWidth, setApiRightPaneWidth] = useState<number | null>(null);
  const [apiInspectorFocused, setApiInspectorFocused] = useState(false);
  const apiPaneResizeCleanupRef = useRef<(() => void) | null>(null);
  const selectedApiEndpointDetail = useMemo(
    () => selectedApiEndpoint ? buildProjectMapApiEndpointDetail(selectedApiEndpoint) : null,
    [selectedApiEndpoint],
  );
  const selectedApiMethodChainTrees = useMemo(() => (
    selectedApiCallChains.map((chain) => ({
      chain,
      roots: buildProjectMapApiMethodChainTree(chain, selectedApiEndpoint?.handlerSymbol),
    }))
  ), [selectedApiCallChains, selectedApiEndpoint?.handlerSymbol]);
  useEffect(() => {
    return () => {
      apiPaneResizeCleanupRef.current?.();
      apiPaneResizeCleanupRef.current = null;
    };
  }, []);
  useEffect(() => {
    setApiInspectorFocused(false);
  }, [selectedApiEndpoint?.id, selectedApiGroup?.id]);
  const apiPaneStyle = {
    "--relationship-graph-scale": relationshipGraphZoom,
    "--api-left-pane-width": `${apiLeftPaneWidth}%`,
    ...(apiRightPaneWidth === null ? {} : { "--api-right-pane-width": `${apiRightPaneWidth}%` }),
  } as CSSProperties;
  const beginApiPaneResize = useCallback((
    pane: "left" | "right",
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const workspaceRect = apiContractWorkspaceRef.current?.getBoundingClientRect();
    const workspaceWidth = workspaceRect?.width ?? 0;
    if (!workspaceWidth || !Number.isFinite(workspaceWidth)) {
      return;
    }
    apiPaneResizeCleanupRef.current?.();
    apiPaneResizeCleanupRef.current = null;
    const startX = event.clientX;
    const startLeftWidth = apiLeftPaneWidth;
    const startRightWidth = apiRightPaneWidth ?? API_RIGHT_PANE_DEFAULT_WIDTH;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const deltaPercent = delta / workspaceWidth * 100;
      if (pane === "left") {
        setApiLeftPaneWidth(clampApiPaneWidth(
          startLeftWidth + deltaPercent,
          API_LEFT_PANE_MIN_WIDTH,
          API_LEFT_PANE_MAX_WIDTH,
        ));
        return;
      }
      setApiRightPaneWidth(clampApiPaneWidth(
        startRightWidth - deltaPercent,
        API_RIGHT_PANE_MIN_WIDTH,
        API_RIGHT_PANE_MAX_WIDTH,
      ));
    };
    const cleanupResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      apiPaneResizeCleanupRef.current = null;
    };
    const handlePointerUp = () => {
      cleanupResize();
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    apiPaneResizeCleanupRef.current = cleanupResize;
  }, [apiLeftPaneWidth, apiRightPaneWidth]);
  const handleApiExport = useCallback((format: ProjectMapApiExportFormat) => {
    if (!relationshipDashboardData.apiContracts) {
      return;
    }
    downloadProjectMapApiExport(buildProjectMapApiExportFile(relationshipDashboardData.apiContracts, format));
  }, [relationshipDashboardData.apiContracts]);
  const openApiInspectorPath = useCallback((path: string | null | undefined, line?: number | null) => {
    setApiInspectorFocused(true);
    openProjectMapRelationshipPath(path, line);
  }, [openProjectMapRelationshipPath]);
  const renderApiMethodChainNode = (
    node: ProjectMapApiMethodChainTreeNode,
    depth: number,
  ): ReactElement => {
    const edge = node.incomingEdge;
    const edgeLocationLabel = edge ? `${edge.sourceFile}${edge.line ? `:${edge.line}` : ""}` : null;
    const edgeTargetLocationLabel = edge?.targetFile
      ? `${edge.targetFile}${edge.targetLine ? `:${edge.targetLine}` : ""}`
      : null;
    return (
      <li
        key={`${node.symbol}:${edge?.id ?? "root"}`}
        className={cn(
          "project-map-api-method-tree-node",
          depth === 0 && "is-root",
          edge && !edge.targetFile && "is-unresolved",
        )}
      >
        <div className="project-map-api-method-tree-card">
          <div className="project-map-api-method-tree-card-main">
            <strong>{node.symbol}</strong>
            {edge ? (
              <span>{edge.kind} · {edge.confidence}</span>
            ) : (
              <span>{selectedApiEndpoint?.method ?? selectedApiEndpoint?.protocol ?? "endpoint"}</span>
            )}
          </div>
          {edge ? (
            <div className="project-map-api-method-tree-anchors">
              {edgeLocationLabel ? (
                <button
                  type="button"
                  onClick={() => openApiInspectorPath(edge.sourceFile, edge.line)}
                  aria-label={edge.line
                    ? t("projectMap.relationship.sourceOpenFileAtLine", {
                        path: edge.sourceFile,
                        line: edge.line,
                      })
                    : t("projectMap.relationship.sourceOpenFile", {
                        path: edge.sourceFile,
                      })}
                >
                  call · {edgeLocationLabel}
                </button>
              ) : null}
              {edgeTargetLocationLabel && edge.targetFile ? (
                <button
                  type="button"
                  className="is-target"
                  onClick={() => openApiInspectorPath(edge.targetFile, edge.targetLine)}
                  aria-label={edge.targetLine
                    ? t("projectMap.relationship.sourceOpenFileAtLine", {
                        path: edge.targetFile,
                        line: edge.targetLine,
                      })
                    : t("projectMap.relationship.sourceOpenFile", {
                        path: edge.targetFile,
                      })}
                >
                  def · {edgeTargetLocationLabel}
                </button>
              ) : null}
            </div>
          ) : null}
          {edge?.excerpt ? (
            <button
              type="button"
              className="project-map-api-method-tree-excerpt"
              onClick={() => openApiInspectorPath(edge.sourceFile, edge.line)}
              aria-label={edge.line
                ? t("projectMap.relationship.sourceOpenFileAtLine", {
                    path: edge.sourceFile,
                    line: edge.line,
                  })
                : t("projectMap.relationship.sourceOpenFile", {
                    path: edge.sourceFile,
                  })}
            >
              <code>{edge.excerpt}</code>
            </button>
          ) : null}
        </div>
        {node.children.length ? (
          <ol>
            {node.children.map((child) => renderApiMethodChainNode(child, depth + 1))}
          </ol>
        ) : null}
      </li>
    );
  };
  const primaryApiFilters = [
    {
      label: t("projectMap.relationship.apiFilterModule"),
      value: apiModuleFilter,
      onChange: setApiModuleFilter,
      options: Array.from(apiFilterOptions.modules),
    },
    {
      label: t("projectMap.relationship.apiFilterController"),
      value: apiControllerFilter,
      onChange: setApiControllerFilter,
      options: Array.from(apiFilterOptions.controllers),
    },
    {
      label: t("projectMap.relationship.apiFilterConfidence"),
      value: apiConfidenceFilter,
      onChange: setApiConfidenceFilter,
      options: Array.from(apiFilterOptions.confidences),
    },
  ];
  const advancedApiFilters = [
    {
      label: t("projectMap.relationship.apiFilterProtocol"),
      value: apiProtocolFilter,
      onChange: setApiProtocolFilter,
      options: Array.from(apiFilterOptions.protocols),
    },
    {
      label: t("projectMap.relationship.apiFilterLanguage"),
      value: apiLanguageFilter,
      onChange: setApiLanguageFilter,
      options: Array.from(apiFilterOptions.languages),
    },
    {
      label: t("projectMap.relationship.apiFilterFramework"),
      value: apiFrameworkFilter,
      onChange: setApiFrameworkFilter,
      options: Array.from(apiFilterOptions.frameworks),
    },
  ];

  return (
    <div
      ref={apiContractWorkspaceRef}
      className={cn(
        "project-map-api-contract-workspace",
        `is-layout-${relationshipDashboardLayoutPreset}`,
        apiInspectorFocused && "is-inspector-focused",
      )}
      style={apiPaneStyle}
    >
      <header className="project-map-relationship-workspace-header project-map-api-contract-toolbar">
        <div className="project-map-api-contract-toolbar-copy">
          <strong>{t("projectMap.relationship.apiWorkspaceTitle")}</strong>
          <span>{t("projectMap.relationship.apiWorkspaceSummary", {
            endpoints: apiEndpointCount,
            groups: apiGroups.length,
            mode: t(`projectMap.relationship.apiGraphMode.${apiGraphMode}`),
          })}</span>
        </div>
        <div className="project-map-api-contract-toolbar-controls">
          <div className="project-map-api-contract-filters">
            <span className="project-map-api-contract-filter-group-label">
              {t("projectMap.relationship.apiPrimaryFilters")}
            </span>
            {primaryApiFilters.map((filter) => (
              <label key={filter.label}>
                <span>{filter.label}</span>
                <select
                  value={filter.value}
                  onChange={(event) => {
                    filter.onChange(event.target.value);
                    setSelectedApiEndpointId(null);
                  }}
                >
                  <option value="all">{t("projectMap.relationship.apiFilterAll")}</option>
                  {filter.options.sort().map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            ))}
            <details className="project-map-api-contract-advanced-filters">
              <summary>{t("projectMap.relationship.apiAdvancedFilters")}</summary>
              <div>
                <div className="project-map-api-contract-export-actions" aria-label={t("projectMap.relationship.apiExportLabel")}>
                  <button
                    type="button"
                    className="project-map-toolbar-action project-map-api-contract-scan-action"
                    onClick={handleRelationshipScanClick}
                    disabled={!activeWorkspaceId || relationshipScanState.status === "running"}
                  >
                    <RefreshCw aria-hidden />
                    {relationshipScanState.status === "running"
                      ? t("projectMap.relationship.scanning")
                      : t("projectMap.relationship.apiScan")}
                  </button>
                  {([
                    ["markdown", t("projectMap.relationship.apiExportMarkdown")],
                    ["html", t("projectMap.relationship.apiExportHtml")],
                    ["openapi-json", t("projectMap.relationship.apiExportOpenApiJson")],
                  ] as const).map(([format, label]) => (
                    <button
                      key={format}
                      type="button"
                      className="project-map-toolbar-action project-map-api-contract-export-action"
                      disabled={!relationshipDashboardData.apiContracts || !apiEndpointCount}
                      onClick={() => handleApiExport(format)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {advancedApiFilters.map((filter) => (
                  <label key={filter.label}>
                    <span>{filter.label}</span>
                    <select
                      value={filter.value}
                      onChange={(event) => {
                        filter.onChange(event.target.value);
                        setSelectedApiEndpointId(null);
                      }}
                    >
                      <option value="all">{t("projectMap.relationship.apiFilterAll")}</option>
                      {filter.options.sort().map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </details>
          </div>
        </div>
        <small className="project-map-api-contract-export-caveat">
          {t("projectMap.relationship.apiExportCaveat")}
        </small>
      </header>
      {relationshipDashboardData.apiContracts && apiEndpointCount > 0 ? (
        <div className="project-map-api-contract-grid">
          <section className="project-map-api-contract-group-rail">
            <header>
              <strong>{t("projectMap.relationship.apiModulesTitle")}</strong>
              <span>{t("projectMap.relationship.apiModulesHint")}</span>
            </header>
            <div className="project-map-api-contract-module-tree">
              {apiModuleGroups.slice(0, 42).map((moduleGroup) => (
                <section
                  key={moduleGroup.id}
                  className={cn(
                    "project-map-api-contract-module-branch",
                    selectedApiModuleGroup?.id === moduleGroup.id && "is-active",
                  )}
                >
                  <button
                    type="button"
                    className="project-map-api-contract-module-button"
                    aria-expanded={expandedApiModuleGroupIds.has(moduleGroup.id)}
                    onClick={() => {
                      setSelectedApiGroupId(moduleGroup.id);
                      setSelectedApiEndpointId(null);
                      setExpandedApiModuleGroupIds((current) => {
                        const next = new Set(current);
                        if (next.has(moduleGroup.id)) {
                          next.delete(moduleGroup.id);
                        } else {
                          next.add(moduleGroup.id);
                        }
                        return next;
                      });
                    }}
                  >
                    <b aria-hidden>
                      {expandedApiModuleGroupIds.has(moduleGroup.id) ? "−" : "+"}
                    </b>
                    <span>{moduleGroup.level}</span>
                    <strong>{moduleGroup.label}</strong>
                    <em>{t("projectMap.relationship.apiGroupStats", {
                      endpoints: moduleGroup.endpointCount,
                      children: moduleGroup.childGroupIds.length,
                    })}</em>
                  </button>
                  {expandedApiModuleGroupIds.has(moduleGroup.id) ? (
                    <div className="project-map-api-contract-controller-list">
                      {(apiControllerGroupsByModuleId.get(moduleGroup.id) ?? []).slice(0, 32).map((controllerGroup) => (
                        <button
                          key={controllerGroup.id}
                          type="button"
                          className={cn(selectedApiGroup?.id === controllerGroup.id && "is-active")}
                          onClick={() => {
                            setSelectedApiGroupId(controllerGroup.id);
                            setSelectedApiEndpointId(null);
                          }}
                        >
                          <span>{controllerGroup.level}</span>
                          <strong>{controllerGroup.label}</strong>
                          <em>{t("projectMap.relationship.apiGroupStats", {
                            endpoints: controllerGroup.endpointCount,
                            children: controllerGroup.childGroupIds.length,
                          })}</em>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          </section>
          <div
            className="project-map-api-contract-resizer"
            role="separator"
            aria-label={t("projectMap.relationship.apiResizeLeft")}
            onPointerDown={(event) => beginApiPaneResize("left", event)}
          />
          <section className="project-map-api-contract-stage">
            <div className="project-map-api-contract-breadcrumb">
              <span>{t("projectMap.relationship.apiBreadcrumbRoot")}</span>
              {selectedApiModuleGroup ? <strong>{selectedApiModuleGroup.label}</strong> : null}
              {selectedApiGroup && selectedApiGroup.id !== selectedApiModuleGroup?.id
                ? <strong>{selectedApiGroup.label}</strong>
                : null}
            </div>
            <div className="project-map-api-contract-stage-summary">
              <strong>
                {selectedApiGroup?.label
                  ?? selectedApiModuleGroup?.label
                  ?? t("projectMap.relationship.apiBreadcrumbRoot")}
              </strong>
              <span>{t("projectMap.relationship.apiStageEndpointSummary", {
                endpoints: selectedApiGroupEndpoints.length,
                sections: apiEndpointSections.length,
              })}</span>
            </div>
            {apiEndpointSections.length ? (
              <div className="project-map-api-contract-node-layer is-endpoints">
                {apiEndpointSections.slice(0, 8).map((section) => (
                  <section key={section.id} className="project-map-api-contract-endpoint-section">
                    <header>
                      <strong>{section.title}</strong>
                      <span>{section.hint}</span>
                    </header>
                    <div className="project-map-api-contract-endpoint-grid">
                      {section.endpoints.slice(0, 36).map((endpoint) => {
                        const endpointRow = buildProjectMapApiEndpointRow(endpoint);
                        return (
                          <button
                            key={`endpoint:${endpoint.id}`}
                            type="button"
                            className={cn(
                              "project-map-api-contract-endpoint-node",
                              selectedApiEndpoint?.id === endpoint.id && "is-active",
                            )}
                            onClick={() => setSelectedApiEndpointId(endpoint.id)}
                          >
                            <span>{endpointRow.methodLabel}</span>
                            <strong>{endpointRow.pathLabel}</strong>
                            <em>{endpointRow.summary ?? endpointRow.handlerLabel ?? endpoint.sourceFile}</em>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <p className="project-map-api-contract-stage-empty">
                {apiSearchQuery
                  ? t("projectMap.relationship.apiSearchEmpty")
                  : t("projectMap.relationship.apiNoEndpointsInGroup")}
              </p>
            )}
          </section>
          <div
            className="project-map-api-contract-resizer"
            role="separator"
            aria-label={t("projectMap.relationship.apiResizeRight")}
            onPointerDown={(event) => beginApiPaneResize("right", event)}
          />
          <aside className="project-map-api-contract-inspector">
            <header>
              <div>
                <span>{t("projectMap.relationship.apiInspectorTitle")}</span>
                <button
                  type="button"
                  className="project-map-api-contract-inspector-focus-toggle"
                  onClick={() => setApiInspectorFocused((current) => !current)}
                >
                  {apiInspectorFocused
                    ? t("projectMap.relationship.apiInspectorExitFocus")
                    : t("projectMap.relationship.apiInspectorFocus")}
                </button>
              </div>
              {selectedApiEndpoint ? null : (
                <strong>{selectedApiGroup?.label ?? t("projectMap.relationship.apiInspectorEmpty")}</strong>
              )}
            </header>
            {selectedApiEndpoint && selectedApiEndpointDetail ? (
              <>
                <article className="project-map-api-contract-swagger-card">
                  <div className="project-map-api-contract-operation-line">
                    <span>{selectedApiEndpointDetail.invocation.httpMethod}</span>
                    <strong>{selectedApiEndpointDetail.invocation.url}</strong>
                  </div>
                  <p>{selectedApiEndpointDetail.overview.description ?? t("projectMap.relationship.apiDescriptionUnavailable")}</p>
                  <div className="project-map-api-contract-endpoint-meta">
                    <span>{selectedApiEndpoint.protocol}</span>
                    <span>{selectedApiEndpoint.confidence}</span>
                    <span>{selectedApiEndpoint.language}</span>
                    {selectedApiEndpoint.framework ? <span>{selectedApiEndpoint.framework}</span> : null}
                    <em>
                      {t("projectMap.relationship.apiTrustEvidenceSummary", {
                        count: selectedApiEndpoint.evidence.length,
                        sources: Array.from(new Set(selectedApiEndpoint.evidence.map((entry) => entry.parserSource))).join(", ")
                          || t("projectMap.relationship.apiTrustEvidenceUnavailable"),
                      })}
                    </em>
                  </div>
                </article>
                <section className="project-map-api-contract-inspector-section project-map-api-contract-overview-section">
                  <h5>{t("projectMap.relationship.apiOverviewTitle")}</h5>
                  <dl className="project-map-api-contract-detail-list project-map-api-contract-overview-list project-map-api-contract-invocation-list">
                    <div>
                      <dt>{t("projectMap.relationship.apiOverviewName")}</dt>
                      <dd>{selectedApiEndpointDetail.overview.interfaceName}</dd>
                    </div>
                    <div>
                      <dt>{t("projectMap.relationship.apiOverviewMethodName")}</dt>
                      <dd>{selectedApiEndpointDetail.overview.methodName}</dd>
                    </div>
                    <div>
                      <dt>{t("projectMap.relationship.apiOverviewChineseComment")}</dt>
                      <dd>{selectedApiEndpointDetail.overview.chineseComment ?? t("projectMap.relationship.apiDescriptionUnavailable")}</dd>
                    </div>
                    <div>
                      <dt>{t("projectMap.relationship.apiOverviewScenario")}</dt>
                      <dd>{selectedApiEndpointDetail.overview.scenario ?? t("projectMap.relationship.apiDeclaredUnavailable")}</dd>
                    </div>
                    <div>
                      <dt>{t("projectMap.relationship.apiOverviewVersion")}</dt>
                      <dd>{selectedApiEndpointDetail.overview.version ?? t("projectMap.relationship.apiDeclaredUnavailable")}</dd>
                    </div>
                  </dl>
                </section>
                <section className="project-map-api-contract-inspector-section project-map-api-contract-overview-section">
                  <h5>{t("projectMap.relationship.apiInvocationTitle")}</h5>
                  <dl className="project-map-api-contract-detail-list project-map-api-contract-overview-list">
                    <div>
                      <dt>{t("projectMap.relationship.apiInvocationMethod")}</dt>
                      <dd>{selectedApiEndpointDetail.invocation.httpMethod}</dd>
                    </div>
                    <div>
                      <dt>{t("projectMap.relationship.apiInvocationUrl")}</dt>
                      <dd>{selectedApiEndpointDetail.invocation.url}</dd>
                    </div>
                    <div>
                      <dt>{t("projectMap.relationship.apiInvocationContentType")}</dt>
                      <dd>{selectedApiEndpointDetail.invocation.contentType}</dd>
                    </div>
                    <div>
                      <dt>{t("projectMap.relationship.apiInvocationHeaders")}</dt>
                      <dd>
                        {selectedApiEndpointDetail.invocation.headers.length
                          ? selectedApiEndpointDetail.invocation.headers.map((header) => header.name).join(", ")
                          : t("projectMap.relationship.apiNoHeaders")}
                      </dd>
                    </div>
                  </dl>
                  {selectedApiEndpointDetail.invocation.requestExample ? (
                    <code className="project-map-api-contract-example">
                      {selectedApiEndpointDetail.invocation.requestExample}
                    </code>
                  ) : null}
                </section>
                <section className="project-map-api-contract-inspector-section">
                  <h5>{t("projectMap.relationship.apiEndpointParams")}</h5>
                  {selectedApiEndpointDetail.inputParameters.length ? (
                    <div className="project-map-api-contract-parameter-list">
                      {selectedApiEndpointDetail.inputParameters.map((parameter) => (
                        <article key={`${parameter.location}:${parameter.name}`} className="project-map-api-contract-parameter-card">
                          <div>
                            <span>{parameter.location}</span>
                            <strong>{parameter.name}</strong>
                            <em>{parameter.type}{parameter.required ? " · required" : ""}</em>
                          </div>
                          {parameter.description ? <p>{parameter.description}</p> : null}
                          {parameter.defaultValue || parameter.example ? (
                            <small>
                              {parameter.defaultValue ? `default: ${parameter.defaultValue}` : ""}
                              {parameter.defaultValue && parameter.example ? " · " : ""}
                              {parameter.example ? `example: ${parameter.example}` : ""}
                            </small>
                          ) : null}
                          {parameter.fields.length ? (
                            <div className="project-map-api-contract-field-table">
                              <span>{t("projectMap.relationship.apiParamColumnName")}</span>
                              <span>{t("projectMap.relationship.apiParamColumnSchema")}</span>
                              <span>{t("projectMap.relationship.apiParamColumnRequired")}</span>
                              <span>{t("projectMap.relationship.apiParamColumnDescription")}</span>
                              {parameter.fields.slice(0, 24).flatMap((field) => [
                                <strong key={`${parameter.name}:${field.path}:name`} style={{ paddingLeft: `${6 + field.depth * 12}px` }}>
                                  {field.path}
                                </strong>,
                                <em key={`${parameter.name}:${field.path}:type`}>{field.type ?? "-"}</em>,
                                <em key={`${parameter.name}:${field.path}:required`}>{field.required ? "true" : "false"}</em>,
                                <em key={`${parameter.name}:${field.path}:description`}>
                                  {field.description ?? field.defaultValue ?? field.example ?? "-"}
                                </em>,
                              ])}
                            </div>
                          ) : (
                            <p>{t("projectMap.relationship.apiParamFieldsUnavailable")}</p>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>{t("projectMap.relationship.apiNoParameters")}</p>
                  )}
                </section>
                <section className="project-map-api-contract-inspector-section">
                  <h5>{t("projectMap.relationship.apiEndpointResponses")}</h5>
                  {selectedApiEndpointDetail.responses.length ? (
                    <div className="project-map-api-contract-response-list">
                      {selectedApiEndpointDetail.responses.map((response, responseIndex) => (
                        <article key={`${response.statusCode}:${response.rawType}:${responseIndex}`}>
                          <div className="project-map-api-contract-response-head">
                            <strong>{response.statusCode}</strong>
                            <span>{response.contentType}</span>
                          </div>
                          <em className="project-map-api-contract-response-schema">
                            {response.rawType}
                            {response.businessType !== response.rawType ? ` · data: ${response.businessType}` : ""}
                            {response.description ? ` · ${response.description}` : ""}
                          </em>
                          {response.fields.length ? (
                            <div className="project-map-api-contract-response-fields">
                              {response.fields.slice(0, 16).map((field, fieldIndex) => (
                                <div key={`${response.statusCode}:${field.path}:${fieldIndex}`}>
                                  <code>{field.path}</code>
                                  {field.type ? <span>{field.type}</span> : null}
                                  {field.description ? <p>{field.description}</p> : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>{t("projectMap.relationship.apiNoResponses")}</p>
                  )}
                </section>
                <section className="project-map-api-contract-inspector-section">
                  <h5>{t("projectMap.relationship.apiErrorCodesTitle")}</h5>
                  {selectedApiEndpointDetail.responses.some((response) => response.isError) ? (
                    <div className="project-map-api-contract-response-list">
                      {selectedApiEndpointDetail.responses.filter((response) => response.isError).map((response, responseIndex) => (
                        <article key={`error:${response.statusCode}:${responseIndex}`}>
                          <strong>{response.statusCode}</strong>
                          <span>{response.description ?? t("projectMap.relationship.apiDeclaredUnavailable")}</span>
                          <em>{t("projectMap.relationship.apiErrorHandlingHint")}</em>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>{t("projectMap.relationship.apiNoErrorCodes")}</p>
                  )}
                </section>
                <section className="project-map-api-contract-inspector-section">
                  <h5>{t("projectMap.relationship.apiEndpointDescription")}</h5>
                  {selectedApiEndpointDetail.descriptionBlocks.length ? (
                    selectedApiEndpointDetail.descriptionBlocks.map((block) => (
                      <p key={`${block.kind}:${block.text}`}>{block.kind} · {block.text}</p>
                    ))
                  ) : (
                    <p>{t("projectMap.relationship.apiDescriptionUnavailable")}</p>
                  )}
                </section>
                <section className="project-map-api-contract-evidence">
                  <h5>{t("projectMap.relationship.apiEvidenceTitle")}</h5>
                  {selectedApiEndpoint.evidence.slice(0, 4).map((evidence) => (
                    <button
                      key={`${evidence.path}:${evidence.line ?? 0}:${evidence.parserSource}`}
                      type="button"
                      onClick={() => openApiInspectorPath(evidence.path, evidence.line)}
                    >
                      <span>{evidence.parserSource}{evidence.redacted ? " · redacted" : ""}</span>
                      <strong>{evidence.path}{evidence.line ? `:${evidence.line}` : ""}</strong>
                      {evidence.excerpt ? <em>{evidence.excerpt}</em> : null}
                    </button>
                  ))}
                  {!selectedApiEndpoint.evidence.length ? (
                    <p>{t("projectMap.relationship.apiEvidenceEmpty")}</p>
                  ) : null}
                </section>
                <section className="project-map-api-contract-inspector-section">
                  <h5>{t("projectMap.relationship.apiMethodChainTitle")}</h5>
                  {selectedApiCallChains.length ? (
                    <div className="project-map-api-contract-method-chain-list">
                      {selectedApiMethodChainTrees.map(({ chain, roots }) => (
                        <article key={chain.id} className="project-map-api-method-tree">
                          {chain.truncatedReason ? (
                            <span className="project-map-api-contract-method-chain-warning">
                              {t("projectMap.relationship.apiMethodChainTruncated", {
                                reason: chain.truncatedReason,
                              })}
                            </span>
                          ) : null}
                          <ol className="project-map-api-method-tree-roots">
                            {roots.map((root) => renderApiMethodChainNode(root, 0))}
                          </ol>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>
                      {selectedApiEndpoint.callChainUnavailableReason
                        ? t("projectMap.relationship.apiMethodChainUnavailable", {
                            reason: selectedApiEndpoint.callChainUnavailableReason,
                          })
                        : t("projectMap.relationship.apiMethodChainEmpty")}
                    </p>
                  )}
                </section>
              </>
            ) : selectedApiGroup ? (
              <div className="project-map-api-contract-group-summary">
                <span>{selectedApiGroup.level}</span>
                <strong>{selectedApiGroup.label}</strong>
                <p>{t("projectMap.relationship.apiGroupInspectorSummary", {
                  endpoints: selectedApiGroup.endpointCount,
                  children: selectedApiGroup.childGroupIds.length,
                })}</p>
                <div className="project-map-api-contract-distribution">
                  <h5>{t("projectMap.relationship.apiDistributionProtocol")}</h5>
                  <div className="project-map-api-contract-chip-list">
                    {Object.entries(selectedApiGroup.protocolCounts ?? {}).map(([key, value]) => (
                      <span key={`protocol:${key}`}>{key} · {value}</span>
                    ))}
                  </div>
                  <h5>{t("projectMap.relationship.apiDistributionLanguage")}</h5>
                  <div className="project-map-api-contract-chip-list">
                    {Object.entries(selectedApiGroup.languageCounts ?? {}).map(([key, value]) => (
                      <span key={`language:${key}`}>{key} · {value}</span>
                    ))}
                  </div>
                  <h5>{t("projectMap.relationship.apiDistributionConfidence")}</h5>
                  <div className="project-map-api-contract-chip-list">
                    {Object.entries(selectedApiGroup.confidenceCounts ?? {}).map(([key, value]) => (
                      <span key={`confidence:${key}`}>{key} · {value}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : (
        <div className="project-map-api-contract-empty">
          <strong>
            {apiContractScanExists
              ? t("projectMap.relationship.apiEmptyScannedTitle")
              : t("projectMap.relationship.apiEmptyTitle")}
          </strong>
          <p>
            {apiContractScanExists
              ? t("projectMap.relationship.apiEmptyScannedBody")
              : t("projectMap.relationship.apiEmptyBody")}
          </p>
          <small>
            {apiContractScanExists
              ? t("projectMap.relationship.apiEmptyScannedHint")
              : t("projectMap.relationship.apiEmptyHint")}
          </small>
        </div>
      )}
    </div>
  );
}

type ProjectMapRelationshipFileWorkspaceProps = {
  expandedRelationshipFileGroups: ReadonlySet<string>;
  relationshipDashboardDirectionCountByFile: ReadonlyMap<string, ProjectMapRelationshipFileDirectionCount>;
  relationshipDashboardExplorerRenderedFileCount: number;
  relationshipDashboardFileTreeGroups: ProjectMapRelationshipFileTreeGroup[];
  relationshipDashboardFilteredFiles: ProjectMapScannedFile[];
  relationshipDashboardLayoutPreset: ProjectMapRelationshipLayoutPreset;
  relationshipDashboardScannedFileCount: number;
  relationshipDashboardVisibleFileTotal: number;
  relationshipFilesZoom: number;
  selectedRelationshipFile: ProjectMapScannedFile | null;
  setInspectedRelationshipFileId: (value: string | null) => void;
  setRelationshipDashboardViewMode: (value: ProjectMapRelationshipDashboardViewMode) => void;
  setSelectedRelationshipFileId: (value: string | null) => void;
  setSelectedRelationshipRelationId: (value: string | null) => void;
  toggleRelationshipFileTreeGroup: (groupId: string) => void;
};

export function ProjectMapRelationshipFileWorkspace({
  expandedRelationshipFileGroups,
  relationshipDashboardDirectionCountByFile,
  relationshipDashboardExplorerRenderedFileCount,
  relationshipDashboardFileTreeGroups,
  relationshipDashboardFilteredFiles,
  relationshipDashboardLayoutPreset,
  relationshipDashboardScannedFileCount,
  relationshipDashboardVisibleFileTotal,
  relationshipFilesZoom,
  selectedRelationshipFile,
  setInspectedRelationshipFileId,
  setRelationshipDashboardViewMode,
  setSelectedRelationshipFileId,
  setSelectedRelationshipRelationId,
  toggleRelationshipFileTreeGroup,
}: ProjectMapRelationshipFileWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <div className="project-map-relationship-file-workspace">
      <header className="project-map-relationship-workspace-header">
        <div>
          <strong>{t("projectMap.relationship.filesWorkspaceTitle")}</strong>
          <span>{t("projectMap.relationship.filesWorkspaceSummary", {
            rendered: relationshipDashboardExplorerRenderedFileCount,
            matching: relationshipDashboardVisibleFileTotal,
            scanned: relationshipDashboardScannedFileCount,
          })}</span>
        </div>
        <button
          type="button"
          className="project-map-toolbar-action"
          onClick={() => setRelationshipDashboardViewMode("graph")}
        >
          {t("projectMap.relationship.openGraph")}
        </button>
      </header>
      <div
        className={cn(
          "project-map-relationship-file-tree",
          `is-layout-${relationshipDashboardLayoutPreset}`,
        )}
        style={{ "--relationship-files-scale": relationshipFilesZoom } as CSSProperties}
      >
        <div className="project-map-relationship-file-tree-zoom">
          {relationshipDashboardFileTreeGroups.length ? (
            relationshipDashboardFileTreeGroups.map((group) => (
              <section key={group.id} className="project-map-relationship-file-tree-group">
                <header>
                  <strong>{group.label}</strong>
                  <span>{t("projectMap.relationship.filesTreeGroupStats", {
                    rendered: expandedRelationshipFileGroups.has(group.id)
                      ? group.files.length
                      : Math.min(group.files.length, PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT),
                    files: group.files.length,
                    relations: group.relationCount,
                  })}</span>
                </header>
                <div className="project-map-relationship-file-tree-list">
                  {(expandedRelationshipFileGroups.has(group.id)
                    ? group.files
                    : group.files.slice(0, PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT)
                  ).map((file) => {
                    const directionCount =
                      relationshipDashboardDirectionCountByFile.get(file.id)
                      ?? { incoming: 0, outgoing: 0 };
                    return (
                      <button
                        key={file.id}
                        type="button"
                        className={cn(
                          "project-map-relationship-file-tree-row",
                          selectedRelationshipFile?.id === file.id && "is-active",
                        )}
                        title={file.path}
                        onClick={() => {
                          setSelectedRelationshipFileId(file.id);
                          setInspectedRelationshipFileId(file.id);
                          setSelectedRelationshipRelationId(null);
                          setRelationshipDashboardViewMode("graph");
                        }}
                      >
                        <span
                          style={{
                            "--relationship-node-color": getProjectMapRelationshipRoleColor(file.role),
                          } as CSSProperties}
                        />
                        <div>
                          <strong>{file.basename}</strong>
                          <em>{file.path}</em>
                        </div>
                        <small>
                          {t("projectMap.relationship.graphFileLanguageDirectionSummary", {
                            role: file.role,
                            language: file.language,
                            incoming: directionCount.incoming,
                            outgoing: directionCount.outgoing,
                          })}
                        </small>
                      </button>
                    );
                  })}
                  {group.files.length > PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT ? (
                    <button
                      type="button"
                      className="project-map-relationship-file-tree-row"
                      onClick={() => toggleRelationshipFileTreeGroup(group.id)}
                    >
                      <strong>
                        {expandedRelationshipFileGroups.has(group.id)
                          ? t("projectMap.relationship.filesTreeGroupCollapse")
                          : t("projectMap.relationship.filesTreeGroupMore", {
                              count: group.files.length - PROJECT_MAP_RELATIONSHIP_EXPLORER_GROUP_LIMIT,
                            })}
                      </strong>
                      <em>{t("projectMap.relationship.filesTreeGroupSearchHint")}</em>
                    </button>
                  ) : null}
                </div>
              </section>
            ))
          ) : (
            <p className="project-map-relationship-empty">
              {t("projectMap.relationship.noFiles")}
            </p>
          )}
        </div>
      </div>
      {relationshipDashboardVisibleFileTotal > relationshipDashboardFilteredFiles.length ? (
        <p className="project-map-relationship-list-cap">
          {t("projectMap.relationship.listCap", {
            visible: relationshipDashboardFilteredFiles.length,
            total: relationshipDashboardVisibleFileTotal,
          })}
        </p>
      ) : null}
    </div>
  );
}

type ProjectMapRelationshipReadWorkspaceProps = {
  inspectedRelationshipFile: ProjectMapScannedFile | null;
  relationshipDashboardData: ProjectMapRelationshipDashboardData;
  relationshipDashboardFileIndex: ReadonlyMap<string, ProjectMapScannedFile>;
  relationshipDashboardModuleByFileId: ReadonlyMap<string, string>;
  selectedRelationshipRelation: ProjectMapFileRelation | null;
  selectedRelationshipRelationGroups: ProjectMapRelationshipRelationGroup[];
  selectedRelationshipScopeWarnings: ProjectMapRelationshipScopeWarning[];
  setRelationshipDashboardViewMode: (value: ProjectMapRelationshipDashboardViewMode) => void;
  setSelectedRelationshipRelationId: (value: string | null) => void;
};

export function ProjectMapRelationshipReadWorkspace({
  inspectedRelationshipFile,
  relationshipDashboardData,
  relationshipDashboardFileIndex,
  relationshipDashboardModuleByFileId,
  selectedRelationshipRelation,
  selectedRelationshipRelationGroups,
  selectedRelationshipScopeWarnings,
  setRelationshipDashboardViewMode,
  setSelectedRelationshipRelationId,
}: ProjectMapRelationshipReadWorkspaceProps) {
  const { t } = useTranslation();
  const readPathSteps = useMemo(() => {
    if (!inspectedRelationshipFile) {
      return [];
    }
    const relatedRelations = relationshipDashboardData.relations
      .filter((relation) => (
        relation.sourceFileId === inspectedRelationshipFile.id
        || relation.targetFileId === inspectedRelationshipFile.id
      ))
      .sort((left, right) => (
        RELATION_CONFIDENCE_WEIGHT[right.confidence] - RELATION_CONFIDENCE_WEIGHT[left.confidence]
      ));
    const entryRelations = relatedRelations
      .filter((relation) => relation.targetFileId === inspectedRelationshipFile.id)
      .slice(0, READ_PATH_MAX_ENTRY_STEPS);
    const dependencyRelations = relatedRelations
      .filter((relation) => (
        relation.sourceFileId === inspectedRelationshipFile.id
        && !["tested_by", "specified_by", "documents", "styled_by"].includes(relation.type)
      ))
      .slice(0, READ_PATH_MAX_DEPENDENCY_STEPS);
    const verifyRelations = relatedRelations
      .filter((relation) => (
        relation.type === "tested_by"
        || relation.type === "specified_by"
        || relation.type === "documents"
        || relation.type === "styled_by"
      ))
      .slice(0, READ_PATH_MAX_VERIFY_STEPS);
    const steps: ProjectMapRelationshipReadPathStep[] = [];
    const seenStepKeys = new Set<string>();
    for (const relation of entryRelations) {
      const sourceFile = relationshipDashboardFileIndex.get(relation.sourceFileId);
      const targetFile = relationshipDashboardFileIndex.get(relation.targetFileId);
      pushUniqueProjectMapReadPathStep(steps, seenStepKeys, {
        id: `entry:${relation.id}`,
        layer: "entry",
        layerLabel: t("projectMap.relationship.readLayerEntry"),
        title: getProjectMapReadPathRelationTitle({ relation, sourceFile, targetFile }),
        reason: t("projectMap.relationship.readReasonEntry"),
        meta: getProjectMapRelationshipCallCandidate(relation) ?? formatProjectMapReadPathEvidence(relation),
        path: relation.evidence[0]?.path ?? sourceFile?.path ?? targetFile?.path ?? relation.id,
        relationId: relation.id,
      });
    }
    pushUniqueProjectMapReadPathStep(steps, seenStepKeys, {
      id: `focus:${inspectedRelationshipFile.id}`,
      layer: "focus",
      layerLabel: t("projectMap.relationship.readLayerFocus"),
      title: inspectedRelationshipFile.basename,
      reason: t("projectMap.relationship.readReasonFocus"),
      meta: t("projectMap.relationship.readFileMeta", {
        role: inspectedRelationshipFile.role,
        language: inspectedRelationshipFile.language,
        layer: relationshipDashboardModuleByFileId.get(inspectedRelationshipFile.id) ?? inspectedRelationshipFile.layer,
      }),
      path: inspectedRelationshipFile.path,
      relationId: null,
    });
    for (const relation of dependencyRelations) {
      const sourceFile = relationshipDashboardFileIndex.get(relation.sourceFileId);
      const targetFile = relationshipDashboardFileIndex.get(relation.targetFileId);
      pushUniqueProjectMapReadPathStep(steps, seenStepKeys, {
        id: `dependency:${relation.id}`,
        layer: "dependency",
        layerLabel: t("projectMap.relationship.readLayerDependency"),
        title: getProjectMapReadPathRelationTitle({ relation, sourceFile, targetFile }),
        reason: t("projectMap.relationship.readReasonDependency"),
        meta: getProjectMapRelationshipCallCandidate(relation) ?? formatProjectMapReadPathEvidence(relation),
        path: relation.evidence[0]?.path ?? targetFile?.path ?? sourceFile?.path ?? relation.id,
        relationId: relation.id,
      });
    }
    for (const relation of verifyRelations) {
      const sourceFile = relationshipDashboardFileIndex.get(relation.sourceFileId);
      const targetFile = relationshipDashboardFileIndex.get(relation.targetFileId);
      pushUniqueProjectMapReadPathStep(steps, seenStepKeys, {
        id: `verify:${relation.id}`,
        layer: "verify",
        layerLabel: t("projectMap.relationship.readLayerVerify"),
        title: getProjectMapReadPathRelationTitle({ relation, sourceFile, targetFile }),
        reason: t("projectMap.relationship.readReasonVerify"),
        meta: formatProjectMapReadPathEvidence(relation),
        path: relation.evidence[0]?.path ?? targetFile?.path ?? sourceFile?.path ?? relation.id,
        relationId: relation.id,
      });
    }
    const contextPack = relationshipDashboardData.contextPack;
    for (const testTarget of contextPack?.testTargets.slice(0, 2) ?? []) {
      pushUniqueProjectMapReadPathStep(steps, seenStepKeys, {
        id: `test:${testTarget}`,
        layer: "verify",
        layerLabel: t("projectMap.relationship.readLayerVerify"),
        title: getProjectMapReadPathBasename(testTarget),
        reason: t("projectMap.relationship.readReasonTest"),
        meta: t("projectMap.relationship.readRouteMetaContext"),
        path: testTarget,
        relationId: null,
      });
    }
    for (const contractPath of contextPack?.contracts.slice(0, 2) ?? []) {
      pushUniqueProjectMapReadPathStep(steps, seenStepKeys, {
        id: `contract:${contractPath}`,
        layer: "verify",
        layerLabel: t("projectMap.relationship.readLayerVerify"),
        title: getProjectMapReadPathBasename(contractPath),
        reason: t("projectMap.relationship.readReasonContract"),
        meta: t("projectMap.relationship.readRouteMetaContext"),
        path: contractPath,
        relationId: null,
      });
    }
    return steps;
  }, [
    inspectedRelationshipFile,
    relationshipDashboardData.contextPack,
    relationshipDashboardData.relations,
    relationshipDashboardFileIndex,
    relationshipDashboardModuleByFileId,
    t,
  ]);
  const readPathFileCount = useMemo(
    () => new Set(readPathSteps.map((step) => step.path)).size,
    [readPathSteps],
  );
  const readPathChecklistItems = useMemo(() => [
    t("projectMap.relationship.readChecklistEntry"),
    t("projectMap.relationship.readChecklistFocus"),
    t("projectMap.relationship.readChecklistData"),
    t("projectMap.relationship.readChecklistImpact"),
    t("projectMap.relationship.readChecklistVerify"),
  ], [t]);

  return (
    <div className="project-map-relationship-read-workspace">
      <section className="project-map-relationship-read-main">
        <header className="project-map-relationship-workspace-header">
          <div>
            <strong>{t("projectMap.relationship.readWorkspaceTitle")}</strong>
            <span>
              {inspectedRelationshipFile
                ? inspectedRelationshipFile.path
                : t("projectMap.relationship.readWorkspaceEmpty")}
            </span>
          </div>
          <button
            type="button"
            className="project-map-toolbar-action"
            onClick={() => setRelationshipDashboardViewMode("graph")}
          >
            {t("projectMap.relationship.openGraph")}
          </button>
        </header>
        {inspectedRelationshipFile ? (
          <article className="project-map-relationship-read-hero">
            <div>
              <span>{t("projectMap.relationship.readMissionTitle")}</span>
              <strong>{inspectedRelationshipFile.basename}</strong>
              <p>{t("projectMap.relationship.readMissionBody", {
                path: inspectedRelationshipFile.path,
              })}</p>
            </div>
            <dl>
              <div>
                <dt>{t("projectMap.relationship.readMetricFiles")}</dt>
                <dd>{readPathFileCount}</dd>
              </div>
              <div>
                <dt>{t("projectMap.relationship.readMetricRelations")}</dt>
                <dd>{selectedRelationshipRelationGroups.reduce((count, group) => count + group.relations.length, 0)}</dd>
              </div>
              <div>
                <dt>{t("projectMap.relationship.readMetricMode")}</dt>
                <dd>{t("projectMap.relationship.readModeChange")}</dd>
              </div>
            </dl>
          </article>
        ) : null}
        <div className="project-map-relationship-read-route">
          <header>
            <span>{t("projectMap.relationship.readRouteEyebrow")}</span>
            <strong>{t("projectMap.relationship.readRouteTitle")}</strong>
            <p>{t("projectMap.relationship.readRouteHint")}</p>
          </header>
          {readPathSteps.length ? (
            <ol>
              {readPathSteps.map((step, index) => (
                <li key={step.id} className={`is-layer-${step.layer}`}>
                  <article
                    className={cn(
                      "project-map-relationship-read-step",
                      step.relationId && "is-actionable",
                      selectedRelationshipRelation?.id === step.relationId && "is-active",
                    )}
                    role={step.relationId ? "button" : undefined}
                    tabIndex={step.relationId ? 0 : undefined}
                    onClick={() => {
                      if (step.relationId) {
                        setSelectedRelationshipRelationId(step.relationId);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (!step.relationId) {
                        return;
                      }
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedRelationshipRelationId(step.relationId);
                      }
                    }}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <small>{step.layerLabel}</small>
                      <strong>{step.title}</strong>
                      <p>{step.reason}</p>
                      <em>{step.path}</em>
                    </div>
                    <mark>{step.meta}</mark>
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <p className="project-map-relationship-empty">
              {t("projectMap.relationship.readRouteEmpty")}
            </p>
          )}
        </div>
      </section>
      <aside className="project-map-relationship-read-side">
        <section className="project-map-relationship-read-checklist">
          <span>{t("projectMap.relationship.readChecklistEyebrow")}</span>
          <h5>{t("projectMap.relationship.readChecklistTitle")}</h5>
          <p>{t("projectMap.relationship.readChecklistHint")}</p>
          <ol>
            {readPathChecklistItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
        <section className="project-map-relationship-read-summary-card">
          <h5>{t("projectMap.relationship.readSignalTitle")}</h5>
          {relationshipDashboardData.impactSummary ? (
            <div className="project-map-relationship-read-metrics">
              <span>{readPathSteps.length}{t("projectMap.relationship.readSignalSteps")}</span>
              <span>{relationshipDashboardData.impactSummary.directlyAffectedFiles.length}{t("projectMap.relationship.impactDirect")}</span>
              <span>{relationshipDashboardData.contextPack?.riskFlags.length ?? 0}{t("projectMap.relationship.readSignalRisks")}</span>
            </div>
          ) : (
            <p className="project-map-relationship-empty">
              {t("projectMap.relationship.impactEmpty")}
            </p>
          )}
        </section>
        {selectedRelationshipScopeWarnings.length ? (
          <section className="project-map-relationship-read-summary-card">
            <h5>{t("projectMap.relationship.readScopeTitle")}</h5>
            <div className="project-map-relationship-read-chip-list is-warning">
              {selectedRelationshipScopeWarnings.slice(0, 4).map((reason) => (
                <span key={reason.kind + ":" + (reason.path ?? reason.message)}>
                  {reason.path ?? reason.message}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
