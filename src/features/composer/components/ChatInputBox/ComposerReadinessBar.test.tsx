// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildComposerSendReadiness } from '../../utils/composerSendReadiness';
import { ComposerReadinessBar } from './ComposerReadinessBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('ComposerReadinessBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders target and context summary without ledger toggle', () => {
    const readiness = buildComposerSendReadiness({
      engine: 'codex',
      providerLabel: 'Codex',
      modelLabel: 'gpt-5.5',
      modeLabel: 'Auto Mode',
      modeImpactLabel: 'Full access',
      draftText: 'continue',
      context: {
        selectedMemoryCount: 1,
        fileReferenceCount: 2,
        selectedAgentName: 'reviewer',
      },
    });

    const { container } = render(
      <ComposerReadinessBar readiness={readiness} />,
    );

    // The read-only always-on indicator is optional. Without a rightAccessory
    // prop the readiness bar must not leave a visual placeholder.
    expect(container.querySelector('.curated-indicator')).toBeNull();
    expect(container.querySelector('.composer-readiness-right-accessory')).toBeNull();
    expect(screen.queryByText('Codex')).toBeNull();
    expect(container.querySelector('.composer-readiness-provider')).toBeNull();
    expect(container.querySelector('.composer-readiness-divider')).toBeNull();
    expect(screen.getByText('gpt-5.5')).toBeTruthy();
    // The permission mode now lives in its own primary-row pill, so the
    // readiness bar no longer renders a duplicate mode/access chip.
    expect(screen.queryByText('Auto Mode')).toBeNull();
    expect(screen.queryByText('Full access')).toBeNull();
    expect(
      screen.getByText(
        'composer.manualMemorySelection · composer.readinessContextFileReference · composer.readinessContextAgent',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'composer.contextLedgerExpand' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'composer.contextLedgerCollapse' })).toBeNull();
    expect(container.querySelector('.composer-readiness-icon svg')).toBeTruthy();
    expect(getComputedStyle(container.querySelector('.composer-readiness-icon')!).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)',
    );
    expect(container.querySelector('.composer-readiness-icon .codicon-circle-filled')).toBeNull();
    expect(screen.queryByText('composer.readinessActivity.idle')).toBeNull();
    expect(container.querySelector('[data-primary-action="send"]')).toBeTruthy();
  });

  it('keeps disabled reason in state without rendering the activity copy', () => {
    const readiness = buildComposerSendReadiness({
      engine: 'codex',
      providerLabel: 'Codex',
      modelLabel: 'gpt-5.5',
      draftText: 'continue',
      runtimeLifecycleState: 'recovering',
    });

    render(<ComposerReadinessBar readiness={readiness} />);

    expect(screen.queryByText('composer.readinessDisabled.runtime-recovering')).toBeNull();
    expect(screen.queryByText('composer.readinessActivity.blocked')).toBeNull();
  });

  it('hides empty context placeholder copy', () => {
    const readiness = buildComposerSendReadiness({
      engine: 'codex',
      providerLabel: 'Codex',
      modelLabel: 'gpt-5.5',
      draftText: 'continue',
    });

    render(<ComposerReadinessBar readiness={readiness} />);

    expect(screen.queryByText('composer.readinessContextEmpty')).toBeNull();
    expect(screen.queryByText('no-extra-context')).toBeNull();
  });

  it('keeps the model chip static when no execution-target picker is wired', () => {
    const readiness = buildComposerSendReadiness({
      engine: 'codex',
      providerLabel: 'Codex',
      modelLabel: 'gpt-5.5',
      draftText: 'continue',
    });

    render(
      <ComposerReadinessBar
        readiness={readiness}
        onExecutionTargetChange={undefined}
      />,
    );

    expect(screen.getByTestId('composer-readiness-model-static')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button', { name: /gpt-5.5|Codex/i })).toBeNull();
    expect(screen.queryByText('Codex')).toBeNull();
    expect(screen.getByText('gpt-5.5')).toBeTruthy();
  });

  it('hides the CLI provider while the static chip is still loading', () => {
    const readiness = buildComposerSendReadiness({
      engine: 'claude',
      providerLabel: 'Claude Code',
      modelLabel: '加载中',
      draftText: '',
      configLoading: true,
    });

    const { container } = render(
      <ComposerReadinessBar
        readiness={readiness}
        isModelConfigRefreshing
      />,
    );

    expect(screen.getByTestId('composer-readiness-model-static')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('Claude Code')).toBeNull();
    expect(container.querySelector('.composer-readiness-provider')).toBeNull();
    expect(container.querySelector('.composer-readiness-divider')).toBeNull();
    expect(container.querySelector('.composer-readiness-icon svg')).toBeNull();
    expect(screen.getByText('加载中')).toBeTruthy();
    expect(container.querySelector('.codicon-loading')).toBeTruthy();
    expect(
      container.querySelector('.composer-readiness-bar')?.getAttribute('aria-label'),
    ).toBe('加载中');
  });

  it('renders the right accessory inside the readiness bar wrapper', () => {
    const readiness = buildComposerSendReadiness({
      engine: 'codex',
      providerLabel: 'Codex',
      modelLabel: 'gpt-5.5',
      draftText: 'continue',
    });

    const { container } = render(
      <ComposerReadinessBar
        readiness={readiness}
        rightAccessory={<span data-testid="readiness-accessory">Curated</span>}
      />,
    );

    const wrapper = container.querySelector('.composer-readiness-right-accessory');
    expect(wrapper).toBeTruthy();
    expect(wrapper?.querySelector('[data-testid="readiness-accessory"]')).toBeTruthy();
  });

  it('renders request jump action only when a pending request blocks send', () => {
    const onJumpToRequest = vi.fn();
    const readiness = buildComposerSendReadiness({
      engine: 'codex',
      providerLabel: 'Codex',
      modelLabel: 'gpt-5.5',
      draftText: 'answer',
      requestUserInputState: 'pending',
    });

    render(
      <ComposerReadinessBar
        readiness={readiness}
        onJumpToRequest={onJumpToRequest}
      />,
    );

    screen.getByRole('button', { name: 'composer.readinessJumpToRequest' }).click();
    expect(onJumpToRequest).toHaveBeenCalledTimes(1);
  });
});
