"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { friendlyError } from "./friendlyError";

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useApi<T>(path: string | null): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathRef = useRef(path);
  const requestId = useRef(0);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  const refresh = useCallback(async () => {
    const current = pathRef.current;
    if (!current) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api<T>(current);
      if (requestId.current === id) setData(result);
    } catch (err) {
      if (requestId.current === id) setError(friendlyError(err));
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onRefresh = () => void refresh();
    window.addEventListener("traveltok:refresh", onRefresh);
    return () => window.removeEventListener("traveltok:refresh", onRefresh);
  }, [path, refresh]);

  return { data, loading, error, refresh };
}
