import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Trash2 } from "lucide-react";
import { Badge, Button, ButtonLink, ErrorState, Notice, PageHeader, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";
import { OptimizePanel } from "../features/assessment/OptimizePanel";
import { ReportActions } from "../features/assessment/ReportActions";
import { HotspotList, KpiRow, ManufacturingCard, MaterialCard, StageCard, TransparencyCard } from "../features/assessment/ResultSections";
import { useAsync } from "../hooks/useAsync";
import { ApiError, api } from "../services/api";
import { cx, fmtDate } from "../utils/format";
import { useProfile } from "../utils/profile";

const TABS = [
  ["results", "Impact results"],
  ["alternatives", "Alternatives & comparison"],
  ["method", "Assumptions & data quality"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function AssessmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [profile] = useProfile();
  const { data, error, loading, reload, setData } = useAsync(() => api.getAssessment(id!), [id]);
  const [tab, setTab] = useState<Tab>("results");
  const [basis, setBasis] = useState<"batch" | "unit">(profile.basis);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading && !data) return <Spinner label="Loading assessment…" />;
  if (error || !data) return <ErrorState message={error ?? "Assessment not found."} onRetry={reload} />;

  const remove = async () => {
    setDeleting(true);
    try {
      await api.deleteAssessment(data.id);
      toast.success(`Deleted “${data.name}”.`);
      navigate("/app/assessments");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed.");
      setDeleting(false);
    }
  };

  const quantified = data.recommendations.filter((r) => r.applicable).length;

  return (
    <>
      <Link to="/app/assessments" className="no-print mb-4 inline-flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-green">
        <ArrowLeft className="h-4 w-4" aria-hidden /> My assessments
      </Link>
      <PageHeader
        title={data.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {data.category} · {data.spec.production_quantity.toLocaleString("en-GB")} units · assessed {fmtDate(data.created_at)}
            </span>
            {data.is_demo && <Badge tone="outline">Demo scenario</Badge>}
          </span>
        }
        actions={
          <>
            <ReportActions id={data.id} compact />
            <ButtonLink to={`/app/reports/${data.id}`} variant="secondary" size="sm">
              <FileText className="h-4 w-4" aria-hidden /> Full report
            </ButtonLink>
            {confirming ? (
              <>
                <Button variant="danger" size="sm" onClick={remove} loading={deleting}>
                  Confirm delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label="Delete assessment">
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </>
        }
      />

      <Notice>{data.result.disclaimer}</Notice>

      <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-brand-line">
        <div className="flex gap-6" role="tablist">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cx("-mb-px border-b-2 pb-3 text-sm transition-colors", tab === key ? "border-brand-green font-semibold text-brand-dark" : "border-transparent text-brand-muted hover:text-brand-ink")}
            >
              {label}
              {key === "alternatives" && <span className="tabular ml-1.5 rounded bg-brand-ink/5 px-1.5 py-0.5 text-xs">{data.recommendations.length}</span>}
            </button>
          ))}
        </div>
        {tab === "results" && (
          <div className="mb-2 inline-flex rounded-md border border-brand-line bg-white p-0.5 text-xs" role="group" aria-label="Results basis">
            {(["batch", "unit"] as const).map((b) => (
              <button key={b} type="button" onClick={() => setBasis(b)} aria-pressed={basis === b} className={cx("rounded px-3 py-1.5 font-medium", basis === b ? "bg-brand-dark text-white" : "text-brand-muted hover:text-brand-ink")}>
                {b === "batch" ? "Whole batch" : "Per unit"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {tab === "results" && (
          <>
            <KpiRow result={data.result} basis={basis} />
            <div className="grid gap-6 lg:grid-cols-2">
              <StageCard result={data.result} basis={basis} />
              <HotspotList hotspots={data.result.hotspots} />
              <MaterialCard result={data.result} />
              <ManufacturingCard spec={data.spec} result={data.result} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-brand-dark px-6 py-5">
              <div>
                <p className="font-display text-base font-semibold text-brand-paper">{data.recommendations.length} alternatives identified for this product</p>
                <p className="mt-1 text-sm text-brand-paper/70">{quantified} can be applied and recalculated; the rest are design advice.</p>
              </div>
              <Button variant="inverse" onClick={() => { setTab("alternatives"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                Explore alternatives
              </Button>
            </div>
          </>
        )}
        {tab === "alternatives" && <OptimizePanel assessment={data} onUpdated={setData} />}
        {tab === "method" && <TransparencyCard result={data.result} />}
      </div>
    </>
  );
}
