"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { ProjectPicker } from "@/components/ProjectPicker";
import { AreaChart, Donut, ProgressList } from "@/components/charts";
import {
  AnalyticsIcon,
  IdeasIcon,
  MapPinIcon,
  PlaneIcon,
  SparklesIcon,
  TrendsIcon,
} from "@/components/icons";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
} from "@/components/ui";
import { api, formatNumber, formatPercent } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { getProjectId } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import type {
  EngagementBucket,
  Opportunity,
  Overview,
  Paginated,
  Project,
  ProjectInsights,
} from "@/lib/types";

function DashboardInner() {
  const [projectId, setProjectId] = useState<string | null>(() => getProjectId());
  const [bucket, setBucket] = useState<"day" | "week" | "month">("week");

  const allProjects = !projectId;

  const overview = useApi<Overview>(
    `/analytics/overview${projectId ? `?projectId=${projectId}` : ""}`,
  );
  const engagement = useApi<EngagementBucket[]>(
    `/analytics/engagement?bucket=${bucket}${projectId ? `&projectId=${projectId}` : ""}`,
  );
  const insights = useApi<ProjectInsights>(
    projectId ? `/projects/${projectId}/insights` : null,
  );
  const opportunities = useApi<Opportunity[]>(
    `/analytics/opportunities?limit=5${projectId ? `&projectId=${projectId}` : ""}`,
  );

  const areaData = (engagement.data ?? []).map((e) => ({
    label: e.bucket,
    value: e.views,
  }));

  const topDestinations = (insights.data?.topDestinations ?? []).slice(0, 5);
  const topTopics = (insights.data?.topTopics ?? []).slice(0, 6);
  const destinationTotal = topDestinations.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Project performance at a glance."
        action={<ProjectPicker projectId={projectId} onChange={setProjectId} />}
      />

      {overview.loading && (
        <div className="flex justify-center py-16 text-slate-500 dark:text-slate-400">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      {overview.error && <Alert kind="error">{overview.error}</Alert>}

      {overview.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Videos"
              value={formatNumber(overview.data.videoCount)}
              hint={`${overview.data.videosLast30d} published in last 30 days`}
              icon={<PlaneIcon style={{ width: 18, height: 18 }} />}
              accent="emerald"
            />
            <StatCard
              label="Total views"
              value={formatNumber(overview.data.totalViews)}
              hint={`${formatNumber(overview.data.avgViews)} avg per video`}
              icon={<SparklesIcon style={{ width: 18, height: 18 }} />}
              accent="cyan"
            />
            <StatCard
              label="Avg engagement rate"
              value={formatPercent(overview.data.avgEngagementRate)}
              hint={`${formatNumber(overview.data.totalLikes)} likes total`}
              icon={<TrendsIcon style={{ width: 18, height: 18 }} />}
              accent="violet"
            />
            <StatCard
              label="Creators"
              value={formatNumber(overview.data.creatorCount)}
              hint={`${overview.data.completedJobs} completed scraping jobs`}
              icon={<MapPinIcon style={{ width: 18, height: 18 }} />}
              accent="amber"
            />
          </div>

          {allProjects && <ProjectBreakdown />}

          {insights.error && (
            <div className="mt-6"><Alert kind="error">{insights.error}</Alert></div>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Engagement over time"
                subtitle="Total views by publish date."
                action={
                  <select
                    value={bucket}
                    onChange={(e) => setBucket(e.target.value as typeof bucket)}
                    className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-800 dark:text-slate-200"
                  >
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                  </select>
                }
              />
              <div className="px-5 py-6">
                <AreaChart
                  data={areaData}
                  format={(v) => formatNumber(v)}
                  height={220}
                />
              </div>
            </Card>

            {projectId && (
              <Card>
                <CardHeader
                  title="Top destinations"
                  subtitle="From analyzed videos"
                />
                <div className="px-5 py-6">
                  {insights.loading ? (
                    <div className="flex justify-center py-8 text-slate-500 dark:text-slate-400">
                      <Spinner className="h-5 w-5" />
                    </div>
                  ) : topDestinations.length > 0 ? (
                    <Donut
                      segments={topDestinations.map((d) => ({
                        label: d.destination,
                        value: d.count,
                      }))}
                      centerValue={formatNumber(destinationTotal)}
                      centerLabel="videos"
                    />
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      No destination data yet — analyze videos to unlock insights.
                    </p>
                  )}
                </div>
              </Card>
            )}
          </div>

          {projectId && (
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader title="Top topics" subtitle="Trending subjects" />
                <div className="px-5 py-5">
                  {insights.loading ? (
                    <div className="flex justify-center py-8 text-slate-500 dark:text-slate-400">
                      <Spinner className="h-5 w-5" />
                    </div>
                  ) : topTopics.length > 0 ? (
                    <ProgressList
                      items={topTopics.map((t) => ({ label: t.topic, value: t.count }))}
                    />
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500">No topics yet.</p>
                  )}
                </div>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader title="AI insights" subtitle="Top recommendations" />
                <div className="px-5 py-5">
                  {insights.loading ? (
                    <div className="flex justify-center py-8 text-slate-500 dark:text-slate-400">
                      <Spinner className="h-5 w-5" />
                    </div>
                  ) : insights.data && insights.data.recommendations.length > 0 ? (
                    <ul className="space-y-2">
                      {insights.data.recommendations.slice(0, 5).map((r, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 rounded-xl bg-slate-100 dark:bg-white/5 px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-200 ring-1 ring-inset ring-slate-100 dark:ring-white/5"
                        >
                          <SparklesIcon
                            style={{ width: 15, height: 15 }}
                            className="mt-0.5 shrink-0 text-emerald-500 dark:text-emerald-400"
                          />
                          {r}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      No insights yet — analyze videos to unlock recommendations.
                    </p>
                  )}
                </div>
              </Card>
            </div>
          )}

          <div className="mt-6">
            <Card>
              <CardHeader title="Opportunities" subtitle="High-potential content angles in this dataset." />
              <div className="px-5 py-4">
                {opportunities.loading ? (
                  <div className="flex justify-center py-8 text-slate-500 dark:text-slate-400">
                    <Spinner className="h-5 w-5" />
                  </div>
                ) : opportunities.error ? (
                  <Alert kind="error">{opportunities.error}</Alert>
                ) : opportunities.data && opportunities.data.length > 0 ? (
                  <ul className="divide-y divide-slate-200 dark:divide-white/5">
                    {opportunities.data.map((o, i) => (
                      <li key={`${o.type}-${o.label}`} className="flex items-center gap-4 py-3">
                        <span className="w-6 text-sm font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                            {o.label}
                            <span className="ml-2 text-xs font-normal uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              {o.type.toLowerCase()}
                            </span>
                          </p>
                          <p className="line-clamp-1 text-xs text-slate-400 dark:text-slate-500">{o.reasoning}</p>
                        </div>
                        <span className="w-24 shrink-0">
                          <span className="block text-right text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-300">
                            {o.opportunityScore.toFixed(0)}
                          </span>
                          <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                            <span
                              className="block h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                              style={{ width: `${o.opportunityScore}%` }}
                            />
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState message="No opportunities found yet — load data and analyze videos." />
                )}
              </div>
            </Card>
          </div>

          {projectId && (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title="Top video" />
                <div className="px-5 py-4">
                  {overview.data.topVideo ? (
                    <div>
                      <a
                        href={overview.data.topVideo.url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="line-clamp-2 font-medium text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-300 hover:underline"
                      >
                        {overview.data.topVideo.caption ?? "Untitled video"}
                      </a>
                      <div className="mt-2 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                        <span>{overview.data.topVideo.creatorUsername}</span>
                        <span>·</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                          {formatNumber(overview.data.topVideo.views)} views
                        </span>
                      </div>
                    </div>
                  ) : (
                    <EmptyState message="No videos yet." />
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader title="Top creator" />
                <div className="px-5 py-4">
                  {overview.data.topCreator ? (
                    <div>
                      {overview.data.topCreator.profileUrl ? (
                        <a
                          href={overview.data.topCreator.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-300 hover:underline"
                        >
                          @{overview.data.topCreator.username}
                        </a>
                      ) : (
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          @{overview.data.topCreator.username}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                        <span>
                          {formatNumber(overview.data.topCreator.followers ?? 0)} followers
                        </span>
                        <span>·</span>
                        <span>{overview.data.topCreator.videoCount} videos</span>
                      </div>
                    </div>
                  ) : (
                    <EmptyState message="No creators yet." />
                  )}
                </div>
              </Card>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/ideas">
              <Button>
                <IdeasIcon style={{ width: 16, height: 16 }} />
                Generate content ideas
              </Button>
            </Link>
            <Link href="/plans">
              <Button variant="secondary">
                <SparklesIcon style={{ width: 16, height: 16 }} />
                Build a content plan
              </Button>
            </Link>
            <Link href="/trends">
              <Button variant="secondary">
                <TrendsIcon style={{ width: 16, height: 16 }} />
                Explore trends
              </Button>
            </Link>
            {projectId && (
              <Button
                variant="secondary"
                onClick={() => void insights.refresh()}
                disabled={insights.loading}
              >
                <AnalyticsIcon style={{ width: 16, height: 16 }} />
                Refresh insights
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ProjectBreakdown() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [overviews, setOverviews] = useState<Map<string, Overview>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const paginated = await api<Paginated<Project>>("/projects", {
          query: { pageSize: 100 },
        });
        const items = paginated.items ?? [];
        if (cancelled) return;
        setProjects(items);

        const results = await Promise.allSettled(
          items.map((p) =>
            api<Overview>(`/analytics/overview?projectId=${p.id}`),
          ),
        );
        if (cancelled) return;
        const map = new Map<string, Overview>();
        results.forEach((r, i) => {
          if (r.status === "fulfilled") map.set(items[i].id, r.value);
        });
        setOverviews(map);
      } catch (err) {
        if (!cancelled) setError(friendlyError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="mt-6">
        <Card>
          <CardHeader title="Per-project breakdown" subtitle="Loading project data…" />
          <div className="flex justify-center py-8 text-slate-500 dark:text-slate-400">
            <Spinner className="h-5 w-5" />
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6">
        <Alert kind="error">{error}</Alert>
      </div>
    );
  }

  const projectOverviews = projects
    .map((p) => ({ project: p, overview: overviews.get(p.id) }))
    .filter((e): e is { project: Project; overview: Overview } => Boolean(e.overview));

  if (projectOverviews.length === 0) return null;

  return (
    <div className="mt-6">
      <Card>
        <CardHeader
          title="Per-project breakdown"
          subtitle={`${projectOverviews.length} project${projectOverviews.length !== 1 ? "s" : ""} with data`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-white/10 text-xs uppercase text-slate-400 dark:text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 text-right font-medium">Videos</th>
                <th className="px-5 py-3 text-right font-medium">Total views</th>
                <th className="px-5 py-3 text-right font-medium">Avg views</th>
                <th className="px-5 py-3 text-right font-medium">Eng. rate</th>
                <th className="px-5 py-3 text-right font-medium">Creators</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {projectOverviews.map(({ project, overview }) => (
                <tr key={project.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-white/5">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{project.name}</p>
                    {project.niche && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{project.niche}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {overview.videoCount}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {formatNumber(overview.totalViews)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {formatNumber(overview.avgViews)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="rounded-lg bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                      {formatPercent(overview.avgEngagementRate)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {overview.creatorCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function HomePage() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}
