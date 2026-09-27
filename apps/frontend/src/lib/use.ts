import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";

export function message(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.message;
    if (error.status === 403) return "You do not have permission to do that.";
    if (error.status >= 500) return "The server failed on that request. Check the backend log.";
    return error.message;
  }
  return "Something went wrong.";
}

type Load<T> = { data: T | null; error: string; loading: boolean; reload: () => void };

export function useLoad<T>(fetcher: () => Promise<T>, deps: unknown[]): Load<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const latest = useRef(fetcher);
  const run = useRef(0);

  useEffect(() => {
    latest.current = fetcher;
  });

  const reload = useCallback(() => {
    const ticket = ++run.current;
    setLoading(true);
    latest
      .current()
      .then((next) => {
        if (ticket !== run.current) return;
        setData(next);
        setError("");
      })
      .catch((caught) => {
        if (ticket !== run.current) return;
        setError(message(caught));
      })
      .finally(() => {
        if (ticket === run.current) setLoading(false);
      });
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(reload, deps);

  return { data, error, loading, reload };
}
