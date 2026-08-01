// Vendored TokenTracker SkillsPage 的懒加载入口，与 TokenTrackerDashboardView
// 同一模式：整个 vendored tree（含 motion / @base-ui 等重依赖）只经由此模块被
// 动态 import，保证它们全部落在异步 chunk 里；provider 顺序固定
// （TokenFormatProvider 依赖 LocaleProvider 的 resolvedLocale），不要随意调整。
// ToastProvider 是 vendored showToast（含回收站 Undo action）的渲染宿主，
// 必须包在 SkillsPage 外层。
import { SkillsPage } from "@/features/extensions/tokentracker-dashboard/pages/SkillsPage.jsx";
import { ToastProvider } from "@/features/extensions/tokentracker-dashboard/ui/components/Toast.jsx";
import { CurrencyProvider } from "@/features/extensions/tokentracker-dashboard/ui/foundation/CurrencyProvider.jsx";
import { LocaleProvider } from "@/features/extensions/tokentracker-dashboard/ui/foundation/LocaleProvider.jsx";
import { ThemeProvider } from "@/features/extensions/tokentracker-dashboard/ui/foundation/ThemeProvider.jsx";
import { TokenFormatProvider } from "@/features/extensions/tokentracker-dashboard/ui/foundation/TokenFormatProvider.jsx";

export default function TokenTrackerSkillsView() {
  return (
    <div className="tt-dashboard">
      <LocaleProvider>
        <CurrencyProvider>
          <TokenFormatProvider>
            <ThemeProvider>
              <ToastProvider>
                <SkillsPage />
              </ToastProvider>
            </ThemeProvider>
          </TokenFormatProvider>
        </CurrencyProvider>
      </LocaleProvider>
    </div>
  );
}
