"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { setProjectId } from "@/lib/auth";
import { friendlyError } from "@/lib/friendlyError";
import type { Paginated, Project } from "@/lib/types";
import { Label, Select, Spinner } from "./ui";

const ALL = "";

export function ProjectSelect({
  projectId,
  onChange,
}: {
  projectId: string | null;
  onChange: (id: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleSelect = (id: string) => {
    setProjectId(id);
    onChange(id);
  };

  const currentVal = projectId ?? ALL;

  return (
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
      {loading && <Spinner className="mt-1 h-3 w-3 text-slate-400" />}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}