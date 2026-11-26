import { Link } from "react-router-dom";
import { ArrowRight, Leaf, PackagePlus, Search } from "lucide-react";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, ErrorState, Notice, PageHeader, Skeleton, Stat } from "../../components/ui";
import { AvailabilityBadge, GradeBadge, OrderStatusBadge, RequestStatusBadge, RequireRole, kg, money } from "../../features/market/shared";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../hooks/useAuth";
import { marketApi } from "../../services/marketApi";
import type { ManufacturerDashboard, SupplierDashboard as SupplierData } from "../../types/market";
import { fmtDate } from "../../utils/format";

function Loading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}

/* ================================================================ manufacturer */
export function MarketDashboard() {
  return (
    <RequireRole role="manufacturer">
      <ManufacturerInner />
    </RequireRole>
  );
}

function ManufacturerInner() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => marketApi.dashboard<ManufacturerDashboard>());

  return (
    <>
      <PageHeader
        title="Supplier Marketplace"
        description={`Source recycled, waste-based and bio-based materials for ${user?.organisation || "your products"}. Requests, quotes and orders are all tracked here.`}
        actions={
          <ButtonLink to="/app/market/browse">
            <Search className="h-4 w-4" aria-hidden /> Browse materials
          </ButtonLink>
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Open requests" value={String(data.open_requests)} note={data.awaiting_your_action ? `${data.awaiting_your_action} waiting for your decision` : "No action needed"} />
            <Stat label="Orders in progress" value={String(data.open_orders)} note={`${data.orders_by_status.delivered ?? 0} delivered so far`} />
            <Stat label="Committed spend" value={money(data.committed_spend)} note="All orders except cancelled" />
            <Stat label="Material ordered" value={kg(data.material_ordered_kg)} note={`From ${data.suppliers_used} supplier${data.suppliers_used === 1 ? "" : "s"}`} />
          </div>

          {data.awaiting_your_action > 0 && (
            <Notice>
              {data.awaiting_your_action} request{data.awaiting_your_action === 1 ? " has" : "s have"} been accepted or quoted by suppliers.{" "}
              <Link to="/app/market/requests" className="font-medium text-brand-green underline">
                Review and place orders
              </Link>
            </Notice>
          )}

          <Card>
            <CardHeader title="Suppliers for materials your assessments recommend" hint="Linked to the environmental engine: each material below was suggested as a lower-impact alternative in a saved assessment." action={<Leaf className="h-4 w-4 text-brand-green" aria-hidden />} />
            {data.recommended_matches.length === 0 ? (
              <p className="p-5 text-sm text-brand-muted">No material alternatives recommended yet. Run an assessment to get suggestions.</p>
            ) : (
              <div className="divide-y divide-brand-line">
                {data.recommended_matches.map((m) => (
                  <div key={m.material_id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-brand-ink">
                        {m.name} <span className="font-normal text-brand-muted">· recommended in {m.assessments} assessment{m.assessments === 1 ? "" : "s"}</span>
                      </p>
                      <Link to={`/app/market/browse?material_id=${m.material_id}`} className="text-sm font-medium text-brand-green hover:underline">
                        All suppliers
                      </Link>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      {m.listings.map((l) => (
                        <Link key={l.id} to={`/app/market/listings/${l.id}`} className="rounded-md border border-brand-line p-3 transition-colors hover:border-brand-green">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-brand-ink">{l.title}</span>
                            <GradeBadge grade={l.quality_grade} />
                          </span>
                          <span className="mt-1 block text-xs text-brand-muted">{l.supplier_name}</span>
                          <span className="tabular mt-2 block text-sm font-semibold text-brand-dark">{money(l.price_per_kg, l.currency)}/kg</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent orders" action={<Link to="/app/market/orders" className="text-sm font-medium text-brand-green hover:underline">All orders</Link>} />
            {data.recent_orders.length === 0 ? (
              <p className="p-5 text-sm text-brand-muted">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-brand-line">
                {data.recent_orders.map((o) => (
                  <li key={o.id}>
                    <Link to={`/app/market/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-brand-paper">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-brand-ink">
                          #{o.id} · {o.listing_title}
                        </span>
                        <span className="text-xs text-brand-muted">
                          {o.supplier_name} · {fmtDate(o.created_at)}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="tabular text-sm text-brand-ink">{money(o.total_amount, o.currency)}</span>
                        <OrderStatusBadge status={o.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

/* ================================================================ supplier */
export function SupplierDashboard() {
  return (
    <RequireRole role="supplier">
      <SupplierInner />
    </RequireRole>
  );
}

function SupplierInner() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => marketApi.dashboard<SupplierData>());

  return (
    <>
      <PageHeader
        title={`Supplier dashboard · ${user?.organisation ?? ""}`}
        description="Your listings, incoming requests and customer orders in one place."
        actions={
          <ButtonLink to="/app/supplier/listings?new=1">
            <PackagePlus className="h-4 w-4" aria-hidden /> New listing
          </ButtonLink>
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Active listings" value={String(data.active_listings)} note={data.low_stock.length ? `${data.low_stock.length} low on stock` : "Stock levels healthy"} />
            <Stat label="New requests" value={String(data.pending_requests)} note="Waiting for your response" />
            <Stat label="Orders in progress" value={String(data.open_orders)} note={`${money(data.pipeline_value)} in progress`} />
            <Stat label="Delivered revenue" value={money(data.delivered_revenue)} note={`${kg(data.material_supplied_kg)} of material supplied`} />
          </div>

          {data.active_listings === 0 && (
            <EmptyState icon={<PackagePlus className="h-8 w-8" />} title="List your first material" description="Manufacturers can only find you once you list a recycled, waste-based or bio-based material." action={<ButtonLink to="/app/supplier/listings?new=1">Create a listing</ButtonLink>} />
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Latest requests" action={<Link to="/app/supplier/requests" className="text-sm font-medium text-brand-green hover:underline">All requests</Link>} />
              {data.recent_requests.length === 0 ? (
                <p className="p-5 text-sm text-brand-muted">No requests yet.</p>
              ) : (
                <ul className="divide-y divide-brand-line">
                  {data.recent_requests.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-brand-ink">{r.listing_title}</span>
                        <span className="text-xs text-brand-muted">
                          {r.manufacturer_organisation} · {kg(r.quantity_kg)}
                        </span>
                      </span>
                      <RequestStatusBadge status={r.status} role="supplier" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Recent orders" action={<Link to="/app/supplier/orders" className="text-sm font-medium text-brand-green hover:underline">All orders</Link>} />
              {data.recent_orders.length === 0 ? (
                <p className="p-5 text-sm text-brand-muted">No orders yet.</p>
              ) : (
                <ul className="divide-y divide-brand-line">
                  {data.recent_orders.map((o) => (
                    <li key={o.id}>
                      <Link to={`/app/supplier/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 hover:bg-brand-paper">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-brand-ink">
                            #{o.id} · {o.listing_title}
                          </span>
                          <span className="text-xs text-brand-muted">
                            {o.manufacturer_organisation} · {money(o.total_amount, o.currency)}
                          </span>
                        </span>
                        <OrderStatusBadge status={o.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {data.low_stock.length > 0 && (
            <Card>
              <CardHeader title="Low stock" hint="Listings with less than five minimum orders left. Update stock so manufacturers can keep ordering." />
              <ul className="divide-y divide-brand-line">
                {data.low_stock.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <span className="text-sm text-brand-ink">{l.title}</span>
                    <span className="flex items-center gap-3">
                      <span className="tabular text-sm text-brand-muted">{kg(l.available_kg)} left</span>
                      <AvailabilityBadge value={l.availability} />
                      <Link to={`/app/supplier/listings?edit=${l.id}`} className="text-sm font-medium text-brand-green hover:underline">
                        Update
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <p className="flex items-center gap-1.5 text-xs text-brand-muted">
            <ArrowRight className="h-3.5 w-3.5" aria-hidden /> Manufacturers see your listings on the marketplace and in suggestions linked to their environmental assessments.
            <Badge tone="outline">Prices and stock are set by you</Badge>
          </p>
        </div>
      )}
    </>
  );
}
