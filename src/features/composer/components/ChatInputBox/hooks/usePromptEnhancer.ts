import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { engineSendMessageSync } from '../../../../../services/tauri';
import type { EngineType } from '../../../../../types';
import { getNormalizedAssistantMessageText } from '../../../../../utils/threadItemsAssistantText';
import type { ModelInfo, ProviderId } from '../types';
import type { ProviderModelGroup } from '../modelOptions';

const PROMPT_ENHANCER_DEFAULT_TIMEOUT_SECONDS = 60;
const PROMPT_ENHANCER_MIN_TIMEOUT_SECONDS = 5;
const PROMPT_ENHANCER_MAX_TIMEOUT_SECONDS = 300;
const PROMPT_ENHANCER_AUTO_SESSION = {
  sessionPurpose: 'prompt-enhancer',
  visibility: 'hidden',
  ownerFeature: 'composer',
  autoArchive: true,
  createdBy: 'system',
} as const;

export const PROMPT_ENHANCER_ENGINE_OPTIONS: EngineType[] = [
  'claude',
  'codex',
];

export const PROMPT_ENHANCER_TIMEOUT_LIMITS = {
  defaultSeconds: PROMPT_ENHANCER_DEFAULT_TIMEOUT_SECONDS,
  minSeconds: PROMPT_ENHANCER_MIN_TIMEOUT_SECONDS,
  maxSeconds: PROMPT_ENHANCER_MAX_TIMEOUT_SECONDS,
} as const;

// ─── 结构化错误 ───

export type PromptEnhancerErrorKind = 'timeout' | 'workspace' | 'empty' | 'engine';

/**
 * 润色链路的结构化错误。kind 驱动 UI 文案与 fallback 重试决策，
 * 决策点不再匹配错误文案子串。
 */
export class PromptEnhancerError extends Error {
  readonly kind: PromptEnhancerErrorKind;
  readonly retryable: boolean;

  constructor(kind: PromptEnhancerErrorKind, message: string, retryable: boolean) {
    super(message);
    this.name = 'PromptEnhancerError';
    this.kind = kind;
    this.retryable = retryable;
  }
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message.length > 0 ? message : 'unknown error';
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }
  return 'unknown error';
}

/**
 * 引擎侧错误字符串的唯一归类点。规则变更只动这里（含单测），
 * 调用方一律消费 PromptEnhancerError.kind / retryable。
 */
function isRetryableEngineErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return [
    'claude exited with status',
    'claude stream-json startup timed out',
    'claude stream-json ended without a valid stream event',
    'claude response timed out',
    'rate limit',
    'overloaded',
    'network',
    'authentication',
    'auth',
    'model',
  ].some((needle) => normalized.includes(needle));
}

export function classifyPromptEnhancerError(error: unknown): PromptEnhancerError {
  if (error instanceof PromptEnhancerError) {
    return error;
  }
  const message = resolveErrorMessage(error);
  return new PromptEnhancerError('engine', message, isRetryableEngineErrorMessage(message));
}

// ─── 结果缓存 ───

const ENHANCER_CACHE_MAX_ENTRIES = 20;
const enhancerResultCache = new Map<string, string>();

function enhancerCacheKey(options: {
  text: string;
  engine: EngineType;
  model: string | null;
  locale: string;
}): string {
  return [options.locale, options.engine, options.model ?? '', options.text].join('|');
}

function readEnhancerCache(key: string): string | null {
  const cached = enhancerResultCache.get(key);
  if (cached === undefined) {
    return null;
  }
  // LRU touch：命中后移到末尾。
  enhancerResultCache.delete(key);
  enhancerResultCache.set(key, cached);
  return cached;
}

function writeEnhancerCache(key: string, value: string): void {
  enhancerResultCache.delete(key);
  enhancerResultCache.set(key, value);
  while (enhancerResultCache.size > ENHANCER_CACHE_MAX_ENTRIES) {
    const oldest = enhancerResultCache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    enhancerResultCache.delete(oldest);
  }
}

/** 测试专用：清空模块级缓存，避免用例间串扰。 */
export function clearPromptEnhancerCacheForTests(): void {
  enhancerResultCache.clear();
}

// ─── 指令构建 ───

type EnhancerLocale = 'zh' | 'en';

export function resolveEnhancerLocale(language: string | undefined): EnhancerLocale {
  // zh / zh-TW 共用一套中文指令（简体措辞对繁体用户同样可读）。
  return language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function buildPromptEnhancerInstruction(
  originalPrompt: string,
  engine: EngineType,
  locale: EnhancerLocale,
): string {
  const baseInstruction =
    locale === 'zh'
      ? [
          '你是一名提示词改写助手。',
          '把用户的草稿改写为更清晰、更可执行的 AI 助手提示词。',
          '要求：',
          '- 保留原始意图、语言和明确事实。',
          '- 不要回答请求本身。',
          '- 草稿含糊时，在不虚构新事实的前提下改善结构与清晰度。',
          '- 仅在有帮助时使用简洁小节，如目标、背景、约束、输出或验收标准。',
          '- 草稿已清晰时，仅做轻度润色。',
          '- 只输出改写后的提示词文本，不要解释、不要 markdown 代码块、不要前言。',
          '',
          '用户草稿：',
          originalPrompt,
        ]
      : [
          'You are a prompt rewriting assistant.',
          'Rewrite the user draft into a clearer, more actionable prompt for an AI assistant.',
          'Requirements:',
          '- Preserve the original intent, language, and explicit facts.',
          '- Do not answer the request itself.',
          '- If the draft is vague, improve structure and clarity without inventing new facts.',
          '- Use concise sections only when they help, such as Goal, Context, Constraints, Output, or Acceptance Criteria.',
          '- If the draft is already clear, lightly polish it.',
          '- Output only the rewritten prompt text with no explanation, no markdown fence, and no preamble.',
          '',
          'User draft:',
          originalPrompt,
        ];

  if (engine === 'claude') {
    const claudeConstraints =
      locale === 'zh'
        ? [
            '- 改写保持简洁、面向执行，避免冗长。',
            '- 最多输出 6 行短句，纯文本，不要 markdown 标题，不要多层列表。',
            '- 删除填充词和元语言，只保留可执行的约束与交付格式。',
          ]
        : [
            '- Keep the rewrite concise and execution-oriented; avoid verbosity.',
            '- Output at most 6 short lines, plain text only, no markdown headings, no bullet nesting.',
            '- Remove filler and meta language; keep only actionable constraints and deliverable format.',
          ];
    baseInstruction.splice(8, 0, ...claudeConstraints);
  }

  return baseInstruction.join('\n');
}

function normalizeEnhancerEngine(currentProvider: string): EngineType {
  switch (currentProvider) {
    case 'codex':
      return currentProvider;
    case 'claude':
    default:
      return 'claude';
  }
}

function isPromptEnhancerProviderId(engine: EngineType): engine is ProviderId {
  return engine === 'claude' || engine === 'codex';
}

function resolveEnhancerModelOptions(
  modelGroups: ProviderModelGroup[],
  engine: EngineType,
): ModelInfo[] {
  if (!isPromptEnhancerProviderId(engine)) {
    return [];
  }
  return modelGroups.find((group) => group.providerId === engine)?.models ?? [];
}

function resolveDefaultEnhancerModelId(
  modelGroups: ProviderModelGroup[],
  engine: EngineType,
  currentModelId: string,
): string {
  const modelOptions = resolveEnhancerModelOptions(modelGroups, engine);
  if (modelOptions.length === 0) {
    return '';
  }
  if (currentModelId.trim().length > 0 && modelOptions.some((model) => model.id === currentModelId)) {
    return currentModelId;
  }
  return modelOptions[0]?.id ?? '';
}

function resolveRuntimeEnhancerModel(
  modelGroups: ProviderModelGroup[],
  engine: EngineType,
  modelId: string,
): string | null {
  const trimmedModelId = modelId.trim();
  if (!trimmedModelId) {
    return null;
  }
  const model = resolveEnhancerModelOptions(modelGroups, engine).find((entry) => entry.id === trimmedModelId);
  return ((model as ModelInfo & { model?: string } | undefined)?.model ?? trimmedModelId).trim() || null;
}

function normalizeEnhancerTimeoutSeconds(timeoutSeconds: number): number {
  if (!Number.isFinite(timeoutSeconds)) {
    return PROMPT_ENHANCER_DEFAULT_TIMEOUT_SECONDS;
  }
  return Math.min(
    PROMPT_ENHANCER_MAX_TIMEOUT_SECONDS,
    Math.max(PROMPT_ENHANCER_MIN_TIMEOUT_SECONDS, Math.round(timeoutSeconds)),
  );
}

function normalizeEnhancedPromptResponse(text: unknown): string {
  if (typeof text !== 'string') {
    return '';
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }
  return getNormalizedAssistantMessageText(trimmed).trim();
}

function buildIsolatedSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `prompt-enhancer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function withTimeout<T>(
  request: Promise<T>,
  timeoutMs: number,
  timeoutSeconds: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutRequest = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(
        new PromptEnhancerError(
          'timeout',
          `prompt enhancement timed out after ${timeoutSeconds}s`,
          true,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([request, timeoutRequest]);
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

async function requestEnhancedPrompt(options: {
  workspaceId: string;
  prompt: string;
  engine: EngineType;
  model: string | null;
  sessionId: string;
  timeoutSeconds: number;
}): Promise<string> {
  const timeoutSeconds = normalizeEnhancerTimeoutSeconds(options.timeoutSeconds);
  const response = await withTimeout(
    engineSendMessageSync(options.workspaceId, {
      text: options.prompt,
      engine: options.engine,
      model: options.model,
      accessMode: 'read-only',
      continueSession: false,
      sessionId: options.sessionId,
      autoSession: PROMPT_ENHANCER_AUTO_SESSION,
    }),
    timeoutSeconds * 1000,
    timeoutSeconds,
  );
  const rewritten = normalizeEnhancedPromptResponse(response.text);
  if (!rewritten) {
    throw new PromptEnhancerError('empty', 'engine returned an empty enhancement', true);
  }
  return rewritten;
}

interface UsePromptEnhancerOptions {
  workspaceId?: string | null;
  editableRef: React.RefObject<HTMLDivElement | null>;
  getTextContent: () => string;
  currentProvider: string;
  selectedModel: string;
  modelGroups: ProviderModelGroup[];
  setHasContent: (hasContent: boolean) => void;
  handleInput: () => void;
  stageNextCommitOptions?: (options: {
    source: 'programmatic';
    forceNewTransaction?: boolean;
    inputType?: string;
    timestamp?: number;
  }) => void;
}

interface UsePromptEnhancerReturn {
  isEnhancing: boolean;
  enhancingEngine: EngineType;
  selectedEnhancerEngine: EngineType;
  selectedEnhancerModel: string;
  enhancerModelOptions: ModelInfo[];
  enhancerTimeoutSeconds: number;
  timeoutLimits: typeof PROMPT_ENHANCER_TIMEOUT_LIMITS;
  showEnhancerDialog: boolean;
  originalPrompt: string;
  enhancedPrompt: string;
  canUseEnhancedPrompt: boolean;
  handleEnhancePrompt: () => void;
  handleEnhancerEngineChange: (engine: EngineType) => void;
  handleEnhancerModelChange: (modelId: string) => void;
  handleEnhancerTimeoutChange: (timeoutSeconds: number) => void;
  handleRunPromptEnhancement: () => void;
  handleUseEnhancedPrompt: () => void;
  handleKeepOriginalPrompt: () => void;
  handleCloseEnhancerDialog: () => void;
}

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** 失败展示文案：kind → i18n key；engine kind 附原始诊断。 */
function resolveEnhancerFailureCopy(
  t: TranslateFn,
  primary: PromptEnhancerError,
  timeoutSeconds: number,
  fallback?: PromptEnhancerError,
): string {
  const copyFor = (error: PromptEnhancerError): string => {
    switch (error.kind) {
      case 'timeout':
        return t('promptEnhancer.failedTimeout', {
          seconds: timeoutSeconds,
          defaultValue: 'Prompt enhancement timed out after {{seconds}}s',
        });
      case 'workspace':
        return t('promptEnhancer.failedWorkspace', {
          defaultValue: 'Workspace is not ready for prompt enhancement',
        });
      case 'empty':
        return t('promptEnhancer.failedEmpty', {
          defaultValue: 'The engine returned an empty enhancement',
        });
      case 'engine':
      default:
        return `${t('promptEnhancer.failedGeneric', { defaultValue: 'Prompt enhancement failed' })}: ${error.message}`;
    }
  };
  const primaryCopy = copyFor(primary);
  if (!fallback) {
    return primaryCopy;
  }
  return `${primaryCopy} · ${copyFor(fallback)}`;
}

export function usePromptEnhancer({
  workspaceId,
  editableRef,
  getTextContent,
  currentProvider,
  selectedModel,
  modelGroups,
  setHasContent,
  handleInput,
  stageNextCommitOptions,
}: UsePromptEnhancerOptions): UsePromptEnhancerReturn {
  const { t, i18n } = useTranslation();
  // t / i18n 引用在未初始化 i18n 的环境（如测试）中可能每次渲染都变；
  // 经 ref 读取，避免 callback 链式失稳。
  const tRef = useRef(t);
  tRef.current = t;
  // 部分测试只 mock t 而不提供 i18n 对象，读取语言时防御缺省。
  const languageRef = useRef(i18n?.language as string | undefined);
  languageRef.current = i18n?.language as string | undefined;

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancingEngine, setEnhancingEngine] = useState<EngineType>('claude');
  const [selectedEnhancerEngine, setSelectedEnhancerEngine] = useState<EngineType>(
    normalizeEnhancerEngine(currentProvider),
  );
  const [selectedEnhancerModel, setSelectedEnhancerModel] = useState('');
  const [enhancerTimeoutSeconds, setEnhancerTimeoutSeconds] = useState(
    PROMPT_ENHANCER_DEFAULT_TIMEOUT_SECONDS,
  );
  const [showEnhancerDialog, setShowEnhancerDialog] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [canUseEnhancedPrompt, setCanUseEnhancedPrompt] = useState(false);
  const activeRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      activeRequestIdRef.current += 1;
    };
  }, []);

  const closeEnhancerDialog = useCallback(() => {
    activeRequestIdRef.current += 1;
    setShowEnhancerDialog(false);
    setIsEnhancing(false);
    setCanUseEnhancedPrompt(false);
  }, []);

  const handleEnhancePrompt = useCallback(() => {
    const content = getTextContent().trim();
    if (!content) {
      return;
    }

    activeRequestIdRef.current += 1;
    const defaultEngine = normalizeEnhancerEngine(currentProvider);
    setSelectedEnhancerEngine(defaultEngine);
    setSelectedEnhancerModel(resolveDefaultEnhancerModelId(modelGroups, defaultEngine, selectedModel));
    setOriginalPrompt(content);
    setEnhancedPrompt('');
    setCanUseEnhancedPrompt(false);
    setShowEnhancerDialog(true);
    setIsEnhancing(false);
  }, [currentProvider, getTextContent, modelGroups, selectedModel]);

  const handleEnhancerEngineChange = useCallback((engine: EngineType) => {
    if (!PROMPT_ENHANCER_ENGINE_OPTIONS.includes(engine)) {
      return;
    }
    setSelectedEnhancerEngine(engine);
    setSelectedEnhancerModel(resolveDefaultEnhancerModelId(modelGroups, engine, ''));
    setCanUseEnhancedPrompt(false);
    setEnhancedPrompt('');
  }, [modelGroups]);

  const handleEnhancerModelChange = useCallback((modelId: string) => {
    setSelectedEnhancerModel(modelId);
    setCanUseEnhancedPrompt(false);
    setEnhancedPrompt('');
  }, []);

  const handleEnhancerTimeoutChange = useCallback((timeoutSeconds: number) => {
    setEnhancerTimeoutSeconds(normalizeEnhancerTimeoutSeconds(timeoutSeconds));
  }, []);

  const handleRunPromptEnhancement = useCallback(() => {
    const content = originalPrompt.trim();
    if (!content || isEnhancing) {
      return;
    }

    if (!workspaceId || workspaceId.trim().length === 0) {
      setEnhancedPrompt(
        resolveEnhancerFailureCopy(
          tRef.current,
          new PromptEnhancerError('workspace', 'workspace is not ready', false),
          enhancerTimeoutSeconds,
        ),
      );
      setCanUseEnhancedPrompt(false);
      setIsEnhancing(false);
      return;
    }

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    const engine = selectedEnhancerEngine;
    const timeoutSeconds = normalizeEnhancerTimeoutSeconds(enhancerTimeoutSeconds);
    const locale = resolveEnhancerLocale(languageRef.current);
    const prompt = buildPromptEnhancerInstruction(content, engine, locale);
    const fallbackPrompt =
      engine === 'claude' ? buildPromptEnhancerInstruction(content, 'codex', locale) : null;
    const requestModel = resolveRuntimeEnhancerModel(modelGroups, engine, selectedEnhancerModel);
    const cacheKey = enhancerCacheKey({
      text: content,
      engine,
      model: requestModel,
      locale,
    });

    setEnhancingEngine(engine);
    setEnhancerTimeoutSeconds(timeoutSeconds);
    setEnhancedPrompt('');
    setCanUseEnhancedPrompt(false);
    setShowEnhancerDialog(true);

    // 缓存命中：秒回，零 IPC。
    const cached = readEnhancerCache(cacheKey);
    if (cached !== null) {
      setEnhancedPrompt(cached);
      setCanUseEnhancedPrompt(true);
      setIsEnhancing(false);
      return;
    }

    setIsEnhancing(true);

    void (async () => {
      try {
        const rewrittenPrompt = await requestEnhancedPrompt({
          workspaceId,
          prompt,
          engine,
          model: requestModel,
          sessionId: buildIsolatedSessionId(),
          timeoutSeconds,
        });
        if (activeRequestIdRef.current !== requestId) {
          return;
        }
        writeEnhancerCache(cacheKey, rewrittenPrompt);
        setEnhancedPrompt(rewrittenPrompt);
        setCanUseEnhancedPrompt(true);
      } catch (error: unknown) {
        if (activeRequestIdRef.current !== requestId) {
          return;
        }
        const classified = classifyPromptEnhancerError(error);
        if (engine === 'claude' && classified.retryable && fallbackPrompt) {
          try {
            setEnhancingEngine('codex');
            const fallbackRewrittenPrompt = await requestEnhancedPrompt({
              workspaceId,
              prompt: fallbackPrompt,
              engine: 'codex',
              model: null,
              sessionId: buildIsolatedSessionId(),
              timeoutSeconds,
            });
            if (activeRequestIdRef.current !== requestId) {
              return;
            }
            writeEnhancerCache(
              enhancerCacheKey({ text: content, engine: 'codex', model: null, locale }),
              fallbackRewrittenPrompt,
            );
            setEnhancedPrompt(fallbackRewrittenPrompt);
            setCanUseEnhancedPrompt(true);
            return;
          } catch (fallbackError: unknown) {
            if (activeRequestIdRef.current !== requestId) {
              return;
            }
            setEnhancedPrompt(
              resolveEnhancerFailureCopy(
                tRef.current,
                classified,
                timeoutSeconds,
                classifyPromptEnhancerError(fallbackError),
              ),
            );
            setCanUseEnhancedPrompt(false);
            return;
          }
        }
        setEnhancedPrompt(
          resolveEnhancerFailureCopy(tRef.current, classified, timeoutSeconds),
        );
        setCanUseEnhancedPrompt(false);
      } finally {
        if (activeRequestIdRef.current === requestId) {
          setIsEnhancing(false);
        }
      }
    })();
  }, [
    enhancerTimeoutSeconds,
    isEnhancing,
    modelGroups,
    originalPrompt,
    selectedEnhancerEngine,
    selectedEnhancerModel,
    workspaceId,
  ]);

  const handleUseEnhancedPrompt = useCallback(() => {
    if (canUseEnhancedPrompt && enhancedPrompt && editableRef.current) {
      editableRef.current.innerText = enhancedPrompt;
      setHasContent(true);
      stageNextCommitOptions?.({
        source: 'programmatic',
        forceNewTransaction: true,
        inputType: 'prompt:enhancer',
      });
      handleInput();
    }
    closeEnhancerDialog();
  }, [
    canUseEnhancedPrompt,
    closeEnhancerDialog,
    editableRef,
    enhancedPrompt,
    handleInput,
    setHasContent,
    stageNextCommitOptions,
  ]);

  return {
    isEnhancing,
    enhancingEngine,
    selectedEnhancerEngine,
    selectedEnhancerModel,
    enhancerModelOptions: resolveEnhancerModelOptions(modelGroups, selectedEnhancerEngine),
    enhancerTimeoutSeconds,
    timeoutLimits: PROMPT_ENHANCER_TIMEOUT_LIMITS,
    showEnhancerDialog,
    originalPrompt,
    enhancedPrompt,
    canUseEnhancedPrompt,
    handleEnhancePrompt,
    handleEnhancerEngineChange,
    handleEnhancerModelChange,
    handleEnhancerTimeoutChange,
    handleRunPromptEnhancement,
    handleUseEnhancedPrompt,
    handleKeepOriginalPrompt: closeEnhancerDialog,
    handleCloseEnhancerDialog: closeEnhancerDialog,
  };
}
