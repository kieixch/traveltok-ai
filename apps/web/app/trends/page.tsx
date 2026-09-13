"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ProjectSelect } from "@/components/ProjectSelect";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Dropdown,
  type DropdownOption,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { formatPercent } from "@/lib/api";
import { getProjectId } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import { startScoreTrend, useTasks } from "@/lib/tasks-store";
import type { Paginated, Trend, TrendScoreResult } from "@/lib/types";

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function TrendsInner() {
  const [projectId, setProjectId] = useState<string | null>(() => getProjectId());
  const [keyword, setKeyword] = useState("");
  const [hashtag, setHashtag] = useState("");
  const [periodDays, setPeriodDays] = useState(30);
  const tasks = useTasks();
  const trendTask = tasks.find((t) => t.kind === "trend");
  const scoring = trendTask?.status === "running";
  const score = trendTask && trendTask.status === "done"
    ? (trendTask.data as TrendScoreResult | undefined) ?? null
    : null;
  const scoreError = trendTask && trendTask.status === "failed" && trendTask.error
    ? trendTask.error
    : null;

  const trends = useApi<Paginated<Trend>>(
    projectId
      ? `/trends?projectId=${projectId}&pageSize=30`
      : `/trends?pageSize=30`,
  );

  const runScore = () => {
    if (!projectId) return;
    startScoreTrend(
      { projectId, keyword, hashtag, periodDays },
      `Score "${keyword || hashtag || "term"}"`,
    );
  };

  return (
    <div>
      <PageHeader
        title="Trends"
        description="Score a keyword or hashtag against the selected project."
        action={<ProjectSelect projectId={projectId} onChange={setProjectId} />}
      />

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-52">
            <Label htmlFor="trend-keyword">Keyword</Label>
            <Input
              id="trend-keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. Nusa Penida"
            />
          </div>
          <div className="min-w-44">
            <Label htmlFor="trend-hashtag">Hashtag</Label>
            <Input
              id="trend-hashtag"
              value={hashtag}
              onChange={(e) => setHashtag(e.target.value)}
              placeholder="e.g. travelexplore"
            />
          </div>
          <div className="w-36">
            <Label htmlFor="trend-period">Window (days)</Label>
            <Dropdown
              id="trend-period"
              value={String(periodDays)}
              onChange={(v) => setPeriodDays(Number(v))}
              options={[14, 30, 60, 90].map(
                (n): DropdownOption => ({ value: String(n), label: `${n} days` }),
              )}
            />
          </div>
          <Button onClick={runScore} loading={scoring}>
            Score trend
          </Button>
        </div>
        {scoreError && (
          <div className="mt-3"><Alert kind="error">{scoreError}</Alert></div>
        )}
      </Card>

      {score && (
        <Card className="mb-6">
          <CardHeader
            title="Trend score"
            subtitle={`${keyword || hashtag || "term"} · ${score.matchingVideos} matching videos of ${score.totalVideos} · ${formatPercent(
              score.engagementScore / 20,
            )} avg engagement`}
          />
          <div className="grid gap-6 px-5 py-5 lg:grid-cols-2">
            <div className="space-y-4">
              <ScoreBar label="Trend score" value={score.trendScore} />
              <ScoreBar label="Opportunity" value={score.opportunityScore} />
              <ScoreBar label="Growth rate" value={score.growthRate / 2} />
            </div>
            <div className="space-y-4">
              <ScoreBar label="Engagement" value={score.engagementScore} />
              <ScoreBar label="Frequency" value={score.frequencyScore} />
              <ScoreBar label="Recency" value={score.recencyScore} />
              <ScoreBar label="Content gap" value={score.contentGapScore} />
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Saved trends" subtitle="Trends tracked for this project." />
        <div className="px-5 py-4">
          {trends.loading ? (
            <div className="flex justify-center py-8 text-slate-500 dark:text-slate-400">
              <Spinner className="h-5 w-5" />
            </div>
          ) : trends.error ? (
            <Alert kind="error">{trends.error}</Alert>
          ) : trends.data && trends.data.items.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {trends.data.items.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100">#{t.keyword}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.type} · period starting {new Date(t.periodStart).toLocaleDateString()}
                    </p>
                  </div>
                  {t.trendScore != null && (
                    <Badge color={t.trendScore >= 50 ? "green" : "slate"}>
                      {t.trendScore.toFixed(0)} trend
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No saved trends yet." />
          )}
        </div>
      </Card>
    </div>
  );
}

export default function TrendsPage() {
  return (
    <RequireAuth>
      <TrendsInner />
    </RequireAuth>
  );
}
