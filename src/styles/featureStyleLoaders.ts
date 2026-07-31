function loadStyles(importers: Array<() => Promise<unknown>>) {
  return Promise.all(importers.map((load) => load())).then(() => undefined);
}

export function loadFileTreeStyles() {
  return loadStyles([
    () => import("./file-tree.css"),
  ]);
}

export function loadDetachedFileExplorerStyles() {
  return loadStyles([
    () => import("./detached-file-explorer.css"),
  ]);
}

export function loadFileViewStyles() {
  return loadStyles([
    () => import("./file-view-panel-shell.css"),
    () => import("./file-view-panel.css"),
    () => import("./file-view-panel.footer.css"),
    () => import("./detached-file-explorer.css"),
  ]);
}

export function loadDiffStyles() {
  return loadStyles([
    () => import("./review-inline.css"),
    () => import("./git-diff-modal.css"),
    () => import("./diff.css"),
    () => import("./diff-viewer.css"),
    () => import("./file-view-panel.css"),
  ]);
}

export function loadRuntimeConsoleStyles() {
  return loadStyles([
    () => import("./runtime-console.css"),
  ]);
}

export function loadProjectMapStyles() {
  return loadStyles([
    () => import("./project-map.css"),
  ]);
}

export function loadIntentCanvasStyles() {
  return loadStyles([
    () => import("@excalidraw/excalidraw/index.css"),
    () => import("./intent-canvas.css"),
  ]);
}

export function loadSettingsStyles() {
  return loadStyles([
    () => import("./settings.css"),
  ]);
}

/**
 * Composer 入口「添加模型」会在未打开设置页时直接挂载 CustomModelDialog。
 * 其壳层/表单样式原先只随 settings.css 懒加载，导致弹窗退化为裸文本布局。
 * 这里只拉 dialog + model-manager 所需切片，避免为了弹窗整包 settings。
 */
export function loadVendorModelManagerStyles() {
  return loadStyles([
    () => import("./settings.vendor-dialog.css"),
    () => import("./settings.part2.vendor-models.css"),
  ]);
}

export function loadReleaseNotesStyles() {
  return loadStyles([
    () => import("./release-notes.css"),
  ]);
}

export function loadLoadingProgressStyles() {
  return loadStyles([
    () => import("./loading-progress-modal.css"),
  ]);
}

export function loadSearchPaletteStyles() {
  return loadStyles([
    () => import("./search-palette.css"),
  ]);
}

export function loadQuickSwitcherStyles() {
  return loadStyles([() => import("./quick-switcher.css")]);
}

export function loadSpecHubStyles() {
  return loadStyles([
    () => import("./spec-hub-header.css"),
    () => import("./spec-hub.css"),
    () => import("./spec-hub.reader-layout.css"),
  ]);
}

export function loadGitHistoryStyles() {
  return Promise.all([
    loadDiffStyles(),
    loadStyles([
      () => import("./git-history.css"),
    ]),
  ]).then(() => undefined);
}

export function loadFileHistoryStyles() {
  return Promise.all([
    loadDiffStyles(),
    loadFileViewStyles(),
    loadStyles([() => import("./file-history.css")]),
  ]).then(() => undefined);
}

export function loadKanbanStyles() {
  return loadStyles([
    () => import("./kanban.css"),
  ]);
}

export function loadBrowserAgentStyles() {
  return loadStyles([
    () => import("./browser-agent-window.css"),
  ]);
}

export function loadWorkspaceHomeStyles() {
  return loadStyles([
    () => import("./workspace-home.css"),
  ]);
}

export function loadAboutStyles() {
  return loadStyles([
    () => import("./about.css"),
  ]);
}

export function loadClientDocumentationStyles() {
  return loadStyles([
    () => import("./client-documentation.css"),
  ]);
}

export function loadMermaidFullscreenStyles() {
  return loadStyles([
    () => import("viewerjs/dist/viewer.css"),
    () => import("./mermaid-fullscreen.css"),
  ]);
}

export function loadImageFullscreenStyles() {
  return loadStyles([
    () => import("viewerjs/dist/viewer.css"),
    () => import("./image-fullscreen.css"),
  ]);
}

export function loadMessagesOutlineFloaterStyles() {
  return loadStyles([
    () => import("./messages-outline-floater.css"),
  ]);
}
