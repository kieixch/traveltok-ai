"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ProjectPicker } from "@/components/ProjectPicker";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { api } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { getProjectId } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import { CONTENT_FORMATS, CONTENT_LANGUAGES } from "@/lib/types";
import type { ContentIdea, Paginated } from "@/lib/types";

function IdeaCard({ idea, onDeleted }: { idea: ContentIdea; onDeleted: () => void }) {
  const [busy, setBusy] = useState<"script" | "caption" | "delete" | null>(null);
  const [language, setLanguage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [detail, setDetail] = useState(idea);
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
        <Select
          aria-label="Language for script/caption"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-40"
        >
          <option value="">Auto (English)</option>
          {CONTENT_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </Select>
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

function IdeasInner() {
  const [projectId, setProjectId] = useState<string | null>(() => getProjectId());
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
      <PageHeader
        title="Content ideas"
        description="Generate and refine AI content ideas."
        action={<ProjectPicker projectId={projectId} onChange={setProjectId} />}
      />

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
            <Select
              id="idea-format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              <option value="">Any</option>
              {CONTENT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <Label htmlFor="idea-language">Language</Label>
            <Select
              id="idea-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="">English</option>
              {CONTENT_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </Select>
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
