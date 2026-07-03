import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * 返回一个"引用稳定但总是调用最新闭包"的回调。
 *
 * 用途:把事件回调作为 prop 传给被 React.memo 包裹的子组件时,内联箭头函数每次渲染都是新引用,
 * 会打破子组件的 memo(见 app-shell 的 layoutNodes options 参数包)。用本 hook 包裹后,回调身份
 * 恒定 → 子组件 memo 生效;同时内部通过 ref 指向最新闭包,免去依赖数组、杜绝 stale-closure。
 *
 * 注意:返回的函数**不可在渲染期间调用**(它反映的是最新一次提交后的闭包)。仅用于事件/异步回调。
 */
export function useEventCallback<A extends unknown[], R>(
  fn: (...args: A) => R,
): (...args: A) => R {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
