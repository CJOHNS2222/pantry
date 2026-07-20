import { useCallback, useInsertionEffect, useRef } from 'react';

/**
 * Returns a function with a stable identity that always invokes the latest
 * `fn`. Lets context provider values be memoized on data alone (PERF-029)
 * without freezing stale closures over state — the wrapper never changes,
 * but each call reads the freshest implementation via a ref.
 *
 * Not safe to call during render (the ref is committed via useInsertionEffect);
 * all wrapped functions here are event handlers, which is fine.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);
  useInsertionEffect(() => {
    ref.current = fn;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useCallback(((...args: any[]) => ref.current(...args)) as T, []);
}
