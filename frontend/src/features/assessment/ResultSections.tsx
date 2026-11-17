import { AlertTriangle, Droplets, Flame, Gauge, Trash2, Zap } from "lucide-react";
import { DonutChart, StageChart } from "../../components/charts";
import { Badge, Card, CardHeader, Dl, EstimateTag, Stat } from "../../components/ui";
import { useReference } from "../../hooks/useReference";
import type { AssessmentResult, Hotspot, ProductSpec } from "../../types";
import { cx, fmt, fmtMass, fmtVolume, prettyUnit } from "../../utils/format";

/** Sections shared by the assessment page and the printable report. */

export function DataQualityMeter({ dq }: { dq: AssessmentResult["data_quality"] }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1" role="img" aria-label={`Data quality ${dq.score} of ${dq.max_score}`}>
        {Array.from({ length: dq.max_score }, (_, i) => (
          <span key={i} className={cx("h-2 w-6 rounded-sm", i < dq.score ? "bg-brand-green" : "bg-brand-line")} />
        ))}
      </div>
      <span className="text-sm font-medium text-brand-ink">{dq.rating}</span>
      <span className="text-xs text-brand-muted">±{dq.uncertainty_pct}% factor uncertainty</span>
    </div>
  );
}

export function KpiRow({ result, basis }: { result: AssessmentResult; basis: "batch" | "unit" }) {
  const t = basis === "batch" ? result.batch : result.per_unit;
  const scope = basis === "batch" ? `batch of ${result.production_quantity.toLocaleString("en-GB")}` : "per unit";
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Carbon footprint" value={fmt(t.carbon_kg)} unit="kg CO₂e" note={`Range ${fmt(t.carbon_low_kg, 2)}–${fmt(t.carbon_high_kg, 2)} · ${scope}`} tag={<EstimateTag />} />
      <Stat label="Energy consumption" value={fmt(t.energy_kwh)} unit="kWh" note={`${fmt(t.process_energy_kwh)} process (entered) + ${fmt(t.embodied_energy_kwh)} embodied`} tag={<EstimateTag />} />
      <Stat label="Water consumption" value={fmtVolume(t.water_l)} note={`${fmtVolume(t.process_water_l)} process (entered) + ${fmtVolume(t.embodied_water_l)} embodied`} tag={<EstimateTag />} />
      <Stat label="Manufacturing waste" value={fmtMass(t.waste_kg)} note={`from ${fmtMass(t.raw_material_kg)} of material and packaging`} tag={<Badge tone="outline">Calculated</Badge>} />
    </div>
  );
}

export function StageCard({ result, basis }: { result: AssessmentResult; basis: "batch" | "unit" }) {
  return (
    <Card className="print-break-avoid">
      <CardHeader title="Environmental impact breakdown" hint={`Estimated kg CO₂e by life-cycle stage, ${basis === "batch" ? "whole batch" : "per unit"}`} />
      <div className="p-5">
        <StageChart stages={result.stages} basis={basis} />
        <p className="mt-3 text-xs text-brand-muted">
          <span className="font-medium text-brand-ink">Boundary:</span> {result.boundary}
        </p>
      </div>
    </Card>
  );
}

export function MaterialCard({ result }: { result: AssessmentResult }) {
  const single = result.materials.length === 1;
  return (
    <Card className="print-break-avoid">
      <CardHeader title="Material analysis" hint="Estimated carbon per unit by material (gross input incl. scrap)" />
      <div className="p-5">
        {!single && <DonutChart unit="kg CO₂e" height={180} data={result.materials.map((m) => ({ name: m.name, value: m.carbon_kg }))} />}
        <table className={cx("w-full text-sm", !single && "mt-4")}>
          <thead>
            <tr className="border-b border-brand-line text-left text-xs uppercase tracking-wider text-brand-muted">
              <th className="py-2 font-medium">Material</th>
              <th className="py-2 text-right font-medium">In product</th>
              <th className="py-2 text-right font-medium">Factor</th>
              <th className="py-2 text-right font-medium">Carbon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {result.materials.map((m) => (
              <tr key={m.material_id}>
                <td className="py-2.5">
                  <span className="text-brand-ink">{m.name}</span>
                  <span className="block text-xs text-brand-muted">
                    {m.family} · {m.share_weight_pct.toFixed(0)}% of mass
                  </span>
                </td>
                <td className="tabular py-2.5 text-right text-brand-muted">{fmtMass(m.net_kg)}</td>
                <td className="tabular py-2.5 text-right text-brand-muted">{m.emission_factor} kg/kg</td>
                <td className="tabular py-2.5 text-right font-medium text-brand-ink">
                  {fmtMass(m.carbon_kg)} <span className="font-normal text-brand-muted">· {m.share_carbon_pct.toFixed(0)}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-brand-muted">
          Recycled content {result.circularity.recycled_content_pct.toFixed(0)}% · renewable content {result.circularity.renewable_content_pct.toFixed(0)}% by mass. Factors are illustrative.
        </p>
      </div>
    </Card>
  );
}

/** The four evidence classes are kept visually distinct wherever results are explained. */
const EVIDENCE_TONES: Record<string, "neutral" | "green" | "amber" | "outline"> = {
  "user-provided": "neutral",
  "published factor": "green",
  "illustrative assumption": "amber",
  "model estimate": "outline",
};

const HOTSPOT_ICONS: Record<string, typeof Flame> = { Carbon: Flame, Energy: Zap, Water: Droplets, Waste: Trash2 };
const SEVERITY = { high: "amber", medium: "neutral", low: "outline" } as const;

export function HotspotList({ hotspots }: { hotspots: Hotspot[] }) {
  return (
    <Card className="print-break-avoid">
      <CardHeader title="Environmental hotspots" hint="Where this specification concentrates its impact" />
      <ul className="divide-y divide-brand-line">
        {hotspots.map((h) => {
          const Icon = HOTSPOT_ICONS[h.indicator] ?? AlertTriangle;
          return (
            <li key={h.id} className="flex gap-4 px-5 py-4">
              <span className={cx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md", h.severity === "high" ? "bg-amber-50 text-amber-700" : "bg-brand-paper text-brand-green")}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-brand-ink">{h.area}</p>
                  <Badge tone={SEVERITY[h.severity]}>{h.severity} priority</Badge>
                  <Badge tone="outline">{h.indicator}</Badge>
                </div>
                <p className="mt-1 text-sm text-brand-muted">{h.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function ManufacturingCard({ spec, result }: { spec: ProductSpec; result: AssessmentResult }) {
  const ref = useReference();
  const b = result.benchmarks;
  const m = spec.manufacturing;
  return (
    <Card className="print-break-avoid">
      <CardHeader title="Manufacturing analysis" hint="Entered values checked against indicative process benchmarks" />
      <div className="px-5 py-2">
        <Dl
          rows={[
            ["Method", ref.methodName(m.method)],
            ["Energy intensity", `${fmt(b.energy_kwh_per_kg)} kWh/kg · ${fmt(b.energy_ratio, 2)}× benchmark (${b.typical_energy_kwh_per_kg} kWh/kg)`],
            ["Energy source", ref.sourceName(m.energy_source)],
            ["Scrap rate", `${fmt(m.waste_pct)}% · benchmark ${b.typical_waste_pct}%`],
            ["Transport", `${fmt(m.transport_distance_km)} km by ${ref.modeName(m.transport_mode).toLowerCase()}`],
            ["Packaging", `${ref.packagingName(spec.packaging.material)} · ${fmtMass(spec.packaging.weight_kg)} per unit`],
            ["End-of-life", `${result.circularity.recyclability_label} recyclability · ${result.circularity.disposal_label.toLowerCase()}`],
            ["Annualised footprint", `${fmt(result.per_unit.annualised_carbon_kg)} kg CO₂e per unit per year of service`],
          ]}
        />
      </div>
    </Card>
  );
}

export function TransparencyCard({ result }: { result: AssessmentResult }) {
  return (
    <Card>
      <CardHeader title="Assumptions, data quality and factors" hint="How these estimates were produced" action={<Gauge className="h-4 w-4 text-brand-muted" aria-hidden />} />
      <div className="grid gap-8 p-5 lg:grid-cols-2">
        <div>
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-brand-ink">Data-quality indicator</h3>
          <div className="mt-3">
            <DataQualityMeter dq={result.data_quality} />
          </div>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-brand-muted">
            {result.data_quality.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <h3 className="mt-6 font-sans text-xs font-semibold uppercase tracking-wider text-brand-ink">Where each number comes from</h3>
          <p className="mt-1 text-xs text-brand-muted">Nothing here is measured by the tool. Inputs are yours; results are model estimates.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {result.provenance.map((p) => (
              <li key={p.metric} className="flex items-start justify-between gap-4">
                <span className="text-brand-muted">{p.metric}</span>
                <Badge tone={EVIDENCE_TONES[p.basis] ?? "outline"} title={p.note}>{p.basis}</Badge>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-brand-ink">Assumptions and limitations</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-brand-muted">
            {result.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-brand-line">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-brand-line text-left text-xs uppercase tracking-wider text-brand-muted">
              <th className="px-5 py-3 font-medium">Factor used</th>
              <th className="px-5 py-3 text-right font-medium">Value</th>
              <th className="px-5 py-3 font-medium">Assumed basis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {result.factors_used.map((f) => (
              <tr key={f.name}>
                <td className="px-5 py-2.5 text-brand-ink">{f.name}</td>
                <td className="tabular whitespace-nowrap px-5 py-2.5 text-right text-brand-ink">
                  {f.value} {prettyUnit(f.unit)}
                </td>
                <td className="px-5 py-2.5 text-brand-muted">
                  <Badge tone={f.source_type === "published" ? "green" : "amber"}>{f.source_type === "published" ? "Published" : "Illustrative"}</Badge>
                  <span className="mt-1 block">{f.basis}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
