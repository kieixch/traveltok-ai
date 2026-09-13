import { useEffect, useState } from "react";

export interface AnalyzeState {
  running: boolean;
  done: number;
  total: number;
  cancelled: boolean;
}

type Listener = (state: AnalyzeState) => void;

const IDLE: AnalyzeState = { running: false, done: 0, total: 0, cancelled: false };

let current = IDLE;
let cancelled = false;
let queue: string[] = [];
const listeners = new Set<Listener>();

function emit(state: AnalyzeState) {
  current = state;
  for (const fn of listeners) fn(state);
}

async function processQueue() {
  const { api } = await import("./api");
  for (let i = 0; i < queue.length; i += 1) {
    if (cancelled) break;
    try {
      await api(`/videos/${queue[i]}/analyze`, { method: "POST" });
    } catch {
      // Keep analyzing the remaining videos even if one fails.
    }
    emit({
      running: !cancelled && i < queue.length - 1,
      done: i + 1,
      total: queue.length,
      cancelled,
    });
  }
  // Reflect partial progress everywhere, whether completed or stopped.
  window.dispatchEvent(new CustomEvent("traveltok:refresh"));
}

/** Runs the analysis queue in the background, surviving page navigation. */
export function startAnalyze(ids: string[]) {
  if (ids.length === 0) return;
  queue = [...ids];
  cancelled = false;
  emit({ running: true, done: 0, total: ids.length, cancelled: false });
  void processQueue();
}

export function stopAnalyze() {
  cancelled = true;
  emit({ ...current, running: false, cancelled: true });
}

export function getAnalyzeState(): AnalyzeState {
  return current;
}

export function onAnalyzeChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useAnalyzeState(): AnalyzeState {
  const [state, setState] = useState<AnalyzeState>(getAnalyzeState);
  useEffect(() => {
    const unsub = onAnalyzeChange(setState);
    return unsub;
  }, []);
  return state;
}