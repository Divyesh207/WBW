import { useMemo, useState } from "react";
import { ArrowDown, Check } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SERIES } from "../components/charts";
import { Badge, Card, CardHeader, Notice, PageHeader } from "../components/ui";
import { useReference } from "../hooks/useReference";
import type { MaterialFactor } from "../types";
import { cx, fmt } from "../utils/format";

const METRICS = [
  { key: "emission_factor", label: "Carbon", unit: "kg CO₂e/kg" },
  { key: "embodied_energy", label: "Embodied energy", unit: "MJ/kg" },
  { key: "water", label: "Water", unit: "L/kg" },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

export default function MaterialExplorer() {
  const ref = useReference();
  const [family, setFamily] = useState("");
  const [sort, setSort] = useState<MetricKey>("emission_factor");
  const [picked, setPicked] = useState<string[]>(["virgin_plastic", "recycled_plastic"]);

  const rows = useMemo(
    () => ref.materials.filter((m) => !family || m.family === family).sort((a, b) => b[sort] - a[sort]),
    [ref.materials, family, sort],
  );
  const compared = picked.map((id) => ref.materials.find((m) => m.id === id)).filter(Boolean) as MaterialFactor[];

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? [...p.slice(1), id] : [...p, id]));

  return (
    <>
      <PageHeader title="Material explorer" description="Browse the material library behind the assessment engine and compare up to four materials per kilogram." />
      <Notice>
        {ref.datasets.materials.status}. {ref.datasets.materials.note}
      </Notice>

      <Card className="mt-6">
        <CardHeader
          title="Compare materials"
          hint={compared.length ? `${compared.map((m) => m.name).join(" · ")} — per kg of material, cradle-to-gate` : "Tick materials in the table below to compare them"}
        />
        {compared.length > 0 ? (
          <div className="grid gap-6 p-5 md:grid-cols-3">
            {METRICS.map((metric) => (
              <div key={metric.key}>
                <p className="text-xs font-medium uppercase tracking-wider text-brand-muted">
                  {metric.label} <span className="normal-case tracking-normal">({metric.unit})</span>
                </p>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={compared.map((m) => ({ name: m.name, value: m[metric.key] }))} margin={{ top: 12, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="#E6ECE3" />
                    <XAxis dataKey="name" tick={false} axisLine={false} tickLine={false} height={6} />
                    <YAxis tick={{ fontSize: 11, fill: "#5B6B62" }} tickFormatter={(v) => fmt(v, 2)} axisLine={false} tickLine={false} width={44} />
                    <Tooltip
                      cursor={{ fill: "#14261D0A" }}
                      content={({ payload }) =>
                        payload?.[0] ? (
                          <div className="rounded-md border border-brand-line bg-white px-3 py-2 text-xs shadow-lg">
                            <p className="font-semibold text-brand-ink">{payload[0].payload.name}</p>
                            <p className="tabular text-brand-muted">
                              {fmt(Number(payload[0].value))} {metric.unit} (illustrative)
                            </p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                      {compared.map((m, i) => (
                        <Cell key={m.id} fill={SERIES[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm md:col-span-3">
              {compared.map((m, i) => (
                <li key={m.id} className="flex items-center gap-2 text-brand-ink">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i] }} />
                  {m.name}
                </li>
              ))}
            </ul>
            <p className="text-xs text-brand-muted md:col-span-3">
              A lower figure per kilogram is not automatically better: materials differ in how much mass a product needs, how long it lasts and how it is recovered at end-of-life.
            </p>
          </div>
        ) : (
          <p className="p-5 text-sm text-brand-muted">No materials selected.</p>
        )}
      </Card>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by material type">
          {[["", "All"], ...Object.entries(ref.families)].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFamily(key)} aria-pressed={family === key} className={cx("rounded-md border px-3 py-1.5 text-xs font-medium transition-colors", family === key ? "border-brand-dark bg-brand-dark text-white" : "border-brand-line bg-white text-brand-muted hover:text-brand-ink")}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-brand-muted">{picked.length} of 4 selected for comparison</p>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-brand-line text-left text-xs uppercase tracking-wider text-brand-muted">
              <th className="w-10 px-5 py-3" />
              <th className="px-2 py-3 font-medium">Material</th>
              {METRICS.map((m) => (
                <th key={m.key} className="px-4 py-3 text-right font-medium">
                  <button type="button" onClick={() => setSort(m.key)} className={cx("inline-flex items-center gap-1 uppercase tracking-wider hover:text-brand-ink", sort === m.key && "text-brand-ink")} title={`Sort by ${m.label.toLowerCase()}`}>
                    {m.label}
                    <ArrowDown className={cx("h-3 w-3", sort !== m.key && "opacity-0")} aria-hidden />
                  </button>
                  <span className="block normal-case tracking-normal">{m.unit}</span>
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Durability</th>
              <th className="px-5 py-3 font-medium">Notes and basis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {rows.map((m) => {
              const on = picked.includes(m.id);
              return (
                <tr key={m.id} className={cx("align-top transition-colors", on ? "bg-emerald-50/40" : "hover:bg-brand-paper")}>
                  <td className="px-5 py-3.5">
                    <button type="button" onClick={() => toggle(m.id)} aria-pressed={on} aria-label={`${on ? "Remove" : "Add"} ${m.name} ${on ? "from" : "to"} comparison`} className={cx("flex h-5 w-5 items-center justify-center rounded border", on ? "border-brand-green bg-brand-green text-white" : "border-brand-line bg-white")}>
                      {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                    </button>
                  </td>
                  <td className="px-2 py-3.5">
                    <p className="font-medium text-brand-ink">{m.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone="outline">{ref.families[m.family]}</Badge>
                      {m.recycled_content >= 1 && <Badge tone="green">Recycled</Badge>}
                      {m.renewable && <Badge tone="green">Renewable</Badge>}
                    </div>
                  </td>
                  {METRICS.map((metric) => (
                    <td key={metric.key} className="tabular px-4 py-3.5 text-right text-brand-ink">
                      {fmt(m[metric.key])}
                    </td>
                  ))}
                  <td className="px-4 py-3.5">
                    <div className="flex gap-0.5" role="img" aria-label={`Durability ${m.durability} of 5`}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <span key={i} className={cx("h-1.5 w-3 rounded-sm", i < m.durability ? "bg-brand-green" : "bg-brand-line")} />
                      ))}
                    </div>
                  </td>
                  <td className="max-w-xs px-5 py-3.5 text-xs text-brand-muted">
                    <p className="text-brand-ink">{m.notes}</p>
                    <p className="mt-1">
                      {m.basis} Uncertainty ±{m.uncertainty_pct}%.
                    </p>
                    {m.alternatives.length > 0 && <p className="mt-1 text-brand-green">Suggested alternative: {m.alternatives.map((a) => ref.materialName(a.to)).join(", ")}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
