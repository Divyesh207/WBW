import { useState } from "react";
import { Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../../components/ui";
import { OrderProgress, RequireRole, kg, money } from "../../features/market/shared";
import { useAsync } from "../../hooks/useAsync";
import { marketApi } from "../../services/marketApi";
import type { Role } from "../../types/market";
import { cx, fmtDate } from "../../utils/format";

const FILTERS: [string, string][] = [["", "All orders"], ["open", "In progress"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]];

/** Order history and tracking for both roles. */
export default function Orders({ role }: { role: Role }) {
  return (
    <RequireRole role={role}>
      <OrdersInner role={role} />
    </RequireRole>
  );
}

function OrdersInner({ role }: { role: Role }) {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useAsync(() => marketApi.orders(status), [status]);
  const base = role === "supplier" ? "/app/supplier" : "/app/market";

  return (
    <>
      <PageHeader title={role === "supplier" ? "Customer orders" : "My orders"} description={role === "supplier" ? "Orders placed for your materials. Open an order to confirm, dispatch or update it." : "Order history and live status. Open an order to see its tracking timeline or order it again."} />
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter orders">
        {FILTERS.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={cx("rounded-md border px-3 py-1.5 text-xs font-medium", status === value ? "border-brand-dark bg-brand-dark text-white" : "border-brand-line bg-white text-brand-muted hover:text-brand-ink")}>
            {label}
          </button>
        ))}
      </div>
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data!.length === 0 ? (
        <EmptyState icon={<Truck className="h-8 w-8" />} title="No orders yet" description={role === "supplier" ? "Orders appear here when a manufacturer orders after you accept or quote a request." : "Orders appear here once you place one from an accepted or quoted request."} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-brand-line text-left text-xs uppercase tracking-wider text-brand-muted">
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">{role === "supplier" ? "Customer" : "Supplier"}</th>
                <th className="px-5 py-3 text-right font-medium">Quantity</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {data!.map((o) => (
                <tr key={o.id} className="transition-colors hover:bg-brand-paper">
                  <td className="px-5 py-3.5">
                    <Link to={`${base}/orders/${o.id}`} className="block min-w-[14rem] font-medium text-brand-ink hover:text-brand-green">
                      #{o.id} · {o.listing_title}
                    </Link>
                    <span className="block text-xs text-brand-muted">{fmtDate(o.created_at)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-brand-muted">{role === "supplier" ? `${o.manufacturer_name} · ${o.manufacturer_organisation}` : o.supplier_name}</td>
                  <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-brand-ink">{kg(o.quantity_kg)}</td>
                  <td className="tabular whitespace-nowrap px-5 py-3.5 text-right font-medium text-brand-ink">{money(o.total_amount, o.currency)}</td>
                  <td className="px-5 py-3.5">
                    <OrderProgress status={o.status} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
