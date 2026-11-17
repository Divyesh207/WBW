import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Runs an async loader on mount and whenever deps change; exposes reload and a local setter. */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList = []) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const run = useRef(0);

  const load = useCallback(() => {
    const id = ++run.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => id === run.current && setState({ data, error: null, loading: false }))
      .catch((err: Error) => id === run.current && setState({ data: null, error: err.message, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(load, [load]);

  const setData = useCallback((data: T) => setState({ data, error: null, loading: false }), []);
  return { ...state, reload: load, setData };
}
