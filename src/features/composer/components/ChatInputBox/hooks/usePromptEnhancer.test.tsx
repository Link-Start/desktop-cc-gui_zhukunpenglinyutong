/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { engineSendMessageSync } from '../../../../../services/tauri';
import {
  PROMPT_ENHANCER_ENGINE_OPTIONS,
  usePromptEnhancer,
} from './usePromptEnhancer';

vi.mock('../../../../../services/tauri', () => ({
  engineSendMessageSync: vi.fn(),
}));

const defaultModelGroups = [
  {
    providerId: 'claude' as const,
    providerLabel: 'Claude Code',
    enabled: true,
    models: [
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', model: 'claude-sonnet-4-5' },
    ],
  },
  {
    providerId: 'codex' as const,
    providerLabel: 'Codex',
    enabled: true,
    models: [
      { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', model: 'gpt-5.1-codex' },
    ],
  },
  {
    providerId: 'gemini' as const,
    providerLabel: 'Gemini',
    enabled: true,
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', model: 'gemini-2.5-pro' },
    ],
  },
  {
    providerId: 'opencode' as const,
    providerLabel: 'OpenCode',
    enabled: true,
    models: [],
  },
];

function renderPromptEnhancer(options?: {
  currentProvider?: string;
  selectedModel?: string;
  draft?: string;
}) {
  const editableRef = { current: null };
  const setHasContent = vi.fn();
  const handleInput = vi.fn();

  const hook = renderHook(() =>
    usePromptEnhancer({
      workspaceId: 'ws-1',
      editableRef,
      getTextContent: () => options?.draft ?? '报告管理页面加载数据时，标题的获取逻辑是什么',
      currentProvider: options?.currentProvider ?? 'claude',
      selectedModel: options?.selectedModel ?? 'claude-sonnet-4-5',
      modelGroups: defaultModelGroups,
      setHasContent,
      handleInput,
    }),
  );

  return { ...hook, setHasContent, handleInput };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('usePromptEnhancer', () => {
  it('opens the dialog without starting enhancement automatically', () => {
    const sendSync = vi.mocked(engineSendMessageSync);
    const { result } = renderPromptEnhancer();

    act(() => {
      result.current.handleEnhancePrompt();
    });

    expect(result.current.showEnhancerDialog).toBe(true);
    expect(result.current.originalPrompt).toBe('报告管理页面加载数据时，标题的获取逻辑是什么');
    expect(result.current.isEnhancing).toBe(false);
    expect(sendSync).not.toHaveBeenCalled();
  });

  it('keeps Gemini unavailable even when the current provider is legacy Gemini', async () => {
    const sendSync = vi.mocked(engineSendMessageSync);
    sendSync.mockResolvedValueOnce({
      engine: 'claude',
      text: '请说明报告管理页面标题加载逻辑。',
    });

    const { result } = renderPromptEnhancer({
      currentProvider: 'gemini',
      selectedModel: 'gemini-2.5-pro',
    });

    act(() => {
      result.current.handleEnhancePrompt();
    });

    await waitFor(() => {
      expect(result.current.showEnhancerDialog).toBe(true);
    });

    act(() => {
      result.current.handleEnhancerEngineChange('gemini');
      result.current.handleEnhancerTimeoutChange(12);
    });

    await waitFor(() => {
      expect(result.current.selectedEnhancerEngine).toBe('claude');
      expect(result.current.selectedEnhancerModel).toBe('claude-sonnet-4-5');
      expect(result.current.enhancerTimeoutSeconds).toBe(12);
    });

    act(() => {
      result.current.handleRunPromptEnhancement();
    });

    await waitFor(() => {
      expect(result.current.isEnhancing).toBe(false);
      expect(result.current.canUseEnhancedPrompt).toBe(true);
    });

    expect(PROMPT_ENHANCER_ENGINE_OPTIONS).not.toContain('gemini');
    expect(result.current.enhancingEngine).toBe('claude');
    expect(sendSync).toHaveBeenCalledTimes(1);
    expect(sendSync.mock.calls[0]?.[1].engine).toBe('claude');
    expect(sendSync.mock.calls[0]?.[1].model).toBe('claude-sonnet-4-5');
  });

  it('keeps OpenCode unavailable and defaults legacy OpenCode context to Claude', () => {
    const { result } = renderPromptEnhancer({
      currentProvider: 'opencode',
      selectedModel: '',
    });

    act(() => {
      result.current.handleEnhancePrompt();
    });

    expect(PROMPT_ENHANCER_ENGINE_OPTIONS).toEqual(['claude', 'codex']);
    expect(result.current.selectedEnhancerEngine).toBe('claude');
    expect(result.current.selectedEnhancerModel).toBe('claude-sonnet-4-5');

    act(() => {
      result.current.handleEnhancerEngineChange('opencode');
    });

    expect(result.current.selectedEnhancerEngine).toBe('claude');
  });

  it('falls back to Codex when Claude enhancement exits before returning text', async () => {
    const sendSync = vi.mocked(engineSendMessageSync);
    sendSync
      .mockRejectedValueOnce(new Error('Claude exited with status: exit status: 1'))
      .mockResolvedValueOnce({
        engine: 'codex',
        text: '请说明报告管理页面加载数据时标题字段的来源、兜底逻辑和异常处理。',
      });

    const { result } = renderPromptEnhancer();

    act(() => {
      result.current.handleEnhancePrompt();
    });

    await waitFor(() => {
      expect(result.current.showEnhancerDialog).toBe(true);
    });

    act(() => {
      result.current.handleRunPromptEnhancement();
    });

    await waitFor(() => {
      expect(result.current.isEnhancing).toBe(false);
      expect(result.current.canUseEnhancedPrompt).toBe(true);
    });

    expect(result.current.enhancingEngine).toBe('codex');
    expect(result.current.enhancedPrompt).toBe(
      '请说明报告管理页面加载数据时标题字段的来源、兜底逻辑和异常处理。',
    );
    expect(sendSync).toHaveBeenCalledTimes(2);
    expect(sendSync.mock.calls[0]?.[1].engine).toBe('claude');
    expect(sendSync.mock.calls[0]?.[1].model).toBe('claude-sonnet-4-5');
    expect(sendSync.mock.calls[1]?.[1].engine).toBe('codex');
    expect(sendSync.mock.calls[1]?.[1].model).toBeNull();
  });

  it('normalizes duplicated Claude enhancement text before showing the result', async () => {
    const sendSync = vi.mocked(engineSendMessageSync);
    sendSync.mockResolvedValueOnce({
      engine: 'claude',
      text: [
        '请检查 Claude Code 提示词增强是否仍会重复返回同一段信息。',
        '请给出复现条件、根因判断和最小修复方案。',
        '',
        '请检查 Claude Code 提示词增强是否仍会重复返回同一段信息。',
        '请给出复现条件、根因判断和最小修复方案。',
      ].join('\n'),
    });

    const { result } = renderPromptEnhancer({
      currentProvider: 'claude',
      draft: '提示词增强返回重复信息，重点看 Claude Code。',
    });

    act(() => {
      result.current.handleEnhancePrompt();
    });

    await waitFor(() => {
      expect(result.current.showEnhancerDialog).toBe(true);
    });

    act(() => {
      result.current.handleRunPromptEnhancement();
    });

    await waitFor(() => {
      expect(result.current.isEnhancing).toBe(false);
      expect(result.current.canUseEnhancedPrompt).toBe(true);
    });

    expect(result.current.enhancedPrompt).toBe(
      '请检查 Claude Code 提示词增强是否仍会重复返回同一段信息。请给出复现条件、根因判断和最小修复方案。',
    );
    expect(
      result.current.enhancedPrompt.match(/请检查 Claude Code 提示词增强/g),
    ).toHaveLength(1);
    expect(sendSync).toHaveBeenCalledTimes(1);
  });

  it('normalizes duplicated Codex enhancement text before showing the result', async () => {
    const sendSync = vi.mocked(engineSendMessageSync);
    sendSync.mockResolvedValueOnce({
      engine: 'codex',
      text: [
        '请检查 Codex 提示词增强是否仍会重复返回同一段信息。',
        '请给出复现条件、根因判断和最小修复方案。',
        '',
        '请检查 Codex 提示词增强是否仍会重复返回同一段信息。',
        '请给出复现条件、根因判断和最小修复方案。',
      ].join('\n'),
    });

    const { result } = renderPromptEnhancer({
      currentProvider: 'codex',
      selectedModel: 'gpt-5.1-codex',
      draft: '提示词增强返回重复信息，重点看 Codex。',
    });

    act(() => {
      result.current.handleEnhancePrompt();
    });

    await waitFor(() => {
      expect(result.current.showEnhancerDialog).toBe(true);
    });

    act(() => {
      result.current.handleRunPromptEnhancement();
    });

    await waitFor(() => {
      expect(result.current.isEnhancing).toBe(false);
      expect(result.current.canUseEnhancedPrompt).toBe(true);
    });

    expect(result.current.enhancingEngine).toBe('codex');
    expect(result.current.enhancedPrompt).toBe(
      '请检查 Codex 提示词增强是否仍会重复返回同一段信息。请给出复现条件、根因判断和最小修复方案。',
    );
    expect(result.current.enhancedPrompt.match(/请检查 Codex 提示词增强/g)).toHaveLength(1);
    expect(sendSync).toHaveBeenCalledTimes(1);
    expect(sendSync.mock.calls[0]?.[1].engine).toBe('codex');
    expect(sendSync.mock.calls[0]?.[1].model).toBe('gpt-5.1-codex');
  });

  it('shows both Claude and fallback errors when prompt enhancement cannot recover', async () => {
    const sendSync = vi.mocked(engineSendMessageSync);
    sendSync
      .mockRejectedValueOnce(new Error('Claude stream-json ended without a valid stream event'))
      .mockRejectedValueOnce(new Error('Codex response timed out'));

    const { result } = renderPromptEnhancer();

    act(() => {
      result.current.handleEnhancePrompt();
    });

    await waitFor(() => {
      expect(result.current.showEnhancerDialog).toBe(true);
    });

    act(() => {
      result.current.handleRunPromptEnhancement();
    });

    await waitFor(() => {
      expect(result.current.isEnhancing).toBe(false);
      expect(result.current.canUseEnhancedPrompt).toBe(false);
    });

    expect(result.current.enhancedPrompt).toContain('Prompt enhancement failed.');
    expect(result.current.enhancedPrompt).toContain(
      'Claude: Claude stream-json ended without a valid stream event',
    );
    expect(result.current.enhancedPrompt).toContain('Fallback: Codex response timed out');
    expect(sendSync).toHaveBeenCalledTimes(2);
  });

  it('keeps Claude diagnostics when Codex fallback returns an empty rewrite', async () => {
    const sendSync = vi.mocked(engineSendMessageSync);
    sendSync
      .mockRejectedValueOnce(new Error('Claude exited with status: exit status: 1'))
      .mockResolvedValueOnce({
        engine: 'codex',
        text: '   ',
      });

    const { result } = renderPromptEnhancer();

    act(() => {
      result.current.handleEnhancePrompt();
    });

    await waitFor(() => {
      expect(result.current.showEnhancerDialog).toBe(true);
    });

    act(() => {
      result.current.handleRunPromptEnhancement();
    });

    await waitFor(() => {
      expect(result.current.isEnhancing).toBe(false);
      expect(result.current.canUseEnhancedPrompt).toBe(false);
    });

    expect(result.current.enhancedPrompt).toContain('Claude: Claude exited with status');
    expect(result.current.enhancedPrompt).toContain(
      'Fallback: Codex returned an empty prompt enhancement',
    );
    expect(sendSync).toHaveBeenCalledTimes(2);
  });
});
