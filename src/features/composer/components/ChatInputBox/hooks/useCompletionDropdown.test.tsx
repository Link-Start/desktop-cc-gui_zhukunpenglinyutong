// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCompletionDropdown } from './useCompletionDropdown';

type TestItem = {
  id: string;
};

describe('useCompletionDropdown', () => {
  it('skips completion items that fail dropdown mapping and keeps selection aligned', async () => {
    const provider = vi.fn().mockResolvedValue([
      { id: 'first' },
      { id: 'broken' },
      { id: 'second' },
    ] satisfies TestItem[]);
    const onSelect = vi.fn();

    const { result } = renderHook(() =>
      useCompletionDropdown<TestItem>({
        trigger: '/',
        provider,
        debounceMs: 0,
        toDropdownItem: (item) => {
          if (item.id === 'broken') {
            throw new Error('bad item');
          }
          return {
            id: item.id,
            label: item.id,
            type: 'command',
          };
        },
        onSelect,
      }),
    );

    act(() => {
      result.current.open(
        { top: 10, left: 20, width: 200, height: 30 },
        { trigger: '/', query: '', start: 0, end: 1 },
      );
      result.current.updateQuery({ trigger: '/', query: '', start: 0, end: 1 });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.items.map((item) => item.id)).toEqual(['first', 'second']);
    });

    act(() => {
      result.current.selectIndex(1);
    });

    expect(onSelect).toHaveBeenCalledWith(
      { id: 'second' },
      { trigger: '/', query: '', start: 0, end: 1 },
    );
  });

  it('treats non-array provider results as an empty completion list', async () => {
    const provider = vi.fn().mockResolvedValue({ id: 'not-an-array' });

    const { result } = renderHook(() =>
      useCompletionDropdown<TestItem>({
        trigger: '/',
        provider: provider as unknown as (
          query: string,
          signal: AbortSignal,
        ) => Promise<TestItem[]>,
        debounceMs: 0,
        toDropdownItem: (item) => ({
          id: item.id,
          label: item.id,
          type: 'command',
        }),
        onSelect: vi.fn(),
      }),
    );

    act(() => {
      result.current.open(
        { top: 10, left: 20, width: 200, height: 30 },
        { trigger: '/', query: '', start: 0, end: 1 },
      );
      result.current.updateQuery({ trigger: '/', query: '', start: 0, end: 1 });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.items).toEqual([]);
    });
  });

  it('selects the matching raw item after a presentation-only header', async () => {
    const provider = vi.fn().mockResolvedValue([
      { id: 'agents-header' },
      { id: 'default-2' },
      { id: 'agents-separator' },
      { id: 'default' },
    ] satisfies TestItem[]);
    const onSelect = vi.fn();

    const { result } = renderHook(() =>
      useCompletionDropdown<TestItem>({
        trigger: '#',
        provider,
        debounceMs: 0,
        toDropdownItem: (item) => ({
          id: item.id,
          label: item.id,
          type:
            item.id === 'agents-header'
              ? 'section-header'
              : item.id === 'agents-separator'
                ? 'separator'
                : 'agent',
        }),
        onSelect,
      }),
    );

    act(() => {
      result.current.open(
        { top: 10, left: 20, width: 200, height: 30 },
        { trigger: '#', query: '', start: 0, end: 1 },
      );
      result.current.updateQuery({ trigger: '#', query: '', start: 0, end: 1 });
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.items.map((item) => item.id)).toEqual([
        'agents-header',
        'default-2',
        'agents-separator',
        'default',
      ]);
    });

    act(() => {
      result.current.selectIndex(1);
    });

    expect(onSelect).toHaveBeenCalledWith(
      { id: 'default' },
      { trigger: '#', query: '', start: 0, end: 1 },
    );
  });

  it.each(['Enter', 'Tab'] as const)(
    'skips presentation-only items during keyboard selection with %s',
    async (confirmationKey) => {
      const provider = vi.fn().mockResolvedValue([
        { id: 'agents-header' },
        { id: 'default-2' },
        { id: 'agents-separator' },
        { id: 'default' },
      ] satisfies TestItem[]);
      const onSelect = vi.fn();

      const { result } = renderHook(() =>
        useCompletionDropdown<TestItem>({
          trigger: '#',
          provider,
          debounceMs: 0,
          toDropdownItem: (item) => ({
            id: item.id,
            label: item.id,
            type:
              item.id === 'agents-header'
                ? 'section-header'
                : item.id === 'agents-separator'
                  ? 'separator'
                  : 'agent',
          }),
          onSelect,
        }),
      );

      act(() => {
        result.current.open(
          { top: 10, left: 20, width: 200, height: 30 },
          { trigger: '#', query: '', start: 0, end: 1 },
        );
        result.current.updateQuery({ trigger: '#', query: '', start: 0, end: 1 });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.handleKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      });
      await waitFor(() => {
        expect(result.current.activeIndex).toBe(1);
      });

      act(() => {
        result.current.handleKeyDown(new KeyboardEvent('keydown', { key: confirmationKey }));
      });

      expect(onSelect).toHaveBeenCalledWith(
        { id: 'default' },
        { trigger: '#', query: '', start: 0, end: 1 },
      );
    },
  );
});
