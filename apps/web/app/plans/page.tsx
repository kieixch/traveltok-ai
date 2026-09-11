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
  ConfirmDialog,
  Dropdown,
  type DropdownOption,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { api, formatDate } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { getProjectId } from "@/lib/auth";
import { useApi } from "@/lib/useApi";
import { CONTENT_LANGUAGES } from "@/lib/types";
import type { ContentPlan, ContentPlanDetail, Paginated } from "@/lib/types";

const DEFAULT_START = new Date();
const DEFAULT_END = new Date(Date.now() + 14 * 86400000);
const toDateInput = (d: Date) => d.toISOString().slice(0, 10);

function PlanCard({ plan, onDeleted }: { plan: ContentPlan; onDeleted: () => void }) {
  const [detail, setDetail] = useState<ContentPlanDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggle = async () => {
    if (detail) {
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      setDetail(await api<ContentPlanDetail>(`/content-plans/${plan.id}`));
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    setDeleteError(null);
    try {
      await api(`/content-plans/${plan.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setDeleteError(friendlyError(err));
      setDeleting(false);
    }
  };

  return (
    <>
    <Card>
      <CardHeader
        title={plan.title}
        subtitle={`${formatDate(plan.startDate)} → ${formatDate(plan.endDate)}`}
        action={
          <div className="flex items-center gap-2">
            {plan.generatedBy === "AI" && <Badge color="green">AI</Badge>}
            <StatusBadge status={plan.status} />
          </div>
        }
      />
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {plan._count?.items ?? 0} scheduled posts
          </p>
          {deleteError && <Alert kind="error">{deleteError}</Alert>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void toggle()} loading={loading}>
            {detail ? "Hide items" : "View items"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleting}
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </Button>
        </div>
      </div>
      {detail && (
        <div className="border-t border-slate-100 dark:border-white/10 px-5 py-4">
          {detail.items.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No items in this plan.</p>
          ) : (
            <ul className="space-y-2">
              {detail.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.title}
                    </p>
                    {item.caption && (
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.caption}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.format && <Badge color="blue">{item.format}</Badge>}
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(item.scheduledDate)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
    <ConfirmDialog
      open={confirmOpen}
      title="Delete this plan?"
      description="This content plan and all its items will be permanently deleted. This cannot be undone."
      confirmLabel="Delete"
      onConfirm={confirmDelete}
      onCancel={() => setConfirmOpen(false)}
    />
    </>
  );
}

function PlansInner() {
  const [projectId, setProjectId] = useState<string | null>(() => getProjectId());
  const [startDate, setStartDate] = useState(toDateInput(DEFAULT_START));
  const [endDate, setEndDate] = useState(toDateInput(DEFAULT_END));
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [language, setLanguage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);

  const plans = useApi<Paginated<ContentPlan>>(
    projectId
      ? `/content-plans?projectId=${projectId}&pageSize=50`
      : `/content-plans?pageSize=50`,
  );

  const generate = async () => {
    if (!projectId) return;
    setGenerating(true);
    setGenerateError(null);
    setGenerateSuccess(null);
    try {
      await api("/content-plans/generate", {
        method: "POST",
        body: {
          projectId,
          startDate,
          endDate,
          postsPerWeek,
          ...(language ? { language } : {}),
        },
      });
      setGenerateSuccess("Rencana konten berhasil dibuat.");
      await plans.refresh();
    } catch (err) {
      setGenerateError(friendlyError(err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Content planner"
        description="Turn ideas into a scheduled posting calendar."
        action={<ProjectSelect projectId={projectId} onChange={setProjectId} />}
      />

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="plan-start">Start date</Label>
            <Input
              id="plan-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="plan-end">End date</Label>
            <Input
              id="plan-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="w-36">
            <Label htmlFor="plan-posts">Posts per week</Label>
            <Dropdown
              id="plan-posts"
              value={String(postsPerWeek)}
              onChange={(v) => setPostsPerWeek(Number(v))}
              options={[1, 2, 3, 4, 5, 6, 7].map(
                (n): DropdownOption => ({ value: String(n), label: String(n) }),
              )}
            />
          </div>
          <div className="w-44">
            <Label htmlFor="plan-language">Language</Label>
            <Dropdown
              id="plan-language"
              value={language}
              onChange={setLanguage}
              options={[
                { value: "", label: "English" },
                ...CONTENT_LANGUAGES.map((lang): DropdownOption => ({ value: lang, label: lang })),
              ]}
            />
          </div>
          <Button onClick={() => void generate()} loading={generating}>
            Generate plan
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
        {plans.loading ? (
          <div className="flex justify-center py-16 text-slate-500 dark:text-slate-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : plans.error ? (
          <Alert kind="error">{plans.error}</Alert>
        ) : plans.data && plans.data.items.length > 0 ? (
          <div className="space-y-4">
            {plans.data.items.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onDeleted={() => void plans.refresh()}
              />
            ))}
          </div>
        ) : (
          <EmptyState message="No plans yet. Generate your first plan above." />
        )}
      </div>
    </div>
  );
}

export default function PlansPage() {
  return (
    <RequireAuth>
      <PlansInner />
    </RequireAuth>
  );
}
