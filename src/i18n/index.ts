import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  getClientStoreSync,
  isClientStoreReady,
  whenClientStoreReady,
  writeClientStoreValue,
} from "../services/clientStorage";

export type SupportedLanguage =
  | "zh"
  | "zh-TW"
  | "en"
  | "hi"
  | "es"
  | "fr"
  | "ja"
  | "ru"
  | "ko"
  | "pt-BR";

/**
 * Single source of truth for the language picker. `nativeName` is the language's
 * own endonym, so it renders correctly regardless of the active UI language and
 * needs no translation key. Order mirrors the product's chosen display order.
 */
export const SUPPORTED_LANGUAGES: ReadonlyArray<{
  code: SupportedLanguage;
  nativeName: string;
}> = [
  { code: "zh", nativeName: "简体中文" },
  { code: "zh-TW", nativeName: "繁體中文" },
  { code: "en", nativeName: "English" },
  { code: "hi", nativeName: "हिन्दी" },
  { code: "es", nativeName: "Español" },
  { code: "fr", nativeName: "Français" },
  { code: "ja", nativeName: "日本語" },
  { code: "ru", nativeName: "Русский" },
  { code: "ko", nativeName: "한국어" },
  { code: "pt-BR", nativeName: "Português (Brasil)" },
];

const supportedLanguages = new Set<SupportedLanguage>(
  SUPPORTED_LANGUAGES.map((entry) => entry.code),
);

const DEFAULT_LANGUAGE: SupportedLanguage = "zh";

type LocalePackLoader = () => Promise<{ default: Record<string, unknown> }>;

/**
 * First-paint loaders. Settings / about / debug copy lives in deferred packs so
 * the full locale index no longer blocks shell mount.
 */
const criticalLocaleLoaders: Partial<Record<SupportedLanguage, LocalePackLoader>> = {
  en: () => import("./locales/en/critical"),
  "zh-TW": () => import("./locales/zh-TW/critical"),
  hi: () => import("./locales/hi/critical"),
  es: () => import("./locales/es/critical"),
  fr: () => import("./locales/fr/critical"),
  ja: () => import("./locales/ja/critical"),
  ru: () => import("./locales/ru/critical"),
  ko: () => import("./locales/ko/critical"),
  "pt-BR": () => import("./locales/pt-BR/critical"),
  zh: () => import("./locales/zh/critical"),
};

const deferredLocaleLoaders: Partial<Record<SupportedLanguage, LocalePackLoader>> = {
  en: () => import("./locales/en/deferred"),
  "zh-TW": () => import("./locales/zh-TW/deferred"),
  hi: () => import("./locales/hi/deferred"),
  es: () => import("./locales/es/deferred"),
  fr: () => import("./locales/fr/deferred"),
  ja: () => import("./locales/ja/deferred"),
  ru: () => import("./locales/ru/deferred"),
  ko: () => import("./locales/ko/deferred"),
  "pt-BR": () => import("./locales/pt-BR/deferred"),
  zh: () => import("./locales/zh/deferred"),
};

/**
 * Per-language fallback chains. Traditional Chinese degrades to Simplified before
 * English; every other bundle-less language degrades straight to English. Kept in
 * sync with the `fallbackLng` object passed to i18next at init time.
 */
const fallbackChains: Partial<Record<SupportedLanguage, SupportedLanguage[]>> = {
  "zh-TW": ["zh", "en"],
};
const DEFAULT_FALLBACK: SupportedLanguage[] = ["en"];

function fallbackChainFor(lang: SupportedLanguage): SupportedLanguage[] {
  return fallbackChains[lang] ?? DEFAULT_FALLBACK;
}

const i18nextFallback = SUPPORTED_LANGUAGES.reduce<Record<string, string[]>>(
  (acc, { code }) => {
    if (fallbackChains[code]) {
      acc[code] = fallbackChains[code] as string[];
    }
    return acc;
  },
  { default: DEFAULT_FALLBACK },
);

const loadedCriticalLanguages = new Set<SupportedLanguage>();
const loadedDeferredLanguages = new Set<SupportedLanguage>();
const loadedResources: Partial<Record<SupportedLanguage, Record<string, unknown>>> = {};

function normalizeLanguage(lang: string | undefined): SupportedLanguage {
  return supportedLanguages.has(lang as SupportedLanguage)
    ? (lang as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

async function resolveStoredLanguage(): Promise<SupportedLanguage> {
  if (!isClientStoreReady("app")) {
    await whenClientStoreReady("app");
  }
  return normalizeLanguage(getClientStoreSync<string>("app", "language"));
}

export const saveLanguage = (lang: string): void => {
  writeClientStoreValue("app", "language", normalizeLanguage(lang));
};

if (initReactI18next && typeof initReactI18next === "object") {
  i18n.use(initReactI18next);
}

const i18nInstance = i18n;

function applyResourceBundle(lang: SupportedLanguage, resource: Record<string, unknown>): void {
  if (i18nInstance.isInitialized && typeof i18nInstance.addResourceBundle === "function") {
    i18nInstance.addResourceBundle(lang, "translation", resource, true, true);
  }
}

function mergeResourceBundle(
  lang: SupportedLanguage,
  resource: Record<string, unknown>,
): Record<string, unknown> {
  const merged = {
    ...(loadedResources[lang] ?? {}),
    ...resource,
  };
  loadedResources[lang] = merged;
  applyResourceBundle(lang, merged);
  return merged;
}

async function loadLocalePack(
  lang: SupportedLanguage,
  phase: "critical" | "deferred",
): Promise<void> {
  const loaded =
    phase === "critical" ? loadedCriticalLanguages : loadedDeferredLanguages;
  if (loaded.has(lang)) {
    return;
  }
  const loader =
    phase === "critical" ? criticalLocaleLoaders[lang] : deferredLocaleLoaders[lang];
  if (!loader) {
    return;
  }
  const resource = await loader();
  mergeResourceBundle(lang, resource.default);
  loaded.add(lang);
}

async function loadLanguagePhase(
  lang: string | undefined,
  phase: "critical" | "deferred",
): Promise<SupportedLanguage> {
  const normalized = normalizeLanguage(lang);
  await loadLocalePack(normalized, phase);
  if (!criticalLocaleLoaders[normalized] || fallbackChains[normalized]) {
    for (const fallback of fallbackChainFor(normalized)) {
      await loadLocalePack(fallback, phase);
    }
  }
  return normalized;
}

const originalChangeLanguage = i18nInstance.changeLanguage.bind(i18nInstance);

i18nInstance.changeLanguage = (async (
  lang?: string,
  callback?: Parameters<typeof i18nInstance.changeLanguage>[1],
) => {
  const requested = lang ?? (await resolveStoredLanguage());
  const normalized = await loadLanguagePhase(requested, "critical");
  await loadLanguagePhase(normalized, "deferred");
  return originalChangeLanguage(normalized, callback);
}) as typeof i18nInstance.changeLanguage;

export const i18nCriticalReady = (async () => {
  const initialLanguage = await loadLanguagePhase(
    await resolveStoredLanguage(),
    "critical",
  );
  const resources = Object.entries(loadedResources).reduce<
    Record<string, { translation: Record<string, unknown> }>
  >((acc, [lng, resource]) => {
    acc[lng] = { translation: resource ?? {} };
    return acc;
  }, {});
  await i18nInstance.init({
    resources,
    lng: initialLanguage,
    fallbackLng: i18nextFallback,
    interpolation: {
      escapeValue: false,
    },
  });
  return i18nInstance;
})();

let i18nReadyPromise: Promise<typeof i18nInstance> | null = null;

export function ensureI18nReady(): Promise<typeof i18nInstance> {
  if (!i18nReadyPromise) {
    i18nReadyPromise = (async () => {
      const instance = await i18nCriticalReady;
      const language = normalizeLanguage(instance.language);
      await loadLanguagePhase(language, "deferred");
      const merged = loadedResources[language];
      if (merged) {
        applyResourceBundle(language, merged);
      }
      return instance;
    })();
  }
  return i18nReadyPromise;
}

/** Full locale pack. Lazy: deferred resources start only when this thenable is awaited. */
export const i18nReady = {
  then<TResult1 = typeof i18nInstance, TResult2 = never>(
    onFulfilled?:
      | ((value: typeof i18nInstance) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return ensureI18nReady().then(onFulfilled, onRejected);
  },
  catch<TResult = never>(
    onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ) {
    return ensureI18nReady().catch(onRejected);
  },
  finally(onFinally?: (() => void) | null) {
    return ensureI18nReady().finally(onFinally ?? undefined);
  },
} as Promise<typeof i18nInstance>;

export default i18n;
