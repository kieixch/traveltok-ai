"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ProjectPicker } from "@/components/ProjectPicker";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { api, formatNumber } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { getProjectId } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import type {
  EmbeddingEntityType,
  SearchHit,
  SearchIndexMeta,
} from "@/lib/types";

const TYPE_LABELS: Record<EmbeddingEntityType, string> = {
  VIDEO: "Videos",
  IDEA: "Ideas",
  TREND: "Trends",
};

function SearchInner() {
  const [projectId, setProjectId] = useState<string | null>(() => getProjectId());
  const [query, setQuery] = useState("");
  const [entityTypes, setEntityTypes] = useState<EmbeddingEntityType[]>([
    "VIDEO",
    "IDEA",
    "TREND",
  ]);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [indexNotice, setIndexNotice] = useState<string | null>(null);

  const meta = useApi<SearchIndexMeta>(
    projectId ? `/semantic-search/meta?projectId=${projectId}` : null,
  );

  const toggleType = (type: EmbeddingEntityType) => {
    setEntityTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const runSearch = async () => {
    if (!projectId || query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    try {
      setHits(
        await api<SearchHit[]>("/semantic-search", {
          query: { projectId, q: query.trim(), entityTypes: entityTypes.join(",") },
        }),
      );
    } catch (err) {
      setHits(null);
      setError(friendlyError(err));
    } finally {
      setSearching(false);
    }
  };

  const runIndex = async () => {
    if (!projectId) return;
    setIndexing(true);
    setIndexNotice(null);
    try {
      const result = await api<{
        videos: number;
        ideas: number;
        trends: number;
        model: string;
      }>(`/projects/${projectId}/index-embeddings`, { method: "POST" });
      setIndexNotice(
        `Indexed ${result.videos} videos, ${result.ideas} ideas, ${result.trends} trends.`,
      );
      await meta.refresh();
    } catch (err) {
      setIndexNotice(null);
      setError(friendlyError(err));
    } finally {
      setIndexing(false);
    }
  };

  const canSearch = Boolean(projectId) && query.trim().length >= 2;

  return (
    <div>
      <PageHeader
        title="Search"
        description="Semantic search across videos, ideas and trends via embeddings."
        action={<ProjectPicker projectId={projectId} onChange={setProjectId} />}
      />

      {!projectId && (
        <div className="mb-6">
          <Alert kind="info">
            Select a specific project above to search and index embeddings.
          </Alert>
        </div>
      )}

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-72 flex-1">
            <Label htmlFor="search-query">Query</Label>
            <Input
              id="search-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
              placeholder="e.g. hidden beaches in Bali"
            />
          </div>
          <Button onClick={() => void runSearch()} loading={searching} disabled={!canSearch}>
            Search
          </Button>
          <Button
            variant="secondary"
            onClick={() => void runIndex()}
            loading={indexing}
            disabled={!projectId}
          >
            Re-index
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Include:</span>
          {(["VIDEO", "IDEA", "TREND"] as EmbeddingEntityType[]).map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                entityTypes.includes(type)
                  ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-300"
                  : "border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
          {meta.data && (
            <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">
              {meta.data.total} indexed
              {meta.data.model ? ` · ${meta.data.model}` : ""}
            </span>
          )}
        </div>
        {indexNotice && <div className="mt-3"><Alert kind="success">{indexNotice}</Alert></div>}
      </Card>

      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

      {meta.data && !meta.data.indexed && (
        <div className="mb-4">
          <Alert kind="info">
            Nothing is indexed yet. Scrape real data for this project, then click
            &quot;Re-index&quot; to build the embedding index.
          </Alert>
        </div>
      )}

      <Card>
        <CardHeader title="Results" subtitle="Ranked by cosine similarity." />
        <div className="px-5 py-4">
          {searching ? (
            <div className="flex justify-center py-10 text-slate-500 dark:text-slate-400">
              <Spinner className="h-6 w-6" />
            </div>
          ) : hits && hits.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {hits.map((hit) => (
                <li key={`${hit.entityType}-${hit.entityId}`} className="py-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge color={hit.entityType === "VIDEO" ? "green" : "slate"}>
                      {TYPE_LABELS[hit.entityType]}
                    </Badge>
                    <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {(hit.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-2 font-medium text-slate-900 dark:text-slate-100">
                    {hit.entityType === "VIDEO"
                      ? hit.entity?.caption ?? "Untitled video"
                      : hit.entityType === "IDEA"
                        ? hit.entity?.title ?? "Untitled idea"
                        : hit.entity?.keyword
                          ? `#${hit.entity.keyword}`
                          : "Untitled trend"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{hit.content}</p>
                  {hit.entityType === "VIDEO" && hit.entity && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      {hit.entity.creatorUsername && <span>@{hit.entity.creatorUsername}</span>}
                      {hit.entity.location && <span>{hit.entity.location}</span>}
                      {hit.entity.views != null && (
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          {formatNumber(hit.entity.views)} views
                        </span>
                      )}
                      {hit.entity.url && (
                        <a
                          href={hit.entity.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:underline"
                        >
                          View on TikTok ↗
                        </a>
                      )}
                    </div>
                  )}
                  {hit.entityType === "IDEA" && hit.entity?.hashtags && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {hit.entity.hashtags.map((h) => `#${h}`).join(" ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : hits !== null ? (
            <EmptyState message="No matches — try a different query." />
          ) : (
            <EmptyState message="Enter a query to search." />
          )}
        </div>
      </Card>
    </div>
  );
}

export default function SearchPage() {
  return (
    <RequireAuth>
      <SearchInner />
    </RequireAuth>
  );
}
