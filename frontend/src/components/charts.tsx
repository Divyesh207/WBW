import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CompareMetric, Stage } from "../types";
import { fmt, fmtDate, prettyUnit } from "../utils/format";

import { OPTIMIZED_COLOR, ORIGINAL_COLOR, SERIES, STAGE_COLORS } from "../utils/palette";

export { OPTIMIZED_COLOR, ORIGINAL_COLOR, SERIES, STAGE_COLORS };

const AXIS = { fontSize: 12, fill: "#5B6B62" };
const GRID = "#E6ECE3";

function TooltipBox({ title, rows }: { title?: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-md border border-brand-line bg-white px-3 py-2 text-xs shadow-lg shadow-brand-dark/5">
      {title && <p className="mb-1 font-semibold text-brand-ink">{title}</p>}
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-brand-muted">
          {r.color && <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />}
          {r.label}: <span className="tabular font-medium text-brand-ink">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

const truncate = (text: string, max = 16) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/* --------------------------------------------------------- Carbon by stage */
export function StageChart({ stages, basis = "batch", height = 240 }: { stages: Stage[]; basis?: "batch" | "unit"; height?: number }) {
  const data = stages.map((s) => ({ ...s, value: basis === "batch" ? s.batch_carbon_kg : s.carbon_kg }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS} tickFormatter={(v) => fmt(v, 2)} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={136} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "#14261D0A" }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload;
            return p ? (
              <TooltipBox
                title={p.label}
                rows={[
                  { label: "Estimated", value: `${fmt(p.value)} kg CO₂e` },
                  { label: "Share", value: `${p.share_pct.toFixed(0)}%` },
                  { label: "Factor uncertainty", value: `±${p.uncertainty_pct}%` },
                ]}
              />
            ) : null;
          }}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={18} isAnimationActive={false}>
          {data.map((s) => (
            <Cell key={s.key} fill={STAGE_COLORS[s.key]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------- Donut */
export function DonutChart({ data, unit, colors = SERIES, height = 240 }: { data: { name: string; value: number; color?: string }[]; unit: string; colors?: string[]; height?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={1.5} stroke="none" isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={d.color ?? colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            content={({ payload }) => {
              const p = payload?.[0];
              return p ? (
                <TooltipBox
                  title={String(p.name)}
                  rows={[
                    { label: "Estimated", value: `${fmt(Number(p.value))} ${unit}` },
                    { label: "Share", value: `${((Number(p.value) / total) * 100).toFixed(0)}%` },
                  ]}
                />
              ) : null;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-brand-ink">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color ?? colors[i % colors.length] }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="tabular shrink-0 text-brand-muted">
              {fmt(d.value)} {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------- Original vs optimised, per product */
export function PairedBars({ data, unit, height = 260 }: { data: { name: string; original: number; optimized: number }[]; unit: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} barGap={3}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={AXIS} tickFormatter={(v) => truncate(String(v))} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={AXIS} tickFormatter={(v) => fmt(v, 2)} axisLine={false} tickLine={false} width={56} />
        <Tooltip
          cursor={{ fill: "#14261D0A" }}
          content={({ payload, label }) =>
            payload?.length ? (
              <TooltipBox
                title={String(label)}
                rows={payload.map((p) => ({ label: String(p.name), value: `${fmt(Number(p.value))} ${unit}`, color: p.color }))}
              />
            ) : null
          }
        />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "#5B6B62" }} />
        <Bar name="Original" dataKey="original" fill={ORIGINAL_COLOR} radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        <Bar name="Optimised" dataKey="optimized" fill={OPTIMIZED_COLOR} radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------- Indicators with different units, indexed to the original = 100 */
export function IndexedCompareChart({ metrics, height = 280 }: { metrics: CompareMetric[]; height?: number }) {
  const data = metrics.map((m) => ({
    ...m,
    name: m.label,
    originalIndex: 100,
    optimizedIndex: m.original ? (m.optimized / m.original) * 100 : m.optimized ? 100 : 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} barGap={3}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={AXIS} tickFormatter={(v) => String(v).replace(" consumption", "").replace("Manufacturing ", "")} axisLine={false} tickLine={false} interval={0} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `${v}`} domain={[0, (max: number) => Math.max(100, Math.ceil(max / 20) * 20)]} />
        <Tooltip
          cursor={{ fill: "#14261D0A" }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload;
            return p ? (
              <TooltipBox
                title={p.label}
                rows={[
                  { label: "Original", value: `${fmt(p.original)} ${prettyUnit(p.unit)}`, color: ORIGINAL_COLOR },
                  { label: "Optimised", value: `${fmt(p.optimized)} ${prettyUnit(p.unit)}`, color: OPTIMIZED_COLOR },
                ]}
              />
            ) : null;
          }}
        />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar name="Original (= 100)" dataKey="originalIndex" fill={ORIGINAL_COLOR} radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        <Bar name="Optimised" dataKey="optimizedIndex" fill={OPTIMIZED_COLOR} radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ----------------------------------------------------- Stage stacks, paired */
export function StageCompareChart({ stages, height = 220 }: { stages: { key: string; label: string; original: number; optimized: number }[]; height?: number }) {
  const row = (name: string, pick: "original" | "optimized") =>
    Object.fromEntries([["name", name], ...stages.map((s) => [s.key, s[pick]])]);
  const data = [row("Original", "original"), row("Optimised", "optimized")];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS} tickFormatter={(v) => fmt(v, 2)} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={76} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "#14261D0A" }}
          content={({ payload, label }) =>
            payload?.length ? (
              <TooltipBox
                title={String(label)}
                rows={payload.map((p) => ({ label: String(p.name), value: `${fmt(Number(p.value))} kg CO₂e`, color: p.color }))}
              />
            ) : null
          }
        />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        {stages.map((s) => (
          <Bar key={s.key} name={s.label} dataKey={s.key} stackId="a" fill={STAGE_COLORS[s.key]} barSize={30} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ----------------------------------------------------------------- History */
export function HistoryChart({ data, height = 240 }: { data: { name: string; date: string; carbon_batch_kg: number }[]; height?: number }) {
  let running = 0;
  const points = data.map((d) => ({ ...d, cumulative: (running += d.carbon_batch_kg), label: fmtDate(d.date).replace(/ \d{4}$/, "") }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} tickFormatter={(v) => fmt(v, 2)} axisLine={false} tickLine={false} width={56} />
        <Tooltip
          content={({ payload }) => {
            const p = payload?.[0]?.payload;
            return p ? (
              <TooltipBox
                title={p.name}
                rows={[
                  { label: "Assessed", value: fmtDate(p.date) },
                  { label: "This product", value: `${fmt(p.carbon_batch_kg)} kg CO₂e` },
                  { label: "Cumulative", value: `${fmt(p.cumulative)} kg CO₂e` },
                ]}
              />
            ) : null;
          }}
        />
        <Area type="monotone" dataKey="cumulative" stroke="#166534" strokeWidth={2} fill="#10B981" fillOpacity={0.12} dot={{ r: 3.5, fill: "#166534", strokeWidth: 0 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
