"use client";

import { useEffect, useState } from "react";
import {
  getScrapingJob,
  onScrapingChange,
} from "@/lib/scraping-store";
import { Spinner } from "./ui";

export function ScrapingNotification() {
  const [job, setJob] = useState(getScrapingJob());
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsub = onScrapingChange((j) => {
      setJob(j);
      if (j.id !== dismissed) setVisible(true);
    });
    return unsub;
  }, [dismissed]);

  useEffect(() => {
    if (!job) return;
    if (job.status === "COMPLETED") {
      const t = setTimeout(() => {
        setVisible(false);
        setDismissed(job.id);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [job, dismissed]);

  const dismiss = () => {
    setVisible(false);
    if (job) setDismissed(job.id);
  };

  if (!job || !visible || job.id === dismissed) return null;

  const active = job.status === "QUEUED" || job.status === "RUNNING";

  return (
    <div className="fixed bottom-20 right-4 z-[100] lg:bottom-6">
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1120]/95 px-4 py-3 shadow-2xl shadow-slate-200/50 dark:shadow-black/60 backdrop-blur-xl">
        {active && <Spinner className="mt-0.5 h-4 w-4 text-emerald-500 dark:text-emerald-400" />}
        <div className="min-w-0">
          {active && (
            <p className="text-sm text-slate-800 dark:text-slate-200">
              Scraping{job.keyword ? ` "${job.keyword}"` : ""}…
            </p>
          )}
          {job.status === "COMPLETED" && (
            <p className="text-sm text-emerald-600 dark:text-emerald-300">
              Scrape selesai — {(job.totalResults ?? 0)} video tersimpan.
            </p>
          )}
          {job.status === "FAILED" && (
            <p className="text-sm text-red-600 dark:text-red-300">
              Scraping gagal{job.errorMessage ? `: ${job.errorMessage}` : "."}
            </p>
          )}
        </div>
        <button
          onClick={dismiss}
          className="ml-2 shrink-0 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          title="Tutup"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
