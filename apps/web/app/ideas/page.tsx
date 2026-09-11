"use client";

import { useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ProjectSelect } from "@/components/ProjectSelect";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dropdown,
  type DropdownOption,
  EmptyState,
  Input,
  Label,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { IdeasIcon, ScrapeIcon, SparklesIcon } from "@/components/icons";
import { api, formatNumber } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { getProjectId } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import { CONTENT_FORMATS, CONTENT_LANGUAGES } from "@/lib/types";
import type { ContentIdea, Paginated } from "@/lib/types";

type IdeaTab = "ideas" | "getIdeas";

function IdeaCard({ idea, onDeleted }: { idea: ContentIdea; onDeleted: () => void }) {
  const [busy, setBusy] = useState<"script" | "caption" | "delete" | null>(null);
  const [language, setLanguage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [detail, setDetail] = useState(idea);
  const [source] = useState(idea.sourceVideo ?? null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const generate = async (kind: "script" | "caption") => {
    setBusy(kind);
    setError(null);
    setSuccess(null);
    try {
      const updated = await api<ContentIdea>(
        `/content-ideas/${idea.id}/generate-${kind}`,
        {
          method: "POST",
          body: language ? { language } : {},
        },
      );
      setDetail(updated);
      setSuccess(kind === "script" ? "Script berhasil dibuat." : "Caption berhasil dibuat.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    setConfirmOpen(false);
    setBusy("delete");
    setError(null);
    setSuccess(null);
    try {
      await api(`/content-ideas/${idea.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(null);
    }
  };

  return (
    <>
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {detail.format && <Badge color="blue">{detail.format}</Badge>}
            <StatusBadge status={detail.status} />
            {detail.generatedBy === "AI" && <Badge color="green">AI</Badge>}
          </div>
          <h3 className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{detail.title}</h3>
          {detail.hook && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail.hook}</p>}
        </div>
        {detail.opportunityScore != null && (
          <div className="shrink-0 text-right">
            <p className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {detail.opportunityScore.toFixed(1)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">opportunity</p>
          </div>
        )}
      </div>

      {detail.concept && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{detail.concept}</p>
      )}

      {detail.hashtags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {detail.hashtags.slice(0, 8).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-300"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {source && (
        <a
          href={source.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 p-2 transition-colors hover:border-emerald-400/40 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-emerald-400/30"
        >
          {source.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source.thumbnailUrl}
              alt=""
              className="h-12 w-20 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="h-12 w-20 shrink-0 rounded-lg bg-slate-100 dark:bg-white/5" />
          )}
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Reference video
            </span>
            <span className="mt-0.5 block truncate text-sm text-slate-600 dark:text-slate-300">
              {source.caption ?? "Untitled video"}
            </span>
            <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-slate-500">
              @{source.creator.username ?? "unknown"} · opens in new tab
            </span>
          </span>
        </a>
      )}

      {error && (
        <div className="mt-3"><Alert kind="error">{error}</Alert>
        </div>
      )}
      {success && (
        <div className="mt-3"><Alert kind="success">{success}</Alert></div>
      )}

      {(detail.script || detail.caption) && (
        <div className="mt-4 space-y-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] p-4">
          {detail.script && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Script
              </p>
              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 dark:text-slate-200">
                {detail.script}
              </pre>
            </div>
          )}
          {detail.caption && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Caption
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-200">{detail.caption}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Dropdown
          id="idea-translate-language"
          value={language}
          onChange={setLanguage}
          className="w-40"
          options={[
            { value: "", label: "Auto (English)" },
            ...CONTENT_LANGUAGES.map((lang): DropdownOption => ({ value: lang, label: lang })),
          ]}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          loading={busy === "script"}
          onClick={() => void generate("script")}
        >
          Generate script
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          loading={busy === "caption"}
          onClick={() => void generate("caption")}
        >
          Generate caption
        </Button>
        <div className="ml-auto">
          <Button
            variant="danger"
            size="sm"
            disabled={busy !== null}
            loading={busy === "delete"}
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>
    </Card>
    <ConfirmDialog
      open={confirmOpen}
      title="Delete this idea?"
      description="This content idea will be permanently deleted. This cannot be undone."
      confirmLabel="Delete"
      onConfirm={confirmDelete}
      onCancel={() => setConfirmOpen(false)}
    />
    </>
  );
}

interface VideoItem {
  id: string;
  url: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  publishedAt: string | null;
  duration: number | null;
  creator: { username: string | null };
  metrics: { views: number; likes: number }[];
}

interface VideoPage {
  items: VideoItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface AnalyzedRef {
  videoId: string;
  topic: string | null;
  destination: string | null;
  contentFormat: string | null;
  hookType: string | null;
  aiScore: number | null;
}

interface GetIdeasResponse {
  ideas: ContentIdea[];
  model: string;
  generatedBy: string;
}

function GetIdeasTab({ projectId }: { projectId: string | null }) {
  const [count, setCount] = useState(5);
  const [generated, setGenerated] = useState<ContentIdea[] | null>(null);
  const [getting, setGetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ done: number; total: number } | null>(null);

  const videosPath = projectId
    ? `/videos?projectId=${projectId}&pageSize=60&sort=scrapedAt&order=desc`
    : null;
  const analyzedPath = projectId ? `/projects/${projectId}/analyzed-videos` : null;

  const videos = useApi<VideoPage>(videosPath);
  const analyzed = useApi<{ analyzed: AnalyzedRef[] }>(analyzedPath);

  const analyzedMap = useMemo(() => {
    const map = new Map<string, AnalyzedRef>();
    for (const ref of analyzed.data?.analyzed ?? []) map.set(ref.videoId, ref);
    return map;
  }, [analyzed.data]);

  const analyze = async (id: string) => {
    setAnalyzingId(id);
    setError(null);
    try {
      await api(`/videos/${id}/analyze`, { method: "POST" });
      await analyzed.refresh();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setAnalyzingId(null);
    }
  };

  const analyzeAll = async () => {
    if (!videos.data) return;
    const ids = videos.data.items.filter((v) => !analyzedMap.has(v.id)).map((v) => v.id).slice(0, 20);
    if (ids.length === 0) {
      setSuccess("Semua video sudah dianalisis.");
      return;
    }
    setAnalyzingAll(true);
    setError(null);
    setSuccess(null);
    setAnalyzeProgress({ done: 0, total: ids.length });
    try {
      for (const [index, id] of ids.entries()) {
        await api(`/videos/${id}/analyze`, { method: "POST" });
        setAnalyzeProgress({ done: index + 1, total: ids.length });
      }
      await analyzed.refresh();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setAnalyzingAll(false);
      setAnalyzeProgress(null);
    }
  };

  const getIdeas = async () => {
    if (!projectId) return;
    setGetting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await api<GetIdeasResponse>("/content-ideas/generate-from-videos", {
        method: "POST",
        body: { projectId, count },
      });
      setGenerated(result.ideas);
      setSuccess(`Berhasil membuat ${result.ideas.length} ide baru dari video yang dianalisis.`);
      await analyzed.refresh();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setGetting(false);
    }
  };

  const removeGenerated = (id: string) => {
    setGenerated((list) => list?.filter((idea) => idea.id !== id) ?? null);
  };

  const items = videos.data?.items ?? [];
  const analyzedCount = items.filter((v) => analyzedMap.has(v.id)).length;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Get ideas from scraped videos
            </p>
            <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
              AI analyzes the TikTok videos you&apos;ve scraped, then turns the winning angles into
              ready-to-use content ideas that reference the original video.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-24">
              <Label htmlFor="getideas-count">Ideas</Label>
              <Input
                id="getideas-count"
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </div>
            <Button variant="secondary" onClick={() => void analyzeAll()} loading={analyzingAll}>
              <ScrapeIcon style={{ width: 16, height: 16 }} />
              Analyze all
            </Button>
            <Button
              onClick={() => void getIdeas()}
              loading={getting}
              disabled={!projectId || items.length === 0}
            >
              <SparklesIcon style={{ width: 16, height: 16 }} />
              Get ideas
            </Button>
          </div>
        </div>
        {analyzeProgress && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Menganalisis video {analyzeProgress.done} / {analyzeProgress.total}…
          </p>
        )}
        {error && (
          <div className="mt-3"><Alert kind="error">{error}</Alert></div>
        )}
        {success && (
          <div className="mt-3"><Alert kind="success">{success}</Alert></div>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Reference videos
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Scraped videos for this project. Analyze them to feed the idea generator.
            </p>
          </div>
          {items.length > 0 && (
            <Badge color={analyzedCount === items.length ? "green" : "slate"}>
              {analyzedCount} / {items.length} analyzed
            </Badge>
          )}
        </div>

        {!projectId ? (
          <EmptyState message="Select a project to see its scraped videos." />
        ) : videos.loading ? (
          <div className="flex justify-center py-10 text-slate-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : videos.error ? (
          <Alert kind="error">{videos.error}</Alert>
        ) : items.length === 0 ? (
          <EmptyState message="No scraped videos yet — go to the Scrape tab to collect data first." />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {items.map((video) => {
              const ref = analyzedMap.get(video.id);
              const metric = video.metrics[0];
              return (
                <div key={video.id} className="flex items-center gap-3 py-3">
                  <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-white/5">
                    {video.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {video.caption ?? "Untitled video"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                      @{video.creator.username ?? "unknown"}
                      {metric ? ` · ${formatNumber(Number(metric.views))} views` : ""}
                      {ref?.topic ? ` · ${ref.topic}` : ""}
                    </p>
                    {ref && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {ref.contentFormat && (
                          <Badge color="slate">{ref.contentFormat.replace("_", " ")}</Badge>
                        )}
                        {ref.destination && <Badge color="blue">{ref.destination}</Badge>}
                        {ref.hookType && (
                          <Badge color="amber">{ref.hookType.replace("_", " ")} hook</Badge>
                        )}
                        {ref.aiScore != null && (
                          <Badge color="green">score {ref.aiScore.toFixed(0)}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {ref ? (
                      <Badge color="green">Analyzed</Badge>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={analyzingId === video.id}
                        onClick={() => void analyze(video.id)}
                      >
                        Analyze
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {generated && generated.length > 0 && (
        <div>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            {generated.length} new idea{generated.length === 1 ? "" : "s"} from your videos — also
            saved to the Content Ideas list.
          </p>
          <div className="space-y-4">
            {generated.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} onDeleted={() => removeGenerated(idea.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function tabClass(active: boolean): string {
  return `flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${
    active
      ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-600"
      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
  }`;
}

function IdeasInner() {
  const [projectId, setProjectId] = useState<string | null>(() => getProjectId());
  const [tab, setTab] = useState<IdeaTab>("ideas");
  const [count, setCount] = useState(5);
  const [format, setFormat] = useState<string>("");
  const [language, setLanguage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);

  const ideas = useApi<Paginated<ContentIdea>>(
    projectId
      ? `/content-ideas?projectId=${projectId}&pageSize=50`
      : `/content-ideas?pageSize=50`,
  );

  const refresh = () => void ideas.refresh();

  const generate = async () => {
    if (!projectId) return;
    setGenerating(true);
    setGenerateError(null);
    setGenerateSuccess(null);
    try {
      await api("/content-ideas/generate", {
        method: "POST",
        body: {
          projectId,
          count,
          ...(format ? { format } : {}),
          ...(language ? { language } : {}),
        },
      });
      setGenerateSuccess(`Berhasil membuat ${count} ide baru.`);
      await ideas.refresh();
    } catch (err) {
      setGenerateError(friendlyError(err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex w-fit items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-200/40 dark:border-white/10 dark:bg-white/[0.03]">
            <button type="button" onClick={() => setTab("ideas")} className={tabClass(tab === "ideas")}>
              <IdeasIcon style={{ width: 16, height: 16 }} />
              Content Ideas
            </button>
            <button type="button" onClick={() => setTab("getIdeas")} className={tabClass(tab === "getIdeas")}>
              <SparklesIcon style={{ width: 16, height: 16 }} />
              Get Ideas
            </button>
          </div>
          <p className="mt-2 pl-1 text-sm text-slate-500 dark:text-slate-400">
            {tab === "ideas"
              ? "Generate and refine AI content ideas."
              : "Analyze scraped videos and turn them into content idea references."}
          </p>
        </div>
        <ProjectSelect projectId={projectId} onChange={setProjectId} />
      </div>

      {tab === "getIdeas" ? (
        <GetIdeasTab key={projectId ?? "none"} projectId={projectId} />
      ) : (
        <>
          <Card className="mb-6 p-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-32">
                <Label htmlFor="idea-count">How many</Label>
                <Input
                  id="idea-count"
                  type="number"
                  min={1}
                  max={10}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </div>
              <div className="w-48">
                <Label htmlFor="idea-format">Format (optional)</Label>
                <Dropdown
                  id="idea-format"
                  value={format}
                  onChange={setFormat}
                  options={[
                    { value: "", label: "Any" },
                    ...CONTENT_FORMATS.map((f): DropdownOption => ({ value: f, label: f.replace("_", " ") })),
                  ]}
                />
              </div>
              <div className="w-44">
                <Label htmlFor="idea-language">Language</Label>
                <Dropdown
                  id="idea-language"
                  value={language}
                  onChange={setLanguage}
                  options={[
                    { value: "", label: "English" },
                    ...CONTENT_LANGUAGES.map((lang): DropdownOption => ({ value: lang, label: lang })),
                  ]}
                />
              </div>
              <Button onClick={() => void generate()} loading={generating}>
                Generate ideas
              </Button>
            </div>
            {generateError && (
              <div className="mt-3"><Alert kind="error">{generateError}</Alert></div>
            )}
            {generateSuccess && (
              <div className="mt-3"><Alert kind="success">{generateSuccess}</Alert></div>
            )}
          </Card>

          <div>
            {ideas.loading ? (
              <div className="flex justify-center py-16 text-slate-500 dark:text-slate-400">
                <Spinner className="h-6 w-6" />
              </div>
            ) : ideas.error ? (
              <Alert kind="error">{ideas.error}</Alert>
            ) : ideas.data && ideas.data.items.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {ideas.data.total} idea{ideas.data.total === 1 ? "" : "s"}
                </p>
                {ideas.data.items.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} onDeleted={refresh} />
                ))}
              </div>
            ) : (
              <EmptyState message="No ideas yet. Generate your first batch above." />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function IdeasPage() {
  return (
    <RequireAuth>
      <IdeasInner />
    </RequireAuth>
  );
}