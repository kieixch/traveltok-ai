"use client";

import { useState } from "react";

export interface ChartPoint {
  label: string;
  value: number;
}

const COLORS = ["#34d399", "#22d3ee", "#818cf8", "#fbbf24", "#f472b6", "#a78bfa"];

export function AreaChart({
  data,
  format,
  height = 200,
}: {
  data: ChartPoint[];
  format?: (value: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const PAD = { t: 16, r: 8, b: 28, l: 8 };

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-500 dark:text-slate-400"
        style={{ height }}
      >
        No data for this period
      </div>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.value));
  const min = 0;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (innerW * i) / Math.max(1, data.length - 1);
  const y = (v: number) => PAD.t + innerH - ((v - min) / (max - min)) * innerH;

  const line = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${H - PAD.b} L${x(0).toFixed(1)},${
    H - PAD.b
  } Z`;
  const smooth = buildSmooth(data, x, y);

  return (
    <div className="w-full" style={{ height: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full"
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Area chart"
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
            <stop offset="55%" stopColor="#22d3ee" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="areaLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={PAD.l}
            x2={W - PAD.r}
            y1={PAD.t + innerH * f}
            y2={PAD.t + innerH * f}
            stroke="rgba(148,163,184,0.12)"
            strokeDasharray="4 4"
          />
        ))}

        <path d={area} fill="url(#areaFill)" />
        <path d={smooth ?? line} fill="none" stroke="url(#areaLine)" strokeWidth={2.5} strokeLinecap="round" />

        {data.map((d, i) => (
          <g key={i}>
            <rect
              x={x(i) - innerW / Math.max(1, data.length) / 2}
              y={PAD.t}
              width={innerW / Math.max(1, data.length)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            <circle cx={x(i)} cy={y(d.value)} r={hover === i ? 4.5 : 2.5} fill="#ffffff" stroke="#22d3ee" strokeWidth={2} className="dark:fill-[#0b1220]" />
            {hover === i && (
              <g>
                <line
                  x1={x(i)}
                  x2={x(i)}
                  y1={PAD.t}
                  y2={H - PAD.b}
                  stroke="rgba(34,211,238,0.35)"
                  strokeDasharray="3 3"
                />
                <rect
                  x={Math.min(Math.max(x(i) - 46, 0), W - 92)}
                  y={PAD.t - 4}
                  width={92}
                  height={20}
                  rx={6}
                  fill="#f8fafc"
                  stroke="rgba(0,0,0,0.1)"
                  className="dark:fill-[#111a2e] dark:stroke-[rgba(255,255,255,0.12)]"
                />
                <text
                  x={Math.min(Math.max(x(i), 46), W - 46)}
                  y={PAD.t + 11}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#1e293b"
                  className="dark:fill-[#e2e8f0]"
                >
                  {format ? format(d.value) : d.value}
                </text>
              </g>
            )}
          </g>
        ))}

        {data.map((d, i) => {
          const maxLabels = 5;
          const step = Math.max(1, Math.floor((data.length - 1) / maxLabels));
          const show = i % step === 0 || i === data.length - 1;
          if (!show) return null;
          const displayLabel = d.label.length > 10 ? d.label.slice(5, 10) : d.label;
          return (
            <text
              key={`l${i}`}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#94a3b8"
              className="dark:fill-[#64748b]"
            >
              {displayLabel}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function buildSmooth(
  data: ChartPoint[],
  x: (i: number) => number,
  y: (v: number) => number,
): string {
  if (data.length < 3) return "";
  let d = `M${x(0).toFixed(1)},${y(data[0].value).toFixed(1)}`;
  for (let i = 1; i < data.length; i++) {
    const cx = (x(i - 1) + x(i)) / 2;
    d += ` C${cx.toFixed(1)},${y(data[i - 1].value).toFixed(1)} ${cx.toFixed(1)},${y(
      data[i].value,
    ).toFixed(1)} ${x(i).toFixed(1)},${y(data[i].value).toFixed(1)}`;
  }
  return d;
}

export function Donut({
  segments,
  centerLabel,
  centerValue,
  size = 176,
  thickness = 18,
}: {
  segments: { label: string; value: number; color?: string }[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }} role="img" aria-label="Donut chart">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={thickness} className="dark:stroke-[rgba(255,255,255,0.06)]" />
        {total > 0 &&
          segments.map((seg, i) => {
            const len = (seg.value / total) * C;
            const start = offset;
            offset += len;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color ?? COLORS[i % COLORS.length]}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(len - 2, 0.5)} ${C - Math.max(len - 2, 0.5)}`}
                strokeDashoffset={-start}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
          })}
        <text
          x={size / 2}
          y={size / 2 - 6}
          textAnchor="middle"
          fontSize={Math.round(size / 11)}
          fontWeight={600}
          fill="#1e293b"
          className="dark:fill-[#f1f5f9]"
        >
          {centerValue ?? ""}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 12}
          textAnchor="middle"
          fontSize={Math.round(size / 16)}
          fill="#94a3b8"
          className="dark:fill-[#64748b]"
        >
          {centerLabel ?? ""}
        </text>
      </svg>
      <ul className="w-full min-w-0 space-y-1.5">
        {segments.length === 0 && (
          <li className="text-sm text-slate-400 dark:text-slate-500">No data yet</li>
        )}
        {segments.map((seg, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: seg.color ?? COLORS[i % COLORS.length] }}
              />
              <span className="truncate text-slate-700 dark:text-slate-300">{seg.label}</span>
            </span>
            <span className="tabular-nums text-slate-400 dark:text-slate-500">
              {total > 0 ? Math.round((seg.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgressList({
  items,
  format,
  barColor = "from-emerald-400 to-cyan-400",
}: {
  items: { label: string; value: number }[];
  format?: (value: number) => string;
  barColor?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.length === 0 && <div className="text-sm text-slate-400 dark:text-slate-500">No data yet</div>}
      {items.map((item, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-slate-700 dark:text-slate-300">{item.label}</span>
            <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
              {format ? format(item.value) : item.value}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/5">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
