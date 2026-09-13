"use client";

import { useEffect, useRef, useState } from "react";
import {
  getTasks,
  onTasksChange,
  stopAnalyze,
  type Task,
  type TaskKind,
} from "@/lib/tasks-store";
import { Button, Spinner } from "./ui";
import { PlansIcon, SearchIcon, TrendsIcon, VideoIcon } from "./icons";

const KIND_META: Record<TaskKind, { label: string; Icon: (p: { style?: React.CSSProperties }) => React.ReactNode }> = {
  analyze: { label: "Analyze videos", Icon: VideoIcon },
  plan: { label: "Generate plan", Icon: PlansIcon },
  trend: { label: "Score trend", Icon: TrendsIcon },
  index: { label: "Re-index", Icon: SearchIcon },
};

const STATUS_ICON: Record<Task["status"], string> = {
  running: "text-emerald-500 dark:text-emerald-400",
  done: "text-emerald-600 dark:text-emerald-300",
  failed: "text-red-600 dark:text-red-400",
  stopped: "text-amber-600 dark:text-amber-300",
};

function parseStatus(task: Task) {
  if (task.status === "running") {
    return `${task.label}… ${task.detail ?? ""}`;
  }
  if (task.status === "done") return task.result ?? "Selesai.";
  if (task.status === "stopped") return task.result ?? "Dihentikan.";
  return task.error ?? "Gagal.";
}

export function TaskNotifications() {
  const [tasks, setTasks] = useState<Task[]>(getTasks);
  const [dismissed, setDismissed] = useState<Set<TaskKind>>(new Set());
  const [openKinds, setOpenKinds] = useState<Set<TaskKind>>(new Set());
  const prevStatusRef = useRef<Map<TaskKind, Task["status"]>>(new Map());

  useEffect(() => {
    const unsub = onTasksChange((snapshot) => {
      setTasks(snapshot);
      const prev = prevStatusRef.current;
      setDismissed((state) => {
        const next = new Set(state);
        for (const t of snapshot) {
          // Re-show only when a new run really started.
          if (t.status === "running" && prev.get(t.kind) !== "running") next.delete(t.kind);
        }
        return next;
      });
      prevStatusRef.current = new Map(snapshot.map((t) => [t.kind, t.status]));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const done = tasks.filter((t) => t.status !== "running");
    if (done.length === 0) return undefined;
    const timer = setTimeout(() => {
      setDismissed((prev) => {
        const next = new Set(prev);
        for (const d of done) next.add(d.kind);
        return next;
      });
    }, 6000);
    return () => clearTimeout(timer);
  }, [tasks]);

  const hide = (kind: TaskKind) => {
    setDismissed((prev) => new Set(prev).add(kind));
  };

  const toggleOpen = (kind: TaskKind) => {
    setOpenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const visible = tasks.filter((t) => !dismissed.has(t.kind));
  if (visible.length === 0) return null;

  const multiple = visible.length > 1;

  return (
    <div className="fixed bottom-36 right-4 z-[110] flex flex-col items-end gap-3 lg:bottom-24">
      {visible.map((task) => {
        const { Icon } = KIND_META[task.kind];
        const open = openKinds.has(task.kind) || !multiple;
        if (!open) {
          return (
            <button
              key={task.kind}
              onClick={() => toggleOpen(task.kind)}
              title={`${KIND_META[task.kind].label} — ${parseStatus(task)}`}
              className={`relative grid h-11 w-11 place-items-center rounded-full border shadow-2xl backdrop-blur transition-transform hover:scale-105 ${
                task.status === "running"
                  ? "border-slate-200 bg-white dark:border-white/10 dark:bg-[#0b1120]/95"
                  : "border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#0b1120]/95"
              }`}
            >
              {task.status === "running" ? (
                <Spinner className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <span className={STATUS_ICON[task.status]}>
                  <Icon style={{ width: 20, height: 20 }} />
                </span>
              )}
              {task.status === "running" && task.count != null && task.total != null && task.total > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                  {task.count}/{task.total}
                </span>
              )}
            </button>
          );
        }
        return (
          <div
            key={task.kind}
            className="flex flex-col items-start rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1120]/95 px-4 py-3 shadow-2xl shadow-slate-200/50 dark:shadow-black/60 backdrop-blur-xl"
          >
            <div className="flex w-full items-start gap-3">
              {task.status === "running" ? (
                <Spinner className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <span className={`mt-0.5 shrink-0 ${STATUS_ICON[task.status]}`}>
                  <Icon style={{ width: 16, height: 16 }} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                {task.status === "running" && (
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    {task.label}
                    {task.detail ? `… ${task.detail}` : "…"}
                  </p>
                )}
                {task.status === "done" && (
                  <p className="text-sm text-emerald-600 dark:text-emerald-300">
                    {task.result ?? `${task.label} selesai.`}
                  </p>
                )}
                {task.status === "failed" && (
                  <p className="text-sm text-red-600 dark:text-red-300">
                    {task.label} gagal{task.error ? `: ${task.error}` : "."}
                  </p>
                )}
                {task.status === "stopped" && (
                  <p className="text-sm text-amber-600 dark:text-amber-300">
                    {task.result ?? "Dihentikan."}
                  </p>
                )}
                {task.status === "running" && task.kind === "analyze" && task.total! > 0 && (
                  <div className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {task.status === "running" && task.kind === "analyze" && (
                  <Button variant="danger" size="sm" onClick={() => stopAnalyze()}>
                    Stop
                  </Button>
                )}
                {multiple && (
                  <button
                    onClick={() => toggleOpen(task.kind)}
                    className="grid h-7 w-7 place-items-center rounded-lg text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300"
                    title="Minimalkan"
                  >
                    —
                  </button>
                )}
                <button
                  onClick={() => hide(task.kind)}
                  className="grid h-7 w-7 place-items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  title="Tutup"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}