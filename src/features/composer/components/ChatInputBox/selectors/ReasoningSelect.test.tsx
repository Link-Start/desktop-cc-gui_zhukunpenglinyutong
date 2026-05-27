// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReasoningSelect } from './ReasoningSelect';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

describe('ReasoningSelect', () => {
  it('shows the selected effort trigger as icon-only', () => {
    const { container } = render(
      <ReasoningSelect
        value="low"
        onChange={vi.fn()}
        options={['low', 'medium']}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Low' });

    expect(trigger.querySelector('.selector-button-text')).toBeNull();
    expect(trigger.querySelector('.codicon-lightbulb-empty')).toBeTruthy();
    expect(trigger.querySelector('[class*="codicon-chevron"]')).toBeNull();
    expect(container.querySelector('.selector-reasoning-button.is-icon-only')).toBeTruthy();
  });

  it('does not render a chevron for the default trigger', () => {
    const { container } = render(
      <ReasoningSelect
        value={null}
        onChange={vi.fn()}
        options={['low', 'medium']}
        showDefaultOption
        defaultLabel="Claude 默认"
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Claude 默认' });

    expect(trigger.querySelector('.selector-button-text')).toBeTruthy();
    expect(trigger.querySelector('[class*="codicon-chevron"]')).toBeNull();
    expect(container.querySelector('.selector-reasoning-button.is-icon-only')).toBeNull();
  });

  it('does not fall back to all levels when explicit options are empty', () => {
    render(
      <ReasoningSelect
        value={null}
        onChange={vi.fn()}
        options={[]}
        showDefaultOption
        defaultLabel="Claude 默认"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Claude 默认/i }));

    expect(screen.getAllByText('Claude 默认')).toHaveLength(2);
    expect(screen.queryByText('Low')).toBeNull();
    expect(screen.queryByText('Medium')).toBeNull();
    expect(screen.queryByText('High')).toBeNull();
    expect(screen.queryByText('Extra High')).toBeNull();
    expect(screen.queryByText('Max')).toBeNull();
  });
});
