import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "../components/brand/BrandLogo";
import { Dl, ErrorState, Spinner } from "../components/ui";
import { ComparisonView, RecommendationCard } from "../features/assessment/OptimizePanel";
import { ReportActions } from "../features/assessment/ReportActions";
import { DataQualityMeter, HotspotList, KpiRow, ManufacturingCard, MaterialCard, StageCard, TransparencyCard } from "../features/assessment/ResultSections";
import { useAsync } from "../hooks/useAsync";
import { useReference } from "../hooks/useReference";
import { api } from "../services/api";
import { fmt, fmtDate } from "../utils/format";

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-baseline gap-3 border-b border-brand-dark pb-2 text-lg font-semibold text-brand-dark">
        <span className="tabular text-sm text-brand-muted">{String(number).padStart(2, "0")}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** On-screen and print version of the environmental screening report. */
export default function ReportView() {
  const { id } = useParams();
  const ref = useReference();
  const { data, error, loading, reload } = useAsync(() => api.getAssessment(id!), [id]);

  if (loading && !data) return <Spinner label="Preparing report…" />;
  if (error || !data) return <ErrorState message={error ?? "Report not found."} onRetry={reload} />;

  const { spec, result } = data;
  const selected = new Set(data.selected_ids);

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/app/reports" className="inline-flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-green">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Impact reports
        </Link>
        <div className="flex flex-wrap gap-2">
          <ReportActions id={data.id} onPrint={() => window.print()} />
        </div>
      </div>

      <article className="rounded-lg border border-brand-line bg-white p-6 sm:p-10 print:border-0 print:p-0">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-brand-line pb-6">
          <BrandLogo size={36} />
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-muted">Environmental screening report</p>
        </header>

        <div className="mt-8">
          <p className="eyebrow">Think Before You Manufacture.</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-dark">{data.name}</h1>
          <p className="mt-2 text-sm text-brand-muted">
            {data.category} · Assessment #{data.id} · {fmtDate(data.created_at)}
            {data.is_demo && " · Demonstration data"}
          </p>
          <p className="mt-5 border-l-2 border-brand-emerald bg-brand-paper px-4 py-3 text-sm text-brand-dark">{result.disclaimer}</p>
        </div>

        <Section number={1} title="Assessment summary">
          <KpiRow result={result} basis="batch" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-line px-5 py-3">
            <span className="text-sm text-brand-muted">Data-quality indicator</span>
            <DataQualityMeter dq={result.data_quality} />
          </div>
        </Section>

        <Section number={2} title="Product information">
          <div className="grid gap-x-10 md:grid-cols-2">
            <Dl
              rows={[
                ["Product", spec.name],
                ["Category", spec.category],
                ["Production quantity", `${spec.production_quantity.toLocaleString("en-GB")} units`],
                ["Product weight", `${fmt(spec.product_weight_kg)} kg`],
              ]}
            />
            <Dl
              rows={[
                ["Expected lifespan", `${fmt(spec.lifespan_years)} years`],
                ["Use", ref.use_types[spec.end_of_life.use_type]],
                ["Repairability", ref.repairability_levels[spec.end_of_life.repairability]],
                ["Functional unit", result.functional_unit],
              ]}
            />
          </div>
          {spec.description && <p className="mt-3 text-sm text-brand-muted">{spec.description}</p>}
        </Section>

        <Section number={3} title="Environmental impact breakdown">
          <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-1">
            <StageCard result={result} basis="batch" />
            <HotspotList hotspots={result.hotspots} />
          </div>
        </Section>

        <Section number={4} title="Material and manufacturing analysis">
          <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-1">
            <MaterialCard result={result} />
            <ManufacturingCard spec={spec} result={result} />
          </div>
        </Section>

        <Section number={5} title="Recommended alternatives">
          {data.recommendations.length === 0 ? (
            <p className="text-sm text-brand-muted">No rule-based recommendations were triggered for this specification.</p>
          ) : (
            <div className="space-y-3">
              {data.recommendations.map((rec) => (
                <div key={rec.id}>
                  {selected.has(rec.id) && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-green">Applied in optimised scenario</p>}
                  <RecommendationCard rec={rec} readOnly checked={selected.has(rec.id)} />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section number={6} title="Original vs. optimised comparison">
          <ComparisonView comparison={data.comparison} appliedCount={data.selected_ids.length} />
        </Section>

        <Section number={7} title="Assumptions, limitations and data quality">
          <TransparencyCard result={result} />
        </Section>

        <footer className="mt-10 border-t border-brand-line pt-4 text-xs text-brand-muted">
          Generated by Waste Before Waste. Preliminary screening with illustrative factors — estimates only, not a certified ISO 14040/14044 Life Cycle Assessment.
        </footer>
      </article>
    </>
  );
}
