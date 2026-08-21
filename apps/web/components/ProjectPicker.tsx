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
import { Alert, Button, ConfirmDialog, Input, Label, Select, Spinner } from "./ui";

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
      handleSelect(project.id);
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

  const handleDelete = async () => {
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
      handleSelect(ALL);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setDeleting(false);
    }
  };

  const openScrape = () => {
    setScrapeOpen((open) => !open);
    setScrapeError(null);
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
    <div className="flex flex-wrap items-end gap-3">
      {/* Row 1: Select + inline actions */}
      <div className="flex items-end gap-2">
        <div className="min-w-56">
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
          <>
            <Button variant="ghost" size="sm" onClick={startEdit} title="Edit name">
              <PencilIcon />
            </Button>
            <Button variant="ghost" size="sm" onClick={openScrape} title="Scrape data">
              <ScrapeIcon />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDelete} loading={deleting} title="Delete project">
              <TrashIcon />
            </Button>
          </>
        )}
      </div>

      {/* Row 1 right: Create */}
      {!editing && (
        <div className="flex items-end gap-2">
          <div className="min-w-40">
            <Input
              placeholder="New project…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
            />
          </div>
          <Button variant="secondary" size="sm" onClick={handleCreate} loading={creating}>
            Create
          </Button>
        </div>
      )}

      {/* Edit mode: inline name input + save/cancel */}
      {editing && (
        <div className="flex items-end gap-2">
          <div className="min-w-56">
            <Label>Rename project</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(); if (e.key === "Escape") cancelEdit(); }}
              autoFocus
            />
          </div>
          <Button size="sm" onClick={saveEdit} loading={saving}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={cancelEdit}>
            Cancel
          </Button>
        </div>
      )}

      {loading && <Spinner className="text-slate-500 dark:text-slate-400" />}

      {/* Scrape panel */}
      {scrapeOpen && activeProject && (
        <div className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-4">
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            Runs a real TikTok scrape (Apify) for this project and saves the results as videos.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48">
              <Label htmlFor="scrape-keyword">Keyword</Label>
              <Input id="scrape-keyword" value={scrapeKeyword} onChange={(e) => setScrapeKeyword(e.target.value)} placeholder="e.g. Nusa Penida" />
            </div>
            <div className="min-w-44">
              <Label htmlFor="scrape-hashtag">Hashtag</Label>
              <Input id="scrape-hashtag" value={scrapeHashtag} onChange={(e) => setScrapeHashtag(e.target.value)} placeholder="e.g. balitravel" />
            </div>
            <div className="w-28">
              <Label htmlFor="scrape-max">Results</Label>
              <Input id="scrape-max" type="number" min={1} max={100} value={scrapeMax} onChange={(e) => setScrapeMax(e.target.value)} />
            </div>
            <Button onClick={() => void submitScrape()} loading={job?.status === "QUEUED" || job?.status === "RUNNING"}>
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
            <Alert kind="error">Scraping gagal. Coba lagi dengan hasil yang lebih sedikit atau parameter lain.</Alert>
          )}
          {scrapeError && <Alert kind="error">{scrapeError}</Alert>}
        </div>
      )}

      {error && <div className="w-full"><Alert kind="error">{error}</Alert></div>}

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

function ScrapeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
