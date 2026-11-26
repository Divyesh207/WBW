import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Inbox, Repeat } from "lucide-react";
import { Button, ButtonLink, Card, EmptyState, ErrorState, Field, Notice, PageHeader, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { RequestStatusBadge, RequireRole, dateTime, kg, money } from "../../features/market/shared";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../hooks/useAuth";
import { ApiError } from "../../services/api";
import { marketApi } from "../../services/marketApi";
import type { MaterialRequest, Role } from "../../types/market";
import { cx } from "../../utils/format";

const FILTERS: Record<Role, [string, string][]> = {
  manufacturer: [["", "All"], ["pending", "Awaiting supplier"], ["quoted", "Quotes"], ["accepted", "Accepted"], ["ordered", "Ordered"], ["rejected", "Rejected"], ["cancelled", "Cancelled"]],
  supplier: [["", "All"], ["pending", "New"], ["quoted", "Quote sent"], ["accepted", "Accepted"], ["ordered", "Ordered"], ["rejected", "Declined"], ["cancelled", "Cancelled"]],
};

/** Manufacturer: "My requests". Supplier: "Incoming requests". */
export default function Requests({ role }: { role: Role }) {
  return (
    <RequireRole role={role}>
      <RequestsInner role={role} />
    </RequireRole>
  );
}

function RequestsInner({ role }: { role: Role }) {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useAsync(() => marketApi.requests(status), [status]);
  const supplier = role === "supplier";

  return (
    <>
      <PageHeader
        title={supplier ? "Incoming requests" : "My material requests"}
        description={supplier ? "Requests from manufacturers for your listings. Accept at your listed price, send a quote, or decline with a reason." : "Requests you have sent to suppliers. Place an order once a request is accepted or quoted, or send a previous request again."}
        actions={!supplier && <ButtonLink to="/app/market/browse">Find materials</ButtonLink>}
      />
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
        {FILTERS[role].map(([value, label]) => (
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
        <EmptyState icon={<Inbox className="h-8 w-8" />} title="No requests here" description={supplier ? "When a manufacturer requests one of your materials, it appears here." : "Browse materials and send a request to a supplier."} />
      ) : (
        <div className="space-y-3">
          {data!.map((r) => (
            <RequestCard key={r.id} request={r} role={role} onChanged={reload} />
          ))}
        </div>
      )}
    </>
  );
}

function RequestCard({ request: r, role, onChanged }: { request: MaterialRequest; role: Role; onChanged: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [panel, setPanel] = useState<"" | "respond" | "order" | "repeat">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [respond, setRespond] = useState({ action: "accept" as "accept" | "quote" | "reject", price: "", message: "" });
  const [address, setAddress] = useState("");
  const [repeatQty, setRepeatQty] = useState(String(r.quantity_kg));
  const supplier = role === "supplier";

  const act = async (fn: () => Promise<unknown>, message: string, after?: () => void) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      toast.success(message);
      setPanel("");
      after ? after() : onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const canRespond = supplier && (r.status === "pending" || r.status === "quoted");
  const canOrder = !supplier && (r.status === "accepted" || r.status === "quoted");
  const canCancel = !supplier && ["pending", "quoted", "accepted"].includes(r.status);
  const canRepeat = !supplier && ["ordered", "rejected", "cancelled"].includes(r.status);

  return (
    <Card className={cx("p-5", (canRespond && r.status === "pending") || canOrder ? "border-brand-green" : "")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-brand-muted">#{r.id}</span>
            <RequestStatusBadge status={r.status} role={role} />
            {(r.repeat_of_order_id || r.repeat_of_request_id) && (
              <span className="flex items-center gap-1 text-xs text-brand-muted">
                <Repeat className="h-3 w-3" aria-hidden /> Repeat of {r.repeat_of_order_id ? `order #${r.repeat_of_order_id}` : `request #${r.repeat_of_request_id}`}
              </span>
            )}
          </div>
          <Link to={`/app/market/listings/${r.listing_id}`} className="mt-1.5 block text-base font-semibold text-brand-dark hover:text-brand-green">
            {r.listing_title}
          </Link>
          <p className="text-xs text-brand-muted">
            {supplier ? `${r.manufacturer_name} · ${r.manufacturer_organisation}` : r.supplier_name} · sent {dateTime(r.created_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="tabular text-lg font-semibold text-brand-dark">{kg(r.quantity_kg)}</p>
          <p className="tabular text-xs text-brand-muted">
            {r.quoted_price_per_kg !== null ? (
              <>
                quoted {money(r.quoted_price_per_kg, r.currency)}/kg <span className="line-through">{money(r.listing_price_per_kg, r.currency)}</span>
              </>
            ) : (
              <>listed {money(r.listing_price_per_kg, r.currency)}/kg</>
            )}
          </p>
          <p className="tabular text-sm font-medium text-brand-ink">≈ {money(r.estimated_total, r.currency)}</p>
        </div>
      </div>

      {(r.message || r.target_price_per_kg || r.required_by) && (
        <div className="mt-3 rounded-md bg-brand-paper px-3 py-2 text-sm text-brand-ink">
          {r.message && <p>“{r.message}”</p>}
          <p className="mt-1 text-xs text-brand-muted">
            {r.target_price_per_kg ? `Target price ${money(r.target_price_per_kg, r.currency)}/kg` : ""}
            {r.target_price_per_kg && r.required_by ? " · " : ""}
            {r.required_by ? `Required by ${r.required_by}` : ""}
          </p>
        </div>
      )}
      {r.supplier_response && (
        <p className="mt-2 text-sm text-brand-ink">
          <span className="font-medium">{supplier ? "Your reply" : "Supplier reply"}:</span> {r.supplier_response}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {canRespond && <Button size="sm" onClick={() => setPanel(panel === "respond" ? "" : "respond")}>{r.status === "quoted" ? "Update response" : "Respond"}</Button>}
        {canOrder && <Button size="sm" onClick={() => setPanel(panel === "order" ? "" : "order")}>{r.status === "quoted" ? "Accept quote and place order" : "Place order"}</Button>}
        {canCancel && (
          <Button size="sm" variant="ghost" loading={busy && panel === ""} onClick={() => act(() => marketApi.cancelRequest(r.id), `Request #${r.id} cancelled.`)}>
            {r.status === "quoted" ? "Decline quote" : "Cancel request"}
          </Button>
        )}
        {canRepeat && (
          <Button size="sm" variant="secondary" onClick={() => setPanel(panel === "repeat" ? "" : "repeat")}>
            <Repeat className="h-4 w-4" aria-hidden /> Request again
          </Button>
        )}
        {r.order_id && (
          <ButtonLink size="sm" variant="secondary" to={`${supplier ? "/app/supplier" : "/app/market"}/orders/${r.order_id}`}>
            Track order #{r.order_id}
          </ButtonLink>
        )}
      </div>

      {panel === "respond" && (
        <div className="mt-4 space-y-3 border-t border-brand-line pt-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Response">
            {([["accept", "Accept at listed price"], ["quote", "Send a quote"], ["reject", "Decline"]] as const).map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={respond.action === v} onClick={() => setRespond({ ...respond, action: v })} className={cx("rounded-md border px-3 py-1.5 text-sm", respond.action === v ? "border-brand-green bg-emerald-50 font-medium text-brand-dark" : "border-brand-line text-brand-muted")}>
                {label}
              </button>
            ))}
          </div>
          {respond.action === "quote" && (
            <Field label="Quoted price (₹ per kg)" htmlFor={`price-${r.id}`} required>
              <input id={`price-${r.id}`} type="number" min={0} step="any" className="input max-w-xs" value={respond.price} onChange={(e) => setRespond({ ...respond, price: e.target.value })} />
            </Field>
          )}
          <Field label={respond.action === "reject" ? "Reason for declining" : "Message to manufacturer"} htmlFor={`msg-${r.id}`} required={respond.action === "reject"}>
            <textarea id={`msg-${r.id}`} rows={2} className="input" value={respond.message} onChange={(e) => setRespond({ ...respond, message: e.target.value })} />
          </Field>
          {err && <Notice tone="warn">{err}</Notice>}
          <Button
            size="sm"
            variant={respond.action === "reject" ? "danger" : "primary"}
            loading={busy}
            onClick={() =>
              act(
                () => marketApi.respond(r.id, { action: respond.action, message: respond.message, quoted_price_per_kg: respond.action === "quote" ? Number(respond.price) || null : null }),
                respond.action === "accept" ? `Request #${r.id} accepted.` : respond.action === "quote" ? `Quote sent for request #${r.id}.` : `Request #${r.id} declined.`,
              )
            }
          >
            Send response
          </Button>
        </div>
      )}

      {panel === "order" && (
        <div className="mt-4 space-y-3 border-t border-brand-line pt-4">
          <p className="text-sm text-brand-ink">
            Order {kg(r.quantity_kg)} at {money(r.agreed_price_per_kg, r.currency)}/kg — total <span className="tabular font-semibold">{money(r.estimated_total, r.currency)}</span>.
          </p>
          <Field label="Delivery address" htmlFor={`addr-${r.id}`} required>
            <textarea id={`addr-${r.id}`} rows={2} className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={user?.organisation ? `${user.organisation}, plant address…` : "Plant address"} />
          </Field>
          {err && <Notice tone="warn">{err}</Notice>}
          <Button size="sm" loading={busy} onClick={() => act(() => marketApi.placeOrder(r.id, address).then((o) => navigate(`/app/market/orders/${o.id}`)), `Order placed with ${r.supplier_name}.`, () => undefined)}>
            Confirm order
          </Button>
        </div>
      )}

      {panel === "repeat" && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-brand-line pt-4">
          <Field label="Quantity for the new request (kg)" htmlFor={`rq-${r.id}`}>
            <input id={`rq-${r.id}`} type="number" min={0} step="any" className="input w-48" value={repeatQty} onChange={(e) => setRepeatQty(e.target.value)} />
          </Field>
          <Button size="sm" loading={busy} onClick={() => act(() => marketApi.repeatRequest(r.id, Number(repeatQty) || null), "Repeat request sent.")}>
            Send repeat request
          </Button>
          {err && <div className="w-full"><Notice tone="warn">{err}</Notice></div>}
        </div>
      )}
    </Card>
  );
}
