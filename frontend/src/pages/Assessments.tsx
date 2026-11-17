import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Search } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { useReference } from "../hooks/useReference";
import { api } from "../services/api";
import { fmt, fmtDate, fmtPct } from "../utils/format";

export default function Assessments() {
  const ref = useReference();
  const { data, error, loading, reload } = useAsync(api.listAssessments);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const rows = useMemo(
    () => (data ?? []).filter((a) => (!category || a.category === category) && a.name.toLowerCase().includes(query.trim().toLowerCase())),
    [data, query, category],
  );

  return (
    <>
      <PageHeader title="My assessments" description="Every product screened in this workspace is saved here, so you can revisit and refine it." actions={<ButtonLink to="/app/new">New assessment</ButtonLink>} />

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data!.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-8 w-8" />} title="No assessments yet" description="Assess a product to see it saved here. Demo data can be restored from Settings." action={<ButtonLink to="/app/new">Start your first assessment</ButtonLink>} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[14rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-brand-muted" aria-hidden />
              <input className="input pl-9" placeholder="Search by product name" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search assessments" />
            </div>
            <select className="input w-56" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
              <option value="">All categories</option>
              {ref.categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {rows.length === 0 ? (
            <EmptyState title="No matches" description="No assessment matches the current search and filter." />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-brand-line text-left text-xs uppercase tracking-wider text-brand-muted">
                    <th className="px-5 py-3 font-medium">Product</th>
                    <th className="px-5 py-3 font-medium">Assessed</th>
                    <th className="px-5 py-3 text-right font-medium">Per unit</th>
                    <th className="px-5 py-3 text-right font-medium">Batch (est.)</th>
                    <th className="px-5 py-3 font-medium">Top hotspot</th>
                    <th className="px-5 py-3 text-right font-medium">Optimised</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-line">
                  {rows.map((a) => (
                    <tr key={a.id} className="transition-colors hover:bg-brand-paper">
                      <td className="px-5 py-3.5">
                        <Link to={`/app/assessments/${a.id}`} className="font-medium text-brand-ink hover:text-brand-green">
                          {a.name}
                        </Link>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-brand-muted">
                          {a.category} · {a.production_quantity.toLocaleString("en-GB")} units
                          {a.is_demo && <Badge tone="outline">Demo</Badge>}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-brand-muted">{fmtDate(a.created_at)}</td>
                      <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-brand-ink">{fmt(a.carbon_per_unit_kg)} kg</td>
                      <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-brand-ink">
                        {fmt(a.carbon_batch_kg)} kg <span className="text-xs text-brand-muted">±{a.uncertainty_pct}%</span>
                      </td>
                      <td className="px-5 py-3.5 text-brand-muted">{a.top_hotspot ?? "—"}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Badge tone={a.carbon_change_pct !== null && a.carbon_change_pct < -0.5 ? "green" : "neutral"}>{a.applied_count ? fmtPct(a.carbon_change_pct) : "Not optimised"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-brand-line px-5 py-3 text-xs text-brand-muted">Carbon in kg CO₂e. All values are estimates based on illustrative factors.</p>
            </Card>
          )}
        </>
      )}
    </>
  );
}
