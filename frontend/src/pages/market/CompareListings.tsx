import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, X } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, ErrorState, Notice, PageHeader, Spinner } from "../../components/ui";
import { AvailabilityBadge, CategoryBadge, DemoTag, GradeBadge, kg, money } from "../../features/market/shared";
import { useAsync } from "../../hooks/useAsync";
import { marketApi } from "../../services/marketApi";
import type { Comparison, Listing } from "../../types/market";
import { cx } from "../../utils/format";

type BestKey = keyof Comparison["best"];

export default function CompareListings() {
  const [params, setParams] = useSearchParams();
  const ids = (params.get("ids") ?? "").split(",").map(Number).filter(Boolean);
  const quantity = params.get("qty") ? Number(params.get("qty")) : null;
  const [qtyInput, setQtyInput] = useState(quantity ? String(quantity) : "");
  const { data, error, loading, reload } = useAsync(() => (ids.length >= 2 ? marketApi.compare(ids, quantity) : Promise.resolve(null)), [params.toString()]);

  if (ids.length < 2) {
    return <EmptyState title="Pick listings to compare" description="Tick two to four listings on the browse page, then choose Compare." action={<ButtonLink to="/app/market/browse">Browse materials</ButtonLink>} />;
  }
  if (loading && !data) return <Spinner label="Comparing listings…" />;
  if (error || !data) return <ErrorState message={error ?? "Comparison failed."} onRetry={reload} />;

  const best = (key: BestKey, id: number) => data.best[key] === id;
  const rows: { label: string; key?: BestKey; render: (l: Listing) => React.ReactNode }[] = [
    { label: "Price per kg", key: "lowest_price", render: (l) => <span className="tabular font-semibold">{money(l.price_per_kg, l.currency)}</span> },
    { label: "Quality grade", key: "highest_quality", render: (l) => <GradeBadge grade={l.quality_grade} /> },
    { label: "Available quantity", key: "most_available", render: (l) => <span className="tabular">{kg(l.available_kg)}</span> },
    { label: "Availability", render: (l) => <AvailabilityBadge value={l.availability} /> },
    { label: "Minimum order", render: (l) => <span className="tabular">{kg(l.min_order_kg)}</span> },
    { label: "Recycled content", key: "highest_recycled_content", render: (l) => <span className="tabular">{l.recycled_content_pct}%</span> },
    { label: "Lead time", key: "shortest_lead_time", render: (l) => <span className="tabular">{l.lead_time_days} days</span> },
    { label: "Category", render: (l) => <CategoryBadge category={l.category} /> },
    { label: "Location", render: (l) => l.location },
    {
      label: "Illustrative carbon (library)",
      key: "lowest_illustrative_carbon",
      render: (l) => (l.library ? <span className="tabular">{l.library.emission_factor} kg CO₂e/kg</span> : <span className="text-brand-muted">Not linked</span>),
    },
  ];

  return (
    <>
      <Link to="/app/market/browse" className="mb-4 inline-flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-green">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Browse materials
      </Link>
      <PageHeader
        title="Compare listings"
        description="Side by side on price, quality, quantity and availability. The best value in each row is highlighted."
        actions={
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const next = new URLSearchParams(params);
              if (Number(qtyInput) > 0) next.set("qty", qtyInput);
              else next.delete("qty");
              setParams(next);
            }}
          >
            <label htmlFor="qty" className="text-sm text-brand-muted">
              For a quantity of
            </label>
            <input id="qty" type="number" min={1} className="input h-10 w-28" placeholder="kg" value={qtyInput} onChange={(e) => setQtyInput(e.target.value)} />
            <button type="submit" className="h-10 rounded-md border border-brand-line bg-white px-3 text-sm font-medium hover:border-brand-green">
              Check
            </button>
          </form>
        }
      />

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-brand-line align-top">
              <th className="w-48 px-5 py-4" />
              {data.listings.map((l) => (
                <th key={l.id} className="px-5 py-4 text-left font-normal">
                  <Link to={`/app/market/listings/${l.id}`} className="block text-base font-semibold text-brand-dark hover:text-brand-green">
                    {l.title}
                  </Link>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-muted">
                    {l.supplier_name} <DemoTag show={l.supplier_is_demo} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-muted">
                  {row.label}
                </th>
                {data.listings.map((l) => {
                  const top = row.key ? best(row.key, l.id) : false;
                  return (
                    <td key={l.id} className={cx("px-5 py-3 text-brand-ink", top && "bg-emerald-50/70")}>
                      <span className="inline-flex items-center gap-2">
                        {row.render(l)}
                        {top && (
                          <Badge tone="green">
                            <Check className="h-3 w-3" aria-hidden /> Best
                          </Badge>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {quantity && (
              <>
                <tr className="bg-brand-paper/60">
                  <th scope="row" className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-muted">
                    Cost for {kg(quantity)}
                  </th>
                  {data.listings.map((l) => (
                    <td key={l.id} className="tabular px-5 py-3 font-semibold text-brand-dark">
                      {money(l.quantity_check?.total_cost, l.currency)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-brand-paper/60">
                  <th scope="row" className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-brand-muted">
                    Can supply this?
                  </th>
                  {data.listings.map((l) => (
                    <td key={l.id} className="px-5 py-3">
                      {l.quantity_check?.can_supply ? (
                        <span className="inline-flex items-center gap-1 text-brand-green">
                          <Check className="h-4 w-4" aria-hidden /> Yes
                        </span>
                      ) : (
                        <span className="text-red-700">
                          <span className="inline-flex items-center gap-1">
                            <X className="h-4 w-4" aria-hidden /> No
                          </span>
                          <span className="block text-xs">{l.quantity_check?.issues.join("; ")}</span>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              </>
            )}
            <tr>
              <td />
              {data.listings.map((l) => (
                <td key={l.id} className="px-5 py-4">
                  <ButtonLink to={`/app/market/listings/${l.id}`} size="sm" variant={l.id === data.best.lowest_price ? "primary" : "secondary"}>
                    Request from this supplier
                  </ButtonLink>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Card>
      <div className="mt-4">
        <Notice>{data.note}</Notice>
      </div>
    </>
  );
}
