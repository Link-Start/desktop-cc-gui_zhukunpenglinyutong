// Vendored TokenTracker dashboard 的懒加载入口。整个 vendored tree（含
// motion / @base-ui 等重依赖）只经由此模块被动态 import，保证它们全部落在
// 异步 chunk 里；provider 顺序固定（TokenFormatProvider 依赖 LocaleProvider
// 的 resolvedLocale），不要随意调整。
import { DashboardPage } from "@/features/extensions/tokentracker-dashboard/pages/DashboardPage.jsx";
import { CurrencyProvider } from "@/features/extensions/tokentracker-dashboard/ui/foundation/CurrencyProvider.jsx";
import { LocaleProvider } from "@/features/extensions/tokentracker-dashboard/ui/foundation/LocaleProvider.jsx";
import { ThemeProvider } from "@/features/extensions/tokentracker-dashboard/ui/foundation/ThemeProvider.jsx";
import { TokenFormatProvider } from "@/features/extensions/tokentracker-dashboard/ui/foundation/TokenFormatProvider.jsx";

export default function TokenTrackerDashboardView() {
  return (
    <div className="tt-dashboard">
      <LocaleProvider>
        <CurrencyProvider>
          <TokenFormatProvider>
            <ThemeProvider>
              <DashboardPage />
            </ThemeProvider>
          </TokenFormatProvider>
        </CurrencyProvider>
      </LocaleProvider>
    </div>
  );
}
