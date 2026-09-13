"use client";

import { useEffect, useState } from "react";
import {
  getAnalyzeState,
  onAnalyzeChange,
  stopAnalyze,
} from "@/lib/analyze-store";
import { Button, Spinner } from "./ui";

export function AnalyzeNotification() {
  const [state, setState] = useState(getAnalyzeState());
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsub = onAnalyzeChange((s) => {
      setState(s);
      setDismissed(false);
      if (s.running) setVisible(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!state.running && visible) {
      const t = setTimeout(() => {
        setVisible(false);
        setDismissed(true);
      }, 6000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state.running, visible]);

  if (!visible || dismissed) return null;

  const percent =
    state.total > 0 ? Math.min(100, Math.round((state.done / state.total) * 100)) : 0;

  return (
    <div className="fixed bottom-32 right-4 z-[110] lg:bottom-24">
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1120]/95 px-4 py-3 shadow-2xl shadow-slate-200/50 dark:shadow-black/60 backdrop-blur-xl">
        {state.running && <Spinner className="mt-0.5 h-4 w-4 text-emerald-500 dark:text-emerald-400" />}
        <div className="min-w-0">
          {state.running && (
            <>
              <p className="text-sm text-slate-800 dark:text-slate-200">
                Menganalisis video {state.done} / {state.total}…
              </p>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                Bisa berpindah halaman — analisis tetap berjalan.
              </p>
            </>
          )}
          {!state.running && state.cancelled && (
            <p className="text-sm text-amber-600 dark:text-amber-300">
              Analisis dihentikan ({state.done} dari {state.total} video selesai).
            </p>
          )}
          {!state.running && !state.cancelled && state.total > 0 && (
            <p className="text-sm text-emerald-600 dark:text-emerald-300">
              Analisis selesai — {state.done} video diproses.
            </p>
          )}
          {state.running && state.total > 0 && (
            <div className="mt-2 h-1 w-44 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>
        {state.running && (
          <Button variant="danger" size="sm" onClick={() => stopAnalyze()}>
            Stop
          </Button>
        )}
        <button
          onClick={() => {
            setVisible(false);
            setDismissed(true);
          }}
          className="ml-1 shrink-0 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          title="Tutup"
        >
          ✕
        </button>
      </div>
    </div>
  );
}