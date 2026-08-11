import { lazy, Suspense, useState } from "react";
import { useWindowLabel } from "./features/layout/hooks/useWindowLabel";
import { isDetachedFileExplorerWindowLabel } from "./features/files/detachedFileExplorer";
import { isBrowserAgentDockWindowLabel } from "./features/browser-agent/browserAgentDockWindow";
import { StartupGateOverlay } from "./features/app/components/StartupGateOverlay";
import { isStartupGateOverlayTestEnabled } from "./features/startup-orchestration/utils/startupGateOverlayTestFlag";

// AppShell 占主包大头；lazy 后主窗与 about/detached 窗入口分离，压 App-*.js 启动图。
const AppShell = lazy(() =>
  import("./app-shell").then((module) => ({
    default: module.AppShell,
  })),
);

const AboutView = lazy(() =>
  import("./features/about/components/AboutView").then((module) => ({
    default: module.AboutView,
  })),
);

const DetachedFileExplorerWindow = lazy(() =>
  import("./features/files/components/DetachedFileExplorerWindow").then((module) => ({
    default: module.DetachedFileExplorerWindow,
  })),
);

const DetachedSpecHubWindow = lazy(() =>
  import("./features/spec/components/DetachedSpecHubWindow").then((module) => ({
    default: module.DetachedSpecHubWindow,
  })),
);

const ClientDocumentationWindow = lazy(() =>
  import("./features/client-documentation/components/ClientDocumentationWindow").then((module) => ({
    default: module.ClientDocumentationWindow,
  })),
);

const DetachedBrowserAgentWindow = lazy(() =>
  import("./features/browser-agent/components/DetachedBrowserAgentWindow").then((module) => ({
    default: module.DetachedBrowserAgentWindow,
  })),
);

export function AppRouter() {
  const windowLabel = useWindowLabel();
  const [startupGateOverlayEnabledAtMount] = useState(
    isStartupGateOverlayTestEnabled,
  );
  if (windowLabel === "about") {
    return (
      <Suspense fallback={null}>
        <AboutView />
      </Suspense>
    );
  }
  if (isDetachedFileExplorerWindowLabel(windowLabel)) {
    return (
      <Suspense fallback={null}>
        <DetachedFileExplorerWindow />
      </Suspense>
    );
  }
  if (windowLabel === "spec-hub") {
    return (
      <Suspense fallback={null}>
        <DetachedSpecHubWindow />
      </Suspense>
    );
  }
  if (windowLabel === "client-documentation") {
    return (
      <Suspense fallback={null}>
        <ClientDocumentationWindow />
      </Suspense>
    );
  }
  if (isBrowserAgentDockWindowLabel(windowLabel)) {
    return (
      <Suspense fallback={null}>
        <DetachedBrowserAgentWindow />
      </Suspense>
    );
  }
  return (
    <>
      <Suspense fallback={null}>
        <AppShell />
      </Suspense>
      {startupGateOverlayEnabledAtMount ? <StartupGateOverlay /> : null}
    </>
  );
}

export default AppRouter;
