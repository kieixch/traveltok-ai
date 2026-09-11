"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ProjectSelect } from "@/components/ProjectSelect";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { getProjectId } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import { formatNumber } from "@/lib/api";

interface VideoCreator {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface VideoMetric {
  views: bigint;
  likes: bigint;
  comments: bigint;
  shares: bigint;
}

interface VideoItem {
  id: string;
  externalId: string;
  caption: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  scrapedAt: string | null;
  duration: number | null;
  location: string | null;
  creator: VideoCreator;
  metrics: VideoMetric[];
}

interface VideoPage {
  items: VideoItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const SORTS = [
  { value: "scrapedAt", label: "Scraped" },
  { value: "publishedAt", label: "Published" },
  { value: "views", label: "Views" },
  { value: "likes", label: "Likes" },
] as const;

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(sec: number | null): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

function VideosInner() {
  const [projectId, setProjectId] = useState<string | null>(() => getProjectId());
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("scrapedAt");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const pageSize = 20;

  const sortParam = sort === "views" || sort === "likes"
    ? `&sort=${sort}&order=desc`
    : `&sort=${sort}&order=desc`;

  const url = `/videos?page=${page}&pageSize=${pageSize}${sortParam}${projectId ? `&projectId=${projectId}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`;

  const data = useApi<VideoPage>(url);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  return (
    <div>
      <PageHeader
        title="Videos"
        description="All scraped TikTok videos with dates and metrics."
        action={<ProjectSelect projectId={projectId} onChange={(id) => { setProjectId(id); setPage(1); }} />}
      />

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-64 flex-1">
            <Label htmlFor="video-search">Search captions</Label>
            <Input
              id="video-search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="e.g. Nusa Penida sunset"
            />
          </div>
          <Button onClick={handleSearch} disabled={!projectId}>
            Search
          </Button>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/5">
            {SORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => { setSort(s.value); setPage(1); }}
                className={`rounded-md px-3 py-1 text-sm transition-colors ${
                  sort === s.value
                    ? "bg-white font-medium text-emerald-600 shadow-sm dark:bg-white/10 dark:text-emerald-300"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {data.error && <div className="mb-4"><Alert kind="error">{data.error}</Alert></div>}

      <Card>
        {data.loading ? (
          <div className="flex justify-center py-12 text-slate-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : data.data && data.data.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-white/10">
                  <tr>
                    <th className="px-5 py-3 font-medium">Video</th>
                    <th className="px-5 py-3 font-medium">Creator</th>
                    <th className="px-5 py-3 text-right font-medium">Scraped</th>
                    <th className="px-5 py-3 text-right font-medium">Published</th>
                    <th className="px-5 py-3 text-right font-medium">Duration</th>
                    <th className="px-5 py-3 text-right font-medium">Views</th>
                    <th className="px-5 py-3 text-right font-medium">Likes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {data.data.items.map((v) => {
                    const m = v.metrics[0];
                    return (
                      <tr key={v.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                        <td className="max-w-xs px-5 py-3">
                          {v.url ? (
                            <a
                              href={v.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="line-clamp-2 font-medium text-slate-900 hover:text-emerald-600 hover:underline dark:text-slate-100 dark:hover:text-emerald-300"
                            >
                              {v.caption ?? "Untitled video"}
                            </a>
                          ) : (
                            <span className="line-clamp-2 font-medium text-slate-900 dark:text-slate-100">
                              {v.caption ?? "Untitled video"}
                            </span>
                          )}
                          {v.location && (
                            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{v.location}</p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400">
                          @{v.creator.username}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-sm text-slate-500 dark:text-slate-400">
                          <span title={v.scrapedAt ?? ""}>{relativeTime(v.scrapedAt)}</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-sm text-slate-400 dark:text-slate-500">
                          <span title={v.publishedAt ?? ""}>{relativeTime(v.publishedAt)}</span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-sm tabular-nums text-slate-400 dark:text-slate-500">
                          {formatDuration(v.duration)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-sm tabular-nums font-medium text-slate-900 dark:text-slate-200">
                          {m ? formatNumber(Number(m.views)) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right text-sm tabular-nums text-slate-400 dark:text-slate-500">
                          {m ? formatNumber(Number(m.likes)) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data.data.totalPages > 1 && (
              <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/90 px-5 py-3 backdrop-blur dark:border-white/10 dark:bg-[#0b1120]/90">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {data.data.total} videos · page {data.data.page} of {data.data.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(data.data!.totalPages, p + 1))}
                    disabled={page >= data.data.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-5">
            <EmptyState message="No videos yet — scrape some TikTok data to get started." />
          </div>
        )}
      </Card>
    </div>
  );
}

export default function VideosPage() {
  return (
    <RequireAuth>
      <VideosInner />
    </RequireAuth>
  );
}
