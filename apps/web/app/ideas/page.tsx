"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  Pagination,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { IdeasIcon, ScrapeIcon, SparklesIcon, VideoIcon } from "@/components/icons";
import { api, formatNumber } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { getProjectId } from "@/lib/auth";
import { startAnalyze, useAnalyzeState } from "@/lib/analyze-store";
import { useApi } from "@/lib/useApi";
import { CONTENT_FORMATS, CONTENT_LANGUAGES } from "@/lib/types";
import type { ContentIdea, Paginated } from "@/lib/types";

type IdeaTab = "ideas" | "getIdeas";

function VideoThumb({
  src,
  alt = "",
  className,
}: {
  src: string | null;
  alt?: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={() => setFailed(true)} className={className} />
  );
}

function IdeaCard({
  idea,
  onDeleted,
  inlineDropdown = false,
}: {
  idea: ContentIdea;
  onDeleted: () => void;
  inlineDropdown?: boolean;
}) {
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
          <VideoThumb src={source.thumbnailUrl} className="h-12 w-20 shrink-0 rounded-lg object-cover" />
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
          portal={!inlineDropdown}
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
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const analyzeState = useAnalyzeState();

  const videosPath = projectId
    ? `/videos?projectId=${projectId}&page=${page}&pageSize=20&sort=scrapedAt&order=desc`
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

  const analyzeAll = () => {
    if (!videos.data) return;
    const ids = videos.data.items.filter((v) => !analyzedMap.has(v.id)).map((v) => v.id);
    if (ids.length === 0) {
      setSuccess("Semua video di halaman ini sudah dianalisis.");
      return;
    }
    setSuccess(null);
    startAnalyze(ids);
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
            <Button
              onClick={() => analyzeAll()}
              loading={analyzeState.running}
              disabled={!projectId || items.length === 0 || analyzeState.running}
            >
              <ScrapeIcon style={{ width: 16, height: 16 }} />
              Analyze videos
            </Button>
          </div>
        </div>
        {analyzeState.running && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Menganalisis video {analyzeState.done} / {analyzeState.total} — bisa berpindah halaman,
            berjalan terus sampai dihentikan.
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
                <div
                  key={video.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedVideo(video)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedVideo(video);
                    }
                  }}
                  className="flex cursor-pointer items-center gap-3 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                >
                  <VideoThumb
                    src={video.thumbnailUrl}
                    className="h-16 w-28 shrink-0 rounded-lg object-cover"
                  />
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
                  <div className="flex shrink-0 flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                    {video.url && (
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-100 hover:ring-slate-300 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-white/10 dark:hover:ring-white/20"
                      >
                        <VideoIcon style={{ width: 14, height: 14 }} />
                        View on TikTok
                      </a>
                    )}
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
        <Pagination
          page={videos.data?.page ?? 1}
          totalPages={videos.data?.totalPages ?? 1}
          totalItems={videos.data?.total}
          itemLabel="videos"
          onPageChange={setPage}
          className="mt-4 border-t border-slate-100 pt-4 dark:border-white/5"
        />
      </Card>

      <VideoIdeasDialog
        key={selectedVideo?.id ?? "none"}
        video={selectedVideo}
        projectId={projectId}
        analyzedRef={selectedVideo ? analyzedMap.get(selectedVideo.id) ?? null : null}
        onClose={() => setSelectedVideo(null)}
        onChanged={() => void analyzed.refresh()}
      />
    </div>
  );
}

function VideoIdeasDialog({
  video,
  projectId,
  analyzedRef,
  onClose,
  onChanged,
}: {
  video: VideoItem | null;
  projectId: string | null;
  analyzedRef: AnalyzedRef | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ideasPath = video ? `/videos/${video.id}/ideas` : null;
  const result = useApi<{ ideas: ContentIdea[] }>(ideasPath);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [language, setLanguage] = useState("");

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (video && !el.open) el.showModal();
    else if (!video && el.open) el.close();
  }, [video]);

  const deleteIdea = (id: string) => {
    setDeletedIds((prev) => new Set(prev).add(id));
    onChanged();
  };

  const generateForVideo = async () => {
    if (!video || !projectId) return;
    setGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const generatedIdea = await api<GetIdeasResponse>("/content-ideas/generate-from-videos", {
        method: "POST",
        body: {
          projectId,
          videoIds: [video.id],
          count: 1,
          ...(language ? { language } : {}),
        },
      });
      await result.refresh();
      setSuccess(
        generatedIdea.ideas.length > 0
          ? `Berhasil membuat ${generatedIdea.ideas.length} ide berdasarkan video ini.`
          : "Tidak ada ide baru yang dihasilkan untuk video ini.",
      );
      onChanged();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setGenerating(false);
    }
  };

  const ideas = useMemo(
    () =>
      (result.data?.ideas ?? []).filter(
        (idea) => !deletedIds.has(idea.id),
      ),
    [result.data, deletedIds],
  );
  const metric = video?.metrics[0];

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm dark:border-white/10 dark:bg-[#0c1324]"
    >
      {video && (
        <div className="max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-[#0c1324]/90">
            <div className="flex items-start gap-3">
              <VideoThumb
                src={video.thumbnailUrl}
                className="h-16 w-28 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {video.caption ?? "Untitled video"}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                  @{video.creator.username ?? "unknown"}
                  {metric ? ` · ${formatNumber(Number(metric.views))} views` : ""}
                </p>
                {analyzedRef && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {analyzedRef.contentFormat && (
                      <Badge color="slate">{analyzedRef.contentFormat.replace("_", " ")}</Badge>
                    )}
                    {analyzedRef.destination && <Badge color="blue">{analyzedRef.destination}</Badge>}
                    {analyzedRef.hookType && (
                      <Badge color="amber">{analyzedRef.hookType.replace("_", " ")} hook</Badge>
                    )}
                    {analyzedRef.aiScore != null && (
                      <Badge color="green">score {analyzedRef.aiScore.toFixed(0)}</Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {video.url && (
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-100 hover:ring-slate-300 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-white/10 dark:hover:ring-white/20"
                  >
                    <VideoIcon style={{ width: 14, height: 14 }} />
                    View on TikTok
                  </a>
                )}
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Ideas from this video
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Generated ideas that reference this video. Scripts adapt its proven angle.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Dropdown
                  id="dialog-generate-language"
                  value={language}
                  onChange={setLanguage}
                  portal={false}
                  className="w-36"
                  options={[
                    { value: "", label: "English" },
                    ...CONTENT_LANGUAGES.map((lang): DropdownOption => ({ value: lang, label: lang })),
                  ]}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  loading={generating}
                  disabled={!projectId}
                  onClick={() => void generateForVideo()}
                >
                  <SparklesIcon style={{ width: 14, height: 14 }} />
                  Generate ideas
                </Button>
              </div>
            </div>

            {error && (
              <div className="mb-3"><Alert kind="error">{error}</Alert></div>
            )}
            {success && (
              <div className="mb-3"><Alert kind="success">{success}</Alert></div>
            )}

            {result.loading ? (
              <div className="flex justify-center py-10 text-slate-400">
                <Spinner className="h-6 w-6" />
              </div>
            ) : result.error ? (
              <Alert kind="error">{result.error}</Alert>
            ) : ideas.length > 0 ? (
              <div className="space-y-3">
                {ideas.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    onDeleted={() => deleteIdea(idea.id)}
                    inlineDropdown
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="Belum ada ide untuk video ini. Klik 'Generate ideas' untuk membuat ide berdasarkan video ini." />
            )}
          </div>
        </div>
      )}
    </dialog>
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
  const [ideasPage, setIdeasPage] = useState(1);
  const [targetIdeaId, setTargetIdeaId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("idea") ?? null,
  );
  const router = useRouter();

  const targetIdea = useApi<ContentIdea>(
    targetIdeaId ? `/content-ideas/${targetIdeaId}` : null,
  );

  const clearTarget = () => {
    setTargetIdeaId(null);
    router.replace(window.location.pathname);
  };

  const ideas = useApi<Paginated<ContentIdea>>(
    projectId
      ? `/content-ideas?projectId=${projectId}&page=${ideasPage}&pageSize=20`
      : `/content-ideas?page=${ideasPage}&pageSize=20`,
  );

  const deleteIdea = () => {
    if (ideas.data && ideas.data.items.length === 1 && ideasPage > 1) {
      setIdeasPage((p) => p - 1);
    } else {
      void ideas.refresh();
    }
  };

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
          <div className="flex w-fit items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-white/10 dark:bg-white/[0.03] dark:shadow-black/40">
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
        <ProjectSelect
          projectId={projectId}
          onChange={(id) => {
            setProjectId(id);
            setIdeasPage(1);
          }}
        />
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
            {targetIdeaId && (
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Ditandai dari Content Planner
                  </p>
                  <button
                    onClick={clearTarget}
                    className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    Hapus penanda
                  </button>
                </div>
                {targetIdea.loading ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                    <Spinner className="h-4 w-4" /> Mencari ide yang dituju…
                  </div>
                ) : targetIdea.error ? (
                  <Alert kind="error">{targetIdea.error}</Alert>
                ) : targetIdea.data ? (
                  <div className="rounded-2xl ring-2 ring-emerald-500/60">
                    <IdeaCard
                      idea={targetIdea.data}
                      onDeleted={() => {
                        clearTarget();
                        void ideas.refresh();
                      }}
                    />
                  </div>
                ) : null}
              </div>
            )}

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
                  <IdeaCard key={idea.id} idea={idea} onDeleted={deleteIdea} />
                ))}
                <Pagination
                  page={ideas.data.page}
                  totalPages={ideas.data.totalPages}
                  totalItems={ideas.data.total}
                  itemLabel="ideas"
                  onPageChange={setIdeasPage}
                  className="pt-4"
                />
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