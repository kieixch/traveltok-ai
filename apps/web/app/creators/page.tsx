"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ProjectSelect } from "@/components/ProjectSelect";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  Spinner,
} from "@/components/ui";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { getProjectId } from "@/lib/auth";
import type { Creator, Paginated } from "@/lib/types";

const SORTS: Array<{ value: string; label: string }> = [
  { value: "followers", label: "Followers" },
  { value: "following", label: "Following" },
  { value: "totalLikes", label: "Total likes" },
  { value: "videoCount", label: "Video count" },
  { value: "totalViews", label: "Total views" },
  { value: "avgEngagementRate", label: "Avg engagement" },
  { value: "createdAt", label: "Recently added" },
];

function CreatorsInner() {
  const [projectId, setProjectId] = useState<string | null>(() => getProjectId());
  const [search, setSearch] = useState("");
  const [minFollowers, setMinFollowers] = useState("");
  const [minViews, setMinViews] = useState("");
  const [minEngagement, setMinEngagement] = useState("");
  const [sort, setSort] = useState("followers");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [applied, setApplied] = useState({
    search: "",
    minFollowers: "",
    minViews: "",
    minEngagement: "",
    sort,
    order,
  });

  const [data, setData] = useState<Paginated<Creator> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api<Paginated<Creator>>("/creators", {
          query: {
            page,
            pageSize,
            projectId: projectId ?? undefined,
            search: applied.search,
            sort: applied.sort,
            order: applied.order,
            minFollowers: applied.minFollowers ? Number(applied.minFollowers) : undefined,
            minViews: applied.minViews ? Number(applied.minViews) : undefined,
            minEngagement: applied.minEngagement ? Number(applied.minEngagement) : undefined,
          },
        });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(friendlyError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [applied, page, pageSize, projectId]);

  const apply = () => {
    setApplied({
      search,
      minFollowers,
      minViews,
      minEngagement,
      sort,
      order,
    });
    setPage(1);
  };

  const changeSort = (value: string) => {
    setSort(value);
    setApplied((prev) => ({ ...prev, sort: value }));
    setPage(1);
  };

  const changeOrder = (value: "asc" | "desc") => {
    setOrder(value);
    setApplied((prev) => ({ ...prev, order: value }));
    setPage(1);
  };

  const totalPages = data?.totalPages ?? 1;

  return (
    <div>
      <PageHeader
        title="Creators"
        description="All creators discovered from scraped videos, with live performance metrics."
        action={<ProjectSelect projectId={projectId} onChange={setProjectId} />}
      />

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-52 flex-1">
            <Label htmlFor="creator-search">Search</Label>
            <Input
              id="creator-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
              }}
              placeholder="Username or display name"
            />
          </div>
          <div className="w-36">
            <Label htmlFor="creator-followers">Min followers</Label>
            <Input
              id="creator-followers"
              type="number"
              min={0}
              value={minFollowers}
              onChange={(e) => setMinFollowers(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="w-36">
            <Label htmlFor="creator-views">Min views</Label>
            <Input
              id="creator-views"
              type="number"
              min={0}
              value={minViews}
              onChange={(e) => setMinViews(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="w-36">
            <Label htmlFor="creator-engagement">Min engagement (%)</Label>
            <Input
              id="creator-engagement"
              type="number"
              min={0}
              step="0.1"
              value={minEngagement}
              onChange={(e) => setMinEngagement(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="w-44">
            <Label htmlFor="creator-sort">Sort by</Label>
            <Select id="creator-sort" value={sort} onChange={(e) => changeSort(e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-32">
            <Label htmlFor="creator-order">Order</Label>
            <Select
              id="creator-order"
              value={order}
              onChange={(e) => changeOrder(e.target.value as "asc" | "desc")}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </Select>
          </div>
          <Button onClick={apply}>Apply filters</Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Scraped creators"
          subtitle={data ? `${data.total} creator${data.total === 1 ? "" : "s"} found` : undefined}
        />
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-12 text-slate-500 dark:text-slate-400">
              <Spinner className="h-5 w-5" />
            </div>
          ) : error ? (
            <Alert kind="error">{error}</Alert>
          ) : data && data.items.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      <th className="px-3 py-2">Creator</th>
                      <th className="px-3 py-2 text-right">Followers</th>
                      <th className="px-3 py-2 text-right">Following</th>
                      <th className="px-3 py-2 text-right">Likes</th>
                      <th className="px-3 py-2 text-right">Videos</th>
                      <th className="px-3 py-2 text-right">Views</th>
                      <th className="px-3 py-2 text-right">Engagement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {data.items.map((creator) => (
                      <tr key={creator.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-sm font-semibold text-white">
                              {creator.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={creator.avatarUrl}
                                  alt={creator.username}
                                  className="h-9 w-9 rounded-full object-cover"
                                />
                              ) : (
                                (creator.username || creator.displayName || "C")
                                  .trim()
                                  .charAt(0)
                                  .toUpperCase()
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                                {creator.displayName || creator.username}
                              </p>
                              {creator.profileUrl && (
                                <a
                                  href={creator.profileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-300"
                                >
                                  @{creator.username}
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-800 dark:text-slate-200">
                          {formatNumber(creator.followers ?? 0)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                          {formatNumber(creator.following ?? 0)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                          {formatNumber(Number(creator.totalLikes ?? 0))}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                          {creator.videoCount}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-800 dark:text-slate-200">
                          {formatNumber(creator.totalViews)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-300">
                          {creator.avgEngagementRate.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-slate-400 dark:text-slate-500">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <EmptyState message="No creators found. Scrape videos first to populate this list." />
          )}
        </div>
      </Card>
    </div>
  );
}

export default function CreatorsPage() {
  return (
    <RequireAuth>
      <CreatorsInner />
    </RequireAuth>
  );
}
