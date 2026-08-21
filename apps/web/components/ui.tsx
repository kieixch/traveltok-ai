import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = {
    sm: "px-3 py-1.5",
    md: "px-4 py-2",
  };
  const variants = {
    primary:
      "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:brightness-110 active:scale-[0.98]",
    secondary:
      "bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200 hover:ring-slate-300 dark:bg-white/5 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-white/10 dark:hover:ring-white/20",
    ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100",
    danger: "bg-red-500/90 text-white shadow-lg shadow-red-500/20 hover:bg-red-500",
  };
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Input({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500 ${className}`}
      {...rest}
    />
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
      {children}
    </label>
  );
}

export function Select({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-black/20 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-white/10">
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const badgeColors: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30",
  blue: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/30",
  amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/30",
  slate: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-400/10 dark:text-slate-300 dark:ring-slate-400/30",
  red: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/30",
};

export function Badge({
  children,
  color = "slate",
}: {
  children: ReactNode;
  color?: keyof typeof badgeColors;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeColors[color]}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, keyof typeof badgeColors> = {
    COMPLETED: "green",
    SUCCESS: "green",
    PUBLISHED: "green",
    QUEUED: "slate",
    RUNNING: "blue",
    SCHEDULED: "blue",
    ACTIVE: "blue",
    DRAFT: "slate",
    IDEA: "slate",
    FAILED: "red",
    CANCELLED: "red",
    ARCHIVED: "slate",
    USED: "green",
  };
  return <Badge color={map[status] ?? "slate"}>{status}</Badge>;
}

export function Alert({
  kind = "error",
  children,
}: {
  kind?: "error" | "info" | "success";
  children: ReactNode;
}) {
  const colors = {
    error: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200",
    info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${colors[kind]}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "emerald",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  accent?: "emerald" | "cyan" | "violet" | "amber";
}) {
  const accents = {
    emerald: "from-emerald-400/20 to-emerald-400/0 text-emerald-600 dark:text-emerald-300",
    cyan: "from-cyan-400/20 to-cyan-400/0 text-cyan-600 dark:text-cyan-300",
    violet: "from-violet-400/20 to-violet-400/0 text-violet-600 dark:text-violet-300",
    amber: "from-amber-400/20 to-amber-400/0 text-amber-600 dark:text-amber-300",
  };
  return (
    <Card className="relative overflow-hidden px-5 py-4">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accents[accent]}`}
      />
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        {icon && <span className={accents[accent]}>{icon}</span>}
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </Card>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-400 dark:border-white/15 dark:text-slate-500">
      {message}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      className="rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm dark:border-white/10 dark:bg-[#0c1324]"
    >
      <div className="px-6 py-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-3 dark:border-white/10">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={variant} size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

export function BarChart({
  data,
  labelKey,
  valueKey,
  format,
}: {
  data: readonly object[];
  labelKey: string;
  valueKey: string;
  format?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => Number((d as Record<string, unknown>)[valueKey]) || 0));
  return (
    <div className="flex h-48 items-end gap-2">
      {data.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
          No data for this period
        </div>
      ) : (
        data.map((d, i) => {
          const row = d as Record<string, unknown>;
          const value = Number(row[valueKey]) || 0;
          const height = (value / max) * 100;
          return (
            <div key={i} className="group relative flex flex-1 flex-col items-center gap-1">
              <span className="pointer-events-none absolute -top-6 z-10 hidden whitespace-nowrap rounded-lg bg-white px-1.5 py-0.5 text-[10px] text-slate-900 ring-1 ring-slate-200 group-hover:block dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10">
                {format ? format(value) : value}
              </span>
              <div
                className="w-full rounded-t bg-gradient-to-t from-emerald-500/70 to-cyan-400/80 transition-all duration-300 hover:from-emerald-400 hover:to-cyan-300"
                style={{ height: `${Math.max(height, 2)}%` }}
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{String(row[labelKey])}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
