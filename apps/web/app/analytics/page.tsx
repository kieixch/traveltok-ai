"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ProjectPicker } from "@/components/ProjectPicker";
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { formatNumber, formatPercent } from "@/lib/api";
import { getProjectId } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import type { CreatorPerformance, HashtagPerformance } from "@/lib/types";

const SORTS = [
  { value: "followers", label: "Followers" },
  { value: "views", label: "Views" },
  { value: "engagement", label: "Engagement" },
] as const;

function AnalyticsInner() {
  const [projectId, setProjectId] = useState<string | null>(() => getProjectId());
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("followers");

  const creators = useApi<CreatorPerformance[]>(
    `/analytics/creators?sort=${sort}&limit=10${projectId ? `&projectId=${projectId}` : ""}`,
  );
  const hashtags = useApi<HashtagPerformance[]>(
    `/analytics/hashtags?limit=15${projectId ? `&projectId=${projectId}` : ""}`,
  );

  return (
    <div>
      <PageHeader
        title="Analytics"
        description={
          projectId
            ? "Top creators and hashtags across the selected project."
            : "Top creators and hashtags across all projects."
        }
        action={<ProjectPicker projectId={projectId} onChange={setProjectId} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            title="Top creators"
            subtitle={projectId ? "Ranked by the selected metric." : "Across all projects."}
            action={
              <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 dark:bg-white/5 p-1">
                {SORTS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSort(s.value)}
                    className={`whitespace-nowrap rounded-md px-3 py-1 text-sm transition-colors ${
                      sort === s.value
                        ? "bg-slate-200 dark:bg-white/10 font-medium text-emerald-600 dark:text-emerald-300 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            }
          />
          <div className="overflow-x-auto">
            {creators.loading ? (
              <div className="flex justify-center py-12 text-slate-500 dark:text-slate-400">
                <Spinner className="h-5 w-5" />
              </div>
            ) : creators.error ? (
              <div className="p-5"><Alert kind="error">{creators.error}</Alert></div>
            ) : creators.data && creators.data.length > 0 ? (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-white/10 text-xs uppercase text-slate-400 dark:text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Creator</th>
                    <th className="px-5 py-3 text-right font-medium">Videos</th>
                    <th className="px-5 py-3 text-right font-medium">Total views</th>
                    <th className="px-5 py-3 text-right font-medium">Followers</th>
                    <th className="px-5 py-3 text-right font-medium">Eng. rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {creators.data.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-white/5">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {c.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.avatarUrl}
                              alt={c.username}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-400/10 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                              @{c.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            {c.profileUrl ? (
                              <a
                                href={c.profileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-300 hover:underline"
                              >
                                @{c.username}
                              </a>
                            ) : (
                              <p className="font-medium text-slate-900 dark:text-slate-100">@{c.username}</p>
                            )}
                            {c.displayName && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">{c.displayName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {c.videoCount}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {formatNumber(c.totalViews)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {formatNumber(c.followers ?? 0)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Badge color="blue">
                          {formatPercent(c.avgEngagementRate)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-5"><EmptyState message="No creator data yet." /></div>
            )}
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Top hashtags" subtitle="By number of videos." />
          <div className="px-5 py-4">
            {hashtags.loading ? (
              <div className="flex justify-center py-8 text-slate-500 dark:text-slate-400">
                <Spinner className="h-5 w-5" />
              </div>
            ) : hashtags.error ? (
              <Alert kind="error">{hashtags.error}</Alert>
            ) : hashtags.data && hashtags.data.length > 0 ? (
              <ul className="space-y-3">
                {hashtags.data.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        #{h.normalizedName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatNumber(h.totalViews)} views · {formatPercent(h.avgEngagementRate)}
                      </p>
                    </div>
                    <Badge color="green">{h.videoCount} videos</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState message="No hashtag data yet." />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <RequireAuth>
      <AnalyticsInner />
    </RequireAuth>
  );
}
