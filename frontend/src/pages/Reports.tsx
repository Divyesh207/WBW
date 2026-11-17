import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { ButtonLink, Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/ui";
import { ReportActions } from "../features/assessment/ReportActions";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import { fmt, fmtDate, fmtPct } from "../utils/format";

export default function Reports() {
  const { data, error, loading, reload } = useAsync(api.listAssessments);

  return (
    <>
      <PageHeader title="Impact reports" description="Each assessment produces a full environmental screening report. Open it to read or print, download it as a PDF, or export the data as JSON." />
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data!.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="No reports yet" description="Reports are generated automatically for every assessment you run." action={<ButtonLink to="/app/new">New assessment</ButtonLink>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data!.map((a) => (
            <Card key={a.id} className="flex flex-col p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-paper text-brand-green">
                  <FileText className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <Link to={`/app/reports/${a.id}`} className="block truncate text-base font-semibold text-brand-dark hover:text-brand-green">
                    {a.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-brand-muted">
                    {a.category} · {fmtDate(a.created_at)} · data quality: {a.data_quality.toLowerCase()}
                  </p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-brand-line py-3 text-sm">
                <div>
                  <dt className="text-xs text-brand-muted">Batch footprint</dt>
                  <dd className="tabular mt-0.5 font-medium text-brand-ink">{fmt(a.carbon_batch_kg)} kg CO₂e</dd>
                </div>
                <div>
                  <dt className="text-xs text-brand-muted">Optimised</dt>
                  <dd className="tabular mt-0.5 font-medium text-brand-ink">{a.applied_count ? fmtPct(a.carbon_change_pct) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-brand-muted">Alternatives</dt>
                  <dd className="tabular mt-0.5 font-medium text-brand-ink">
                    {a.applied_count} of {a.recommendation_count} applied
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink to={`/app/reports/${a.id}`} size="sm">
                  Open report
                </ButtonLink>
                <ReportActions id={a.id} compact />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
