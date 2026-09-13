import { useEffect, useState } from "react";
import { friendlyError } from "./friendlyError";
import type { TrendScoreResult } from "./types";

export type TaskKind = "analyze" | "plan" | "trend" | "index";

export interface Task {
  kind: TaskKind;
  label: string;
  status: "running" | "done" | "failed" | "stopped";
  detail?: string;
  result?: string;
  error?: string;
  progress: number;
  count?: number;
  total?: number;
  data?: unknown;
}

export interface AnalyzeState {
  running: boolean;
  done: number;
  total: number;
  cancelled: boolean;
}

const IDLE_ANALYZE: AnalyzeState = { running: false, done: 0, total: 0, cancelled: false };

type Listener = (tasks: Task[]) => void;

const tasks = new Map<TaskKind, Task>();
const listeners = new Set<Listener>();

let analyzeQueue: string[] = [];
let analyzeCancelled = false;

function emit() {
  const snapshot = [...tasks.values()];
  for (const fn of listeners) fn(snapshot);
}

function setTask(kind: TaskKind, patch: Partial<Task>) {
  const prev = tasks.get(kind);
  const next: Task = {
    kind,
    label: prev?.label ?? kind,
    progress: 0,
    status: "running",
    ...prev,
    ...patch,
  };
  tasks.set(kind, next);
  emit();
}

/** Runs sequential video analysis in the background, surviving page navigation. */
export function startAnalyze(ids: string[], label = "Analyze videos") {
  if (ids.length === 0) return;
  analyzeQueue = [...ids];
  analyzeCancelled = false;
  setTask("analyze", {
    label,
    status: "running",
    detail: "0 / " + ids.length,
    progress: 0,
    count: 0,
    total: ids.length,
  });
  void (async () => {
    const { api } = await import("./api");
    for (let i = 0; i < analyzeQueue.length; i += 1) {
      if (analyzeCancelled) break;
      try {
        await api(`/videos/${analyzeQueue[i]}/analyze`, { method: "POST" });
      } catch {
        // Keep analyzing the remaining videos even if one fails.
      }
      const done = i + 1;
      const cancelled = analyzeCancelled;
      const finished = done >= analyzeQueue.length;
      setTask("analyze", {
        status: cancelled ? "stopped" : finished ? "done" : "running",
        detail: `${done} / ${analyzeQueue.length}`,
        progress: Math.round((done / analyzeQueue.length) * 100),
        count: done,
        total: analyzeQueue.length,
        result: cancelled
          ? `${done} dari ${analyzeQueue.length} video selesai`
          : `${done} video dianalisis`,
      });
    }
    // Reflect partial progress everywhere, whether completed or stopped.
    window.dispatchEvent(new CustomEvent("traveltok:refresh"));
  })();
}

export function stopAnalyze() {
  analyzeCancelled = true;
  const t = tasks.get("analyze");
  if (t && t.status === "running") {
    setTask("analyze", {
      ...t,
      status: "stopped",
      detail: undefined,
      result: `${t.count ?? 0} dari ${t.total ?? t.count ?? 0} video selesai`,
    });
  }
}

/** Runs content plan generation in the background. */
export function startGeneratePlan(input: {
  projectId: string;
  startDate: string;
  endDate: string;
  postsPerWeek: number;
  language?: string;
}) {
  setTask("plan", {
    label: "Generate plan",
    status: "running",
    detail: "Membuat rencana konten…",
    progress: 0,
  });
  void (async () => {
    const { api } = await import("./api");
    try {
      await api("/content-plans/generate", { method: "POST", body: input });
      setTask("plan", {
        status: "done",
        detail: undefined,
        result: "Rencana konten berhasil dibuat.",
        progress: 100,
      });
      window.dispatchEvent(new CustomEvent("traveltok:refresh"));
    } catch (err) {
      setTask("plan", {
        status: "failed",
        detail: undefined,
        result: undefined,
        error: friendlyError(err),
        progress: 0,
      });
    }
  })();
}

/** Runs trend scoring in the background; result is kept so pages can render it. */
export function startScoreTrend(
  query: { projectId: string; keyword: string; hashtag: string; periodDays: number },
  label = "Score trend",
) {
  setTask("trend", {
    label,
    status: "running",
    detail: "Menghitung skor tren…",
    progress: 0,
    result: undefined,
    error: undefined,
  });
  void (async () => {
    const { api } = await import("./api");
    try {
      const result = await api<TrendScoreResult>("/analytics/trend-score", { query });
      setTask("trend", {
        status: "done",
        detail: undefined,
        result: `Skor tren ${result.trendScore.toFixed(0)} · ${result.matchingVideos} video cocok`,
        progress: 100,
        data: result,
      });
    } catch (err) {
      setTask("trend", {
        status: "failed",
        detail: undefined,
        result: undefined,
        error: friendlyError(err),
        progress: 0,
      });
    }
  })();
}

/** Runs embedding re-indexing in the background. */
export function startReindex(projectId: string, label = "Re-index") {
  setTask("index", {
    label,
    status: "running",
    detail: "Membangun indeks embeddings…",
    progress: 0,
    result: undefined,
    error: undefined,
  });
  void (async () => {
    const { api } = await import("./api");
    try {
      const result = await api<{ videos: number; ideas: number; trends: number; model: string }>(
        `/projects/${projectId}/index-embeddings`,
        { method: "POST" },
      );
      setTask("index", {
        status: "done",
        detail: undefined,
        result: `Terindeks ${result.videos} video, ${result.ideas} ide, ${result.trends} tren.`,
        progress: 100,
        data: result,
      });
      window.dispatchEvent(new CustomEvent("traveltok:refresh"));
    } catch (err) {
      setTask("index", {
        status: "failed",
        detail: undefined,
        result: undefined,
        error: friendlyError(err),
        progress: 0,
      });
    }
  })();
}

export function dismissTask(kind: TaskKind) {
  tasks.delete(kind);
  emit();
}

export function getTasks(): Task[] {
  return [...tasks.values()];
}

export function getTask(kind: TaskKind): Task | undefined {
  return tasks.get(kind);
}

export function onTasksChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useTasks(): Task[] {
  const [snapshot, setSnapshot] = useState<Task[]>(getTasks);
  useEffect(() => {
    const unsub = onTasksChange(setSnapshot);
    return unsub;
  }, []);
  return snapshot;
}

export function useAnalyzeState(): AnalyzeState {
  const snapshot = useTasks();
  const t = snapshot.find((x) => x.kind === "analyze");
  if (!t) return IDLE_ANALYZE;
  return {
    running: t.status === "running",
    done: t.count ?? 0,
    total: t.total ?? t.count ?? 0,
    cancelled: t.status === "stopped",
  };
}