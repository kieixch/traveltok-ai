"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { setProjectId } from "@/lib/auth";
import {
  getScrapingJob,
  onScrapingChange,
  startScraping,
} from "@/lib/scraping-store";
import type { Paginated, Project, ScrapingJob } from "@/lib/types";
import { Alert, Button, Card, CardHeader, ConfirmDialog, Input, Label, Select, Spinner } from "./ui";
import { PlusIcon, ScrapeIcon } from "./icons";

const ALL = "";

function statusLabel(status: string): string {
  switch (status) {
    case "QUEUED":
      return "Queued — waiting for the scraping worker";
    case "RUNNING":
      return "Scraping TikTok…";
    case "COMPLETED":
      return "Done";
    case "FAILED":
      return "Failed";
    default:
      return status;
  }
}

export function ProjectPicker({
  projectId,
  onChange,
}: {
  projectId: string | null;
  onChange: (id: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [scrapeKeyword, setScrapeKeyword] = useState("");
  const [scrapeHashtag, setScrapeHashtag] = useState("");
  const [scrapeMax, setScrapeMax] = useState("30");
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [job, setJob] = useState<ScrapingJob | null>(getScrapingJob());
  const scrapeFilled = useRef(false);

  useEffect(() => {
    return onScrapingChange((j) => setJob(j));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Paginated<Project>>("/projects", {
        query: { pageSize: 100 },
      });
      setProjects(data.items ?? []);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const activeProject =
    projectId && projectId !== ALL
      ? projects.find((p) => p.id === projectId)
      : undefined;

  const handleSelect = (id: string) => {
    setProjectId(id);
    onChange(id);
    setEditing(false);
    setScrapeOpen(false);
    setScrapeError(null);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const project = await api<Project>("/projects", {
        method: "POST",
        body: { name: newName.trim() },
      });
      setNewName("");
      setProjects((prev) => [project, ...prev]);
      setProjectId(project.id);
      onChange(project.id);
      setEditing(false);
      setScrapeOpen(false);
      setScrapeError(null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setCreating(false);
    }
  };

  const startEdit = () => {
    if (!activeProject) return;
    setEditName(activeProject.name);
    setEditing(true);
    setScrapeOpen(false);
  };

  const saveEdit = async () => {
    if (!projectId || !editName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api<Project>(`/projects/${projectId}`, {
        method: "PATCH",
        body: { name: editName.trim() },
      });
      setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
      setEditing(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditName("");
  };

  const handleDelete = () => {
    if (!projectId || projectId === ALL || !activeProject) return;
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!projectId || projectId === ALL || !activeProject) return;
    setConfirmOpen(false);
    setDeleting(true);
    setError(null);
    try {
      await api(`/projects/${projectId}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setProjectId(ALL);
      onChange(ALL);
      setEditing(false);
      setScrapeOpen(false);
      setScrapeError(null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setDeleting(false);
    }
  };

  const openScrape = () => {
    setScrapeOpen((open) => !open);
    setScrapeError(null);
    setEditing(false);
    if (!scrapeFilled.current) {
      setScrapeHashtag(activeProject?.niche ? slugify(activeProject.niche) : "");
      if (activeProject?.niche) scrapeFilled.current = true;
    }
  };

  const submitScrape = async () => {
    if (!projectId || projectId === ALL) return;
    const placeholder: ScrapingJob = {
      id: "",
      projectId,
      keyword: null,
      hashtag: null,
      maxResults: null,
      status: "QUEUED",
      apifyRunId: null,
      totalResults: null,
      processedResults: 0,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: "",
    };
    setScrapeError(null);
    startScraping(placeholder);
    try {
      const created = await api<ScrapingJob>("/projects/" + projectId + "/scrape", {
        method: "POST",
        body: {
          keyword: scrapeKeyword.trim() || undefined,
          hashtag: scrapeHashtag.trim().replace(/^#/, "") || undefined,
          maxResults: Number(scrapeMax) || undefined,
        },
      });
      startScraping(created);
    } catch (err) {
      setScrapeError(friendlyError(err));
    }
  };

  const currentVal = projectId ?? ALL;

  return (
    <div className="space-y-4">
      <Card className="min-w-0">
        <CardHeader
          title="Projects"
          subtitle="Select a project, or create, rename, scrape, and delete projects."
        />
        <div className="space-y-5 p-5">
          {/* Project select + quick actions */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Label htmlFor="project-select">Project</Label>
              <Select
                id="project-select"
                value={currentVal}
                onChange={(e) => handleSelect(e.target.value)}
                disabled={loading}
              >
                {loading && <option>Loading…</option>}
                {!loading && <option value={ALL}>All Projects</option>}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            {activeProject && !editing && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={startEdit} title="Rename project">
                  <PencilIcon />
                  Rename
                </Button>
                <Button variant="secondary" size="sm" onClick={openScrape} title="Scrape data">
                  <ScrapeIcon />
                  Scrape data
                </Button>
                <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting} title="Delete project">
                  <TrashIcon />
                  Delete
                </Button>
              </div>
            )}
          </div>

          {/* Create */}
          {!editing && (
            <div>
              <Label htmlFor="new-project">Create project</Label>
              <div className="flex flex-wrap gap-3">
                <Input
                  id="new-project"
                  placeholder="New project…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
                  className="min-w-48 flex-1"
                />
                <Button onClick={() => void handleCreate()} loading={creating}>
                  <PlusIcon />
                  Create project
                </Button>
              </div>
            </div>
          )}

          {/* Rename */}
          {editing && (
            <div>
              <Label>Rename project</Label>
              <div className="flex flex-wrap gap-3">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                  autoFocus
                  className="min-w-48 flex-1"
                />
                <Button onClick={() => void saveEdit()} loading={saving}>
                  <CheckIcon />
                  Save
                </Button>
                <Button variant="ghost" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Scrape panel */}
          {scrapeOpen && activeProject && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/5">
              <div className="mb-1 flex items-center gap-2">
                <ScrapeIcon style={{ width: 16, height: 16 }} className="shrink-0 text-emerald-600 dark:text-emerald-300" />
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Scrape into “{activeProject.name}”
                </p>
              </div>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
                Runs a real TikTok scrape (Apify) for this project and saves the results as videos.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-48 flex-1">
                  <Label htmlFor="scrape-keyword">Keyword</Label>
                  <Input id="scrape-keyword" value={scrapeKeyword} onChange={(e) => setScrapeKeyword(e.target.value)} placeholder="e.g. Nusa Penida" />
                </div>
                <div className="min-w-44 flex-1">
                  <Label htmlFor="scrape-hashtag">Hashtag</Label>
                  <Input id="scrape-hashtag" value={scrapeHashtag} onChange={(e) => setScrapeHashtag(e.target.value)} placeholder="e.g. balitravel" />
                </div>
                <div className="w-28">
                  <Label htmlFor="scrape-max">Results</Label>
                  <Input id="scrape-max" type="number" min={1} max={100} value={scrapeMax} onChange={(e) => setScrapeMax(e.target.value)} />
                </div>
                <Button onClick={() => void submitScrape()} loading={job?.status === "QUEUED" || job?.status === "RUNNING"}>
                  <ScrapeIcon />
                  Start scraping
                </Button>
              </div>
              {job && job.status !== "COMPLETED" && job.status !== "FAILED" && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{statusLabel(job.status)}…</p>
              )}
              {job && job.status === "COMPLETED" && (
                <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-300">{job.totalResults ?? 0} videos saved.</p>
              )}
              {job && job.status === "FAILED" && (
                <Alert kind="error">
                  Scraping gagal: {job.errorMessage ?? "Coba lagi dengan hasil yang lebih sedikit atau parameter lain."}
                </Alert>
              )}
              {scrapeError && <div className="mt-3"><Alert kind="error">{scrapeError}</Alert></div>}
            </div>
          )}

          {loading && <Spinner className="text-slate-400" />}
        </div>
      </Card>

      {error && <Alert kind="error">{error}</Alert>}

      <ConfirmDialog
        open={confirmOpen}
        title={`Delete "${activeProject?.name ?? ""}"?`}
        description="All data in this project will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 40);
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}