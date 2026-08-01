import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import { lazy } from "react";
import { useTranslation } from "react-i18next";

import { TokenTrackerServerGate } from "./TokenTrackerServerGate";
import type { TokenTrackerGateCopy } from "./TokenTrackerServerGate";

// 整个 vendored dashboard（含 motion / @base-ui 依赖）隔离在异步 chunk。
const LazyTokenTrackerDashboard = lazy(() => import("./TokenTrackerDashboardView"));

export function UsageDashboardSection() {
  const { t } = useTranslation();

  const copy: TokenTrackerGateCopy = {
    checkingLabel: t("extensions.usage.checkingLabel"),
    installingLabel: t("extensions.usage.installingLabel"),
    installingDesc: t("extensions.usage.installingDesc"),
    startingLabel: t("extensions.usage.startingLabel"),
    guideTitle: t("extensions.usage.guideTitle"),
    guideDesc: t("extensions.usage.guideDesc"),
    guideInstallLabel: t("extensions.usage.guideInstallLabel"),
    guideCopy: t("extensions.usage.guideCopy"),
    guideCopied: t("extensions.usage.guideCopied"),
    guideInstallNow: t("extensions.usage.guideInstallNow"),
    guideNoteHooks: t("extensions.usage.guideNoteHooks"),
    guideNoteTelemetry: t("extensions.usage.guideNoteTelemetry"),
    errorTitle: t("extensions.usage.errorTitle"),
    errorRetry: t("extensions.usage.errorRetry"),
  };

  return (
    <TokenTrackerServerGate
      icon={BarChart3}
      copy={copy}
      dashboardClassName="extensions-usage-dashboard"
    >
      <LazyTokenTrackerDashboard />
    </TokenTrackerServerGate>
  );
}
