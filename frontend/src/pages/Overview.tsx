import { Link } from "react-router-dom";
import { ArrowRight, PackageSearch } from "lucide-react";
import { DonutChart, HistoryChart, PairedBars, STAGE_COLORS } from "../components/charts";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, ErrorState, EstimateTag, Notice, PageHeader, Skeleton, Stat } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import { fmt, fmtDate, fmtMass, fmtPct, fmtVolume } from "../utils/format";
import { useProfile } from "../utils/profile";

export default function Overview() {
  const { data, error, loading, reload } = useAsync(api.dashboard);
  const [profile] = useProfile();

  if (error) return <ErrorState message={error} onRetry={reload} />;

  const header = (
    <PageHeader
      title={`Welcome, ${profile.name.split(" ")[0]}`}
      description="A summary of every product screened in this workspace. All impact figures are estimates for whole production batches."
      actions={
        <ButtonLink to="/app/new">
          Start an assessment <ArrowRight className="h-4 w-4" aria-hidden />
        </ButtonLink>
      }
    />
  );

  if (loading || !data) {
    return (
      <>
        {header}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </>
    );
  }

  if (data.totals.products === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<PackageSearch className="h-8 w-8" />}
          title="No products analysed yet"
          description="Run your first assessment to see environmental hotspots, alternatives and comparisons here. You can also restore the demo data in Settings."
          action={<ButtonLink to="/app/new">New assessment</ButtonLink>}
        />
      </>
    );
  }

  const t = data.totals;
  return (
    <>
      {header}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Products analysed" value={String(t.products)} note="Saved assessments" />
        <Stat label="Avg. carbon footprint" value={fmt(t.avg_carbon_per_unit_kg)} unit="kg CO₂e / unit" note="Mean across different product types; not a benchmark" tag={<EstimateTag />} />
        <Stat label="Carbon avoidable" value={fmt(t.carbon_avoided_kg)} unit="kg CO₂e" note={`${t.carbon_avoided_pct.toFixed(0)}% of ${fmt(t.total_carbon_kg)} kg, if applied`} tag={<EstimateTag label="Potential" />} />
        <Stat label="Resources saved" value={fmtVolume(t.water_saved_l)} note={`water · plus ${fmtMass(t.material_saved_kg)} of material`} tag={<EstimateTag label="Potential" />} />
        <Stat label="Waste reduction" value={fmtMass(t.waste_saved_kg)} note={`${t.waste_reduction_pct.toFixed(0)}% of manufacturing scrap`} tag={<EstimateTag label="Potential" />} />
      </div>

      <div className="mt-4">
        <Notice>
          “Potential” figures compare each original product with its optimised scenario — the recommendations currently selected for it. They are modelled estimates using illustrative factors, not verified reductions.
        </Notice>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Environmental impact by category" hint="Estimated kg CO₂e by life-cycle stage, all products" />
          <div className="p-5">
            <DonutChart unit="kg" data={data.by_stage.map((s) => ({ name: s.label, value: s.carbon_kg, color: STAGE_COLORS[s.key] }))} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Material usage breakdown" hint="Gross material input including scrap, all products" />
          <div className="p-5">
            <DonutChart unit="kg" data={data.materials.map((m) => ({ name: m.name, value: m.kg }))} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Carbon footprint comparison" hint="Original vs. optimised scenario, kg CO₂e per batch" />
          <div className="p-5">
            <PairedBars unit="kg CO₂e" data={data.comparison} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Assessment history" hint="Cumulative estimated footprint screened, kg CO₂e" />
          <div className="p-5">
            <HistoryChart data={data.history} />
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Recent assessments"
          action={
            <Link to="/app/assessments" className="text-sm font-medium text-brand-green hover:underline">
              View all
            </Link>
          }
        />
        <ul className="divide-y divide-brand-line">
          {data.recent.map((a) => (
            <li key={a.id}>
              <Link to={`/app/assessments/${a.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-brand-paper">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brand-ink">{a.name}</p>
                  <p className="text-xs text-brand-muted">
                    {a.category} · {fmtDate(a.created_at)} · top hotspot: {a.top_hotspot ?? "none"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular text-sm text-brand-ink">{fmt(a.carbon_batch_kg)} kg CO₂e</span>
                  <Badge tone={a.carbon_change_pct && a.carbon_change_pct < -0.5 ? "green" : "neutral"}>{fmtPct(a.carbon_change_pct)} optimised</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
