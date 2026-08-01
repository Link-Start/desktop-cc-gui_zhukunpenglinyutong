// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInputHistory } from './useInputHistory';
import {
  clearAllHistory,
  recordHistory,
} from '../../../hooks/useInputHistoryStore';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => ({ items: [], counts: {} })),
}));

function setupEditable(initialText = '') {
  const el = document.createElement('div');
  el.contentEditable = 'true';
  el.innerText = initialText;
  document.body.appendChild(el);
  const editableRef = { current: el };
  return { el, editableRef };
}

function createKeyEvent(key: string, init: Partial<KeyboardEvent> = {}) {
  return {
    key,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...init,
  } as unknown as React.KeyboardEvent;
}

describe('useInputHistory (store-backed navigation shell)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllHistory();
  });

  afterEach(() => {
    clearAllHistory();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  function renderHistoryShell(initialText = '') {
    const { el, editableRef } = setupEditable(initialText);
    const getTextContent = () => el.innerText;
    const handleInput = vi.fn();
    const rendered = renderHook(() =>
      useInputHistory({
        editableRef,
        getTextContent,
        handleInput,
        historyScopeKey: 'ws-1',
      })
    );
    return { ...rendered, el, handleInput };
  }

  it('navigates backward with ArrowUp when input is empty', () => {
    recordHistory('alphaentry');
    recordHistory('betaentry');
    const { result, el } = renderHistoryShell();

    let handled = false;
    act(() => {
      handled = result.current.handleKeyDown(createKeyEvent('ArrowUp'));
    });
    expect(handled).toBe(true);
    expect(el.innerText).toBe('betaentry');

    act(() => {
      handled = result.current.handleKeyDown(createKeyEvent('ArrowUp'));
    });
    expect(el.innerText).toBe('alphaentry');
  });

  it('restores draft when navigating past the newest entry with ArrowDown', () => {
    recordHistory('preventry');
    const { result, el } = renderHistoryShell();

    act(() => {
      result.current.handleKeyDown(createKeyEvent('ArrowUp'));
    });
    expect(el.innerText).toBe('preventry');

    let handled = false;
    act(() => {
      handled = result.current.handleKeyDown(createKeyEvent('ArrowDown'));
    });
    expect(handled).toBe(true);
    expect(el.innerText).toBe('');
  });

  it('does not start navigation when input has content', () => {
    recordHistory('preventry');
    const { result } = renderHistoryShell('draft text');

    let handled = true;
    act(() => {
      handled = result.current.handleKeyDown(createKeyEvent('ArrowUp'));
    });
    expect(handled).toBe(false);
  });

  it('ignores modified arrow keys', () => {
    recordHistory('preventry');
    const { result } = renderHistoryShell();

    let handled = true;
    act(() => {
      handled = result.current.handleKeyDown(
        createKeyEvent('ArrowUp', { metaKey: true })
      );
    });
    expect(handled).toBe(false);
  });

  it('record delegates to the store and resets navigation', () => {
    const { result, el } = renderHistoryShell();

    act(() => {
      result.current.record('buildcmd');
    });

    let handled = false;
    act(() => {
      handled = result.current.handleKeyDown(createKeyEvent('ArrowUp'));
    });
    expect(handled).toBe(true);
    expect(el.innerText).toBe('buildcmd');
  });

  it('picks up store changes emitted after mount without remounting', () => {
    const { result, el } = renderHistoryShell();

    let handled = true;
    act(() => {
      handled = result.current.handleKeyDown(createKeyEvent('ArrowUp'));
    });
    expect(handled).toBe(false);

    act(() => {
      recordHistory('lateentry');
    });

    act(() => {
      handled = result.current.handleKeyDown(createKeyEvent('ArrowUp'));
    });
    expect(handled).toBe(true);
    expect(el.innerText).toBe('lateentry');
  });

  it('reloads history when the scope key changes', () => {
    recordHistory('scopedentry');
    const { el, editableRef } = setupEditable();
    const getTextContent = () => el.innerText;
    const handleInput = vi.fn();

    const { result, rerender } = renderHook(
      ({ scopeKey }) =>
        useInputHistory({
          editableRef,
          getTextContent,
          handleInput,
          historyScopeKey: scopeKey,
        }),
      { initialProps: { scopeKey: 'ws-1' } }
    );

    clearAllHistory();
    act(() => {
      rerender({ scopeKey: 'ws-2' });
    });

    let handled = true;
    act(() => {
      handled = result.current.handleKeyDown(createKeyEvent('ArrowUp'));
    });
    expect(handled).toBe(false);
  });
});
