import { useTranslation } from 'react-i18next';

import {
  ContextContentHeader,
  formatContextPercent,
  formatContextTokens,
} from '@/components/ai-elements/context';
import { Progress } from '@/components/ui/progress';
import type { ClaudeContextUsageViewModel } from './types';

/**
 * ClaudeContextCard — Claude 上下文用量卡片内容
 *
 * 渲染在 ai-elements Context 的 HoverCard 里，只保留 header：
 * 百分比 + 已用/总量 + 进度条。数据取自 ClaudeContextUsageViewModel。
 */
export const ClaudeContextCard = ({
  usage,
}: {
  usage: ClaudeContextUsageViewModel;
}) => {
  const { t } = useTranslation();

  const usedPercentLabel = formatContextPercent(usage.usedPercent);
  const usedTokensText = formatContextTokens(usage.usedTokens);
  const contextWindowText = formatContextTokens(usage.contextWindow);

  const barValue =
    typeof usage.usedPercent === 'number' && Number.isFinite(usage.usedPercent)
      ? Math.min(Math.max(usage.usedPercent, 0), 100)
      : null;

  // header 右侧的窗口用量：优先 已用/总量；退化到"估算 tokens"或"等待回传"
  const windowText = usedTokensText && contextWindowText
    ? `${usedTokensText} / ${contextWindowText}`
    : usedTokensText
      ? t(
        usage.freshness === 'live'
          ? 'chat.claudeContextWindowUsedOnly'
          : 'chat.claudeContextWindowEstimatedTokens',
        { tokens: usedTokensText },
      )
      : t('chat.claudeContextUnavailable');

  return (
    <ContextContentHeader>
      <div className="flex items-center justify-between gap-3 text-xs">
        {usedPercentLabel ? (
          <p className="font-medium">{usedPercentLabel}</p>
        ) : (
          <p className="text-muted-foreground">{t('chat.claudeContextTooltipTitle')}</p>
        )}
        <p className="font-mono text-muted-foreground">{windowText}</p>
      </div>
      {barValue !== null ? (
        <div className="space-y-2">
          <Progress className="bg-muted" value={barValue} />
        </div>
      ) : null}
    </ContextContentHeader>
  );
};

export default ClaudeContextCard;
