import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Minus, RefreshCw } from "lucide-react";
import { IndexedCompareChart, StageCompareChart } from "../../components/charts";
import { Badge, Button, Card, CardHeader, EmptyState, EstimateTag, Notice } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { ApiError, api } from "../../services/api";
import type { Assessment, Comparison, Direction, Recommendation, Verdict } from "../../types";
import { cx, fmt, fmtPct, prettyUnit } from "../../utils/format";

const VERDICTS: Record<Verdict, { label: string; tone: "green" | "amber" | "neutral" | "red" }> = {
  beneficial: { label: "Improves this product", tone: "green" },
  mixed: { label: "Mixed — review trade-offs", tone: "amber" },
  advisory: { label: "Design advice · not quantified", tone: "neutral" },
  not_beneficial: { label: "No improvement here", tone: "red" },
};

const FEASIBILITY = { High: "green", Medium: "neutral", Low: "amber" } as const;

function DirectionIcon({ direction }: { direction: Direction }) {
  if (direction === "improved") return <ArrowDown className="h-3.5 w-3.5" aria-hidden />;
  if (direction === "worsened") return <ArrowUp className="h-3.5 w-3.5" aria-hidden />;
  return <Minus className="h-3.5 w-3.5" aria-hidden />;
}
const directionTone = (d: Direction) => (d === "improved" ? "text-brand-green" : d === "worsened" ? "text-red-600" : "text-brand-muted");

/* --------------------------------------------------- One recommendation card */
export function RecommendationCard({ rec, checked, onToggle, readOnly }: { rec: Recommendation; checked?: boolean; onToggle?: () => void; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const verdict = VERDICTS[rec.verdict];
  const id = `rec-${rec.id}`;
  return (
    <div className={cx("print-break-avoid rounded-lg border bg-white transition-colors", checked ? "border-brand-green" : "border-brand-line")}>
      <div className="flex items-start gap-4 p-5">
        {!readOnly && (
          <input
            id={id}
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 rounded border-brand-line accent-brand-green disabled:opacity-40"
            checked={!!checked}
            disabled={!rec.applicable}
            onChange={onToggle}
            aria-label={rec.applicable ? `Apply: ${rec.title}` : `${rec.title} (cannot be applied automatically)`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">{rec.category}</Badge>
            <Badge tone={verdict.tone}>{verdict.label}</Badge>
            <Badge tone={FEASIBILITY[rec.feasibility]}>Feasibility: {rec.feasibility}</Badge>
            {rec.significance === "marginal" && (
              <Badge tone="outline" title="The improvement is small compared with the factor uncertainty.">
                Within uncertainty
              </Badge>
            )}
          </div>
          <label htmlFor={readOnly ? undefined : id} className={cx("mt-2.5 block text-base font-semibold text-brand-dark", !readOnly && rec.applicable && "cursor-pointer")}>
            {rec.title}
          </label>
          <p className="mt-1 text-sm text-brand-ink">{rec.estimated_benefit}</p>

          {rec.impact && (
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
              {(
                [
                  ["Carbon", rec.impact.carbon_pct],
                  ["Energy", rec.impact.energy_pct],
                  ["Water", rec.impact.water_pct],
                  ["Materials", rec.impact.material_pct],
                  ["Waste", rec.impact.waste_pct],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <dt className="text-brand-muted">{label}</dt>
                  <dd className={cx("tabular font-medium", value === null || Math.abs(value) < 0.5 ? "text-brand-muted" : value < 0 ? "text-brand-green" : "text-red-600")}>{fmtPct(value)}</dd>
                </div>
              ))}
            </dl>
          )}

          <button type="button" className="no-print mt-3 flex items-center gap-1 text-xs font-medium text-brand-green hover:underline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Hide" : "Show"} cost, feasibility and trade-offs
            <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
          </button>

          <dl className={cx("mt-4 space-y-3 border-t border-brand-line pt-4 text-sm print:block", !open && "hidden")}>
            {(
              [
                ["Current situation", rec.current_situation],
                ["Suggested alternative", rec.suggested_alternative],
                ["Cost implications", rec.cost_implications],
                ["Feasibility", `${rec.feasibility} — ${rec.feasibility_note}`],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="grid gap-1 sm:grid-cols-[11rem_1fr]">
                <dt className="text-brand-muted">{k}</dt>
                <dd className="text-brand-ink">{v}</dd>
              </div>
            ))}
            <div className="grid gap-1 sm:grid-cols-[11rem_1fr]">
              <dt className="text-brand-muted">Trade-offs and limitations</dt>
              <dd>
                <ul className="list-disc space-y-1 pl-4 text-brand-ink">
                  {rec.trade_offs.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------- Side-by-side comparison */
export function ComparisonView({ comparison, appliedCount }: { comparison: Comparison; appliedCount: number }) {
  const s = comparison.summary;
  if (appliedCount === 0) {
    return <EmptyState title="Nothing applied yet" description="Select one or more recommendations and recalculate to see the optimised product next to the original." />;
  }
  const carbon = s.carbon_change_pct ?? 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 sm:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-brand-muted">Estimated carbon change</p>
            <EstimateTag />
          </div>
          <p className={cx("tabular mt-3 font-display text-4xl font-semibold", carbon < -0.5 ? "text-brand-green" : carbon > 0.5 ? "text-red-600" : "text-brand-muted")}>{fmtPct(s.carbon_change_pct)}</p>
          <p className="mt-1 text-xs text-brand-muted">
            {s.carbon_saved_kg >= 0 ? `About ${fmt(s.carbon_saved_kg, 2)} kg CO₂e avoided` : `About ${fmt(-s.carbon_saved_kg, 2)} kg CO₂e added`} across the batch · {appliedCount} change{appliedCount === 1 ? "" : "s"} applied
          </p>
        </Card>
        <Card className="p-5 sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-muted">Resource savings (whole batch, estimated)</p>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(
              [
                ["Energy", s.energy_saved_kwh, "kWh"],
                ["Water", s.water_saved_l, "L"],
                ["Materials", s.material_saved_kg, "kg"],
                ["Waste", s.waste_saved_kg, "kg"],
              ] as const
            ).map(([label, value, unit]) => (
              <div key={label}>
                <dt className="text-xs text-brand-muted">{label}</dt>
                <dd className={cx("tabular mt-1 font-display text-lg font-semibold", value > 0 ? "text-brand-dark" : value < 0 ? "text-red-600" : "text-brand-muted")}>
                  {value === 0 ? "No change" : `${value > 0 ? "−" : "+"}${fmt(Math.abs(value), 2)} ${unit}`}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      {s.worsened.length > 0 && (
        <Notice tone="warn">
          Not everything improved: <strong>{s.worsened.join(", ").toLowerCase()}</strong> {s.worsened.length === 1 ? "is" : "are"} higher in the optimised product. Review the trade-offs of the selected changes.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Original vs. optimised" hint="Each indicator indexed to the original product (= 100)" />
          <div className="p-5">
            <IndexedCompareChart metrics={comparison.metrics} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Carbon by life-cycle stage" hint="Estimated kg CO₂e, whole batch" />
          <div className="p-5">
            <StageCompareChart stages={comparison.stages} height={280} />
          </div>
        </Card>
      </div>

      <Card className="print-break-avoid overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-brand-line text-left text-xs uppercase tracking-wider text-brand-muted">
              <th className="px-5 py-3 font-medium">Indicator (whole batch)</th>
              <th className="px-5 py-3 text-right font-medium">Original</th>
              <th className="px-5 py-3 text-right font-medium">Optimised</th>
              <th className="px-5 py-3 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {comparison.metrics.map((m) => (
              <tr key={m.key}>
                <td className="px-5 py-3 text-brand-ink">{m.label}</td>
                <td className="tabular px-5 py-3 text-right text-brand-muted">
                  {fmt(m.original)} {prettyUnit(m.unit)}
                </td>
                <td className="tabular px-5 py-3 text-right font-medium text-brand-ink">
                  {fmt(m.optimized)} {prettyUnit(m.unit)}
                </td>
                <td className={cx("tabular px-5 py-3 text-right font-medium", directionTone(m.direction))}>
                  <span className="inline-flex items-center gap-1">
                    <DirectionIcon direction={m.direction} />
                    {fmtPct(m.change_pct)}
                  </span>
                </td>
              </tr>
            ))}
            {comparison.circularity.map((m) => (
              <tr key={m.key}>
                <td className="px-5 py-3 text-brand-ink">{m.label}</td>
                <td className="px-5 py-3 text-right text-brand-muted">{m.original}</td>
                <td className="px-5 py-3 text-right font-medium text-brand-ink">{m.optimized}</td>
                <td className={cx("px-5 py-3 text-right font-medium capitalize", directionTone(m.direction))}>{m.direction}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-brand-line px-5 py-3 text-xs text-brand-muted">{comparison.basis} Differences are modelled estimates, not verified reductions.</p>
      </Card>
    </div>
  );
}

/* ------------------------- Select recommendations, recalculate, then compare */
export function OptimizePanel({ assessment, onUpdated }: { assessment: Assessment; onUpdated: (next: Assessment) => void }) {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(assessment.selected_ids));
  const [saving, setSaving] = useState(false);

  const applied = useMemo(() => new Set(assessment.selected_ids), [assessment.selected_ids]);
  const dirty = selected.size !== applied.size || [...selected].some((id) => !applied.has(id));
  const applicable = assessment.recommendations.filter((r) => r.applicable);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const recalculate = async (ids: string[]) => {
    setSaving(true);
    try {
      const next = await api.optimize(assessment.id, ids);
      setSelected(new Set(next.selected_ids));
      onUpdated(next);
      toast.success(next.selected_ids.length ? `Optimised product recalculated with ${next.selected_ids.length} change${next.selected_ids.length === 1 ? "" : "s"}.` : "All changes removed. The optimised product now matches the original.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Recalculation failed.");
    } finally {
      setSaving(false);
    }
  };

  if (assessment.recommendations.length === 0) {
    return <EmptyState title="No recommendations triggered" description="None of the screening rules found a clear improvement for this specification." />;
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-brand-dark">Sustainable alternatives</h2>
            <p className="mt-1 max-w-2xl text-sm text-brand-muted">
              Each quantified alternative has been recalculated for this product with the same engine. Tick the ones you want to apply — nothing is assumed to be better.
            </p>
          </div>
          <div className="no-print flex items-center gap-2 text-sm">
            <button type="button" className="text-brand-green hover:underline" onClick={() => setSelected(new Set(applicable.filter((r) => r.verdict === "beneficial").map((r) => r.id)))}>
              Select beneficial
            </button>
            <span className="text-brand-line">|</span>
            <button type="button" className="text-brand-green hover:underline" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {assessment.recommendations.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} checked={selected.has(rec.id)} onToggle={() => toggle(rec.id)} />
          ))}
        </div>

        <div className="no-print sticky bottom-4 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-line bg-white px-5 py-3 shadow-lg shadow-brand-dark/5">
          <p className="text-sm text-brand-muted">
            <span className="font-semibold text-brand-ink">{selected.size}</span> of {applicable.length} applicable changes selected
            {dirty && <span className="ml-2 text-amber-700">· not yet recalculated</span>}
          </p>
          <Button onClick={() => recalculate([...selected])} loading={saving} disabled={!dirty}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Apply and recalculate
          </Button>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-brand-dark">Original vs. optimised product</h2>
        <ComparisonView comparison={assessment.comparison} appliedCount={assessment.selected_ids.length} />
      </div>
    </div>
  );
}
