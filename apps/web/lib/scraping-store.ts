import type { ScrapingJob } from "./types";

type Listener = (job: ScrapingJob) => void;

let currentJob: ScrapingJob | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

const POLL_MS = 1500;
const MAX_TICKS = Math.ceil((20 * 60 * 1000) / POLL_MS);

function emit(job: ScrapingJob) {
  currentJob = job;
  for (const fn of listeners) fn(job);
}

function stopPoll() {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

async function pollTick(jobId: string, attempts: number) {
  try {
    const { api } = await import("./api");
    const current = await api<ScrapingJob>(`/scraping-jobs/${jobId}`);
    emit(current);
    if (current.status === "COMPLETED" || current.status === "FAILED") {
      window.dispatchEvent(new CustomEvent("traveltok:refresh"));
      return;
    }
    if (attempts >= MAX_TICKS) return;
    pollTimer = setTimeout(() => void pollTick(jobId, attempts + 1), POLL_MS);
  } catch {
    pollTimer = setTimeout(() => void pollTick(jobId, attempts + 1), POLL_MS);
  }
}

export function startScraping(job: ScrapingJob) {
  stopPoll();
  emit(job);
  if (job.status !== "COMPLETED" && job.status !== "FAILED") {
    pollTimer = setTimeout(() => void pollTick(job.id, 0), POLL_MS);
  }
}

export function getScrapingJob(): ScrapingJob | null {
  return currentJob;
}

export function onScrapingChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
