import {
  type AppShellDomainContextName,
  type AppShellDomainContextSelection,
  type AppShellDomainContexts,
} from "./appShellDomainContexts";

/**
 * T4：正式 domain bag 选择 API（生产路径应使用本模块）。
 *
 * - 只合并 `domainNames` 列出的 domain 切片
 * - 配合 DomainFlattenIdentityCache：未变 domain 引用时复用同一 bag 对象
 *
 * S4 PR-F：legacy flatten/adapt（flattenAppShellDomainContexts /
 * flattenSelectedAppShellDomainContexts / adaptAppShellLegacyFlatContext /
 * AppShellLegacyFlatContext）已删除；memoized selected-flatten 引擎收敛到
 * 本模块内部，不再从 appShellDomainContexts 导出，生产 consumer 只允许
 * 走 selectAppShellDomainBag / bind / merge。
 */

export type AppShellDomainBag = Record<string, unknown>;

/**
 * 按 domain 对象身份缓存 flatten 结果。
 * 当 reuseStableAppShellDomainContexts 保住未变 domain 引用时，
 * flatten 不再每帧分配新 bag（层 4 协调/effect 输入更稳）。
 */
export type DomainFlattenIdentityCache = {
  domainValues: readonly unknown[] | null;
  flattened: AppShellDomainBag | null;
};

export function createDomainFlattenCache(): DomainFlattenIdentityCache {
  return { domainValues: null, flattened: null };
}

function flattenSelectedAppShellDomainContextsMemoized<
  TDomainName extends AppShellDomainContextName,
>(
  contexts: AppShellDomainContextSelection<TDomainName>,
  domainNames: readonly TDomainName[],
  cache: DomainFlattenIdentityCache,
): AppShellDomainBag {
  const domainValues = domainNames.map((name) => contexts[name]);
  const previous = cache.domainValues;
  if (
    previous &&
    previous.length === domainValues.length &&
    previous.every((value, index) => Object.is(value, domainValues[index])) &&
    cache.flattened
  ) {
    return cache.flattened;
  }
  const flattened = Object.assign({}, ...domainValues) as AppShellDomainBag;
  cache.domainValues = domainValues;
  cache.flattened = flattened;
  return flattened;
}

export function selectAppShellDomainBag<
  TDomainName extends AppShellDomainContextName,
>(
  contexts: AppShellDomainContextSelection<TDomainName> | AppShellDomainContexts,
  domainNames: readonly TDomainName[],
  cache: DomainFlattenIdentityCache,
): AppShellDomainBag {
  return flattenSelectedAppShellDomainContextsMemoized(
    contexts,
    domainNames,
    cache,
  );
}

/** 将 selected bag 绑定为 consumer 边界类型（类型断言，无运行时开销）。 */
export function bindAppShellDomainBag<TBoundary extends object>(
  bag: AppShellDomainBag,
): TBoundary {
  return bag as TBoundary;
}

/**
 * 合并 selected domain bag 与额外 section 输出（search/sections/layoutNodes）。
 */
export function mergeAppShellDomainBag(
  domainBag: AppShellDomainBag,
  ...extras: Array<Record<string, unknown>>
): AppShellDomainBag;
export function mergeAppShellDomainBag<TBoundary extends object>(
  domainBag: AppShellDomainBag,
  ...extras: Array<Record<string, unknown>>
): TBoundary;
export function mergeAppShellDomainBag<TBoundary extends object>(
  domainBag: AppShellDomainBag,
  ...extras: Array<Record<string, unknown>>
): TBoundary {
  return Object.assign({}, domainBag, ...extras) as TBoundary;
}
