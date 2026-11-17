import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { GitCompareArrows } from "lucide-react";
import { ButtonLink, EmptyState, ErrorState, Notice, PageHeader, Spinner } from "../components/ui";
import { OptimizePanel } from "../features/assessment/OptimizePanel";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const list = useAsync(api.listAssessments);
  const selectedId = params.get("id");

  // Default to the most recent assessment.
  useEffect(() => {
    if (!selectedId && list.data?.length) setParams({ id: String(list.data[0].id) }, { replace: true });
  }, [selectedId, list.data, setParams]);

  const detail = useAsync(() => (selectedId ? api.getAssessment(selectedId) : Promise.resolve(null)), [selectedId]);

  return (
    <>
      <PageHeader
        title="Compare alternatives"
        description="Choose a product, select the changes you would make, and compare the recalculated product with the original."
        actions={
          list.data && list.data.length > 0 ? (
            <select className="input h-10 w-72" value={selectedId ?? ""} onChange={(e) => setParams({ id: e.target.value })} aria-label="Product to compare">
              {list.data.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : list.loading && !list.data ? (
        <Spinner />
      ) : list.data!.length === 0 ? (
        <EmptyState icon={<GitCompareArrows className="h-8 w-8" />} title="Nothing to compare yet" description="Run an assessment first; its alternatives will appear here." action={<ButtonLink to="/app/new">New assessment</ButtonLink>} />
      ) : detail.error ? (
        <ErrorState message={detail.error} onRetry={detail.reload} />
      ) : !detail.data ? (
        <Spinner label="Loading comparison…" />
      ) : (
        <div className="space-y-6">
          <Notice>
            Both products are calculated with the same boundary and illustrative factors. An alternative is only shown as better when the recalculated numbers say so, and trade-offs in other indicators are flagged.
          </Notice>
          <OptimizePanel key={detail.data.id} assessment={detail.data} onUpdated={detail.setData} />
        </div>
      )}
    </>
  );
}
