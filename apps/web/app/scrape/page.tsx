"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ProjectPicker } from "@/components/ProjectPicker";
import { PageHeader } from "@/components/ui";
import { getProjectId } from "@/lib/auth";

function ScrapeInner() {
  const [projectId, setProjectId] = useState<string | null>(() => getProjectId());

  return (
    <div>
      <PageHeader
        title="Scrape"
        description="Manage projects and run TikTok scrapes for creator intelligence."
      />
      <ProjectPicker projectId={projectId} onChange={setProjectId} />
    </div>
  );
}

export default function ScrapePage() {
  return (
    <RequireAuth>
      <ScrapeInner />
    </RequireAuth>
  );
}