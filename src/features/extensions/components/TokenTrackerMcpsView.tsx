// McpsPage 的懒加载入口，与 TokenTrackerSkillsView 同一模式：vendored 依赖
// （motion / @base-ui 等）只经由此模块被动态 import，保证落在异步 chunk 里。
// 页面文案走主 app i18n，因此只需要 ThemeProvider 提供 .tt-dashboard 下的
// 暗色 .dark 作用域，不需要 Locale/Currency/TokenFormat/Toast provider。
import type { WorkspaceInfo } from "../../../types";
import { ThemeProvider } from "@/features/extensions/tokentracker-dashboard/ui/foundation/ThemeProvider.jsx";

import { McpsPage } from "./McpsPage";

type TokenTrackerMcpsViewProps = {
  activeWorkspace: WorkspaceInfo | null;
};

export default function TokenTrackerMcpsView({
  activeWorkspace,
}: TokenTrackerMcpsViewProps) {
  return (
    <div className="tt-dashboard">
      <ThemeProvider>
        <McpsPage activeWorkspace={activeWorkspace} />
      </ThemeProvider>
    </div>
  );
}
