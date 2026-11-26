import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Repeat } from "lucide-react";
import { Button, Card, CardHeader, Dl, ErrorState, Field, Notice, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { ORDER_ACTION_LABELS, OrderProgress, OrderTimeline, RequireRole, dateTime, kg, money } from "../../features/market/shared";
import { useAsync } from "../../hooks/useAsync";
import { ApiError } from "../../services/api";
import { marketApi } from "../../services/marketApi";
import type { OrderStatus, Role } from "../../types/market";

export default function OrderDetail({ role }: { role: Role }) {
  return (
    <RequireRole role={role}>
      <OrderDetailInner role={role} />
    </RequireRole>
  );
}

function OrderDetailInner({ role }: { role: Role }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useAsync(() => marketApi.order(id!), [id]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<OrderStatus | "repeat" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [repeatQty, setRepeatQty] = useState("");
  const base = role === "supplier" ? "/app/supplier" : "/app/market";

  if (loading && !data) return <Spinner label="Loading order…" />;
  if (error || !data) return <ErrorState message={error ?? "Order not found."} onRetry={reload} />;

  const update = async (status: OrderStatus) => {
    setBusy(status);
    setErr(null);
    try {
      const next = await marketApi.updateOrder(data.id, status, note);
      setData(next);
      setNote("");
      toast.success(`Order #${data.id} is now ${status}.`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  };

  const repeat = async () => {
    setBusy("repeat");
    setErr(null);
    try {
      const req = await marketApi.repeatOrder(data.id, Number(repeatQty) || null);
      toast.success(`Repeat request #${req.id} sent to ${data.supplier_name}.`);
      navigate("/app/market/requests");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Repeat order failed.");
    } finally {
      setBusy(null);
    }
  };

  const actions = data.actions ?? [];
  return (
    <>
      <Link to={`${base}/orders`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-green">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Orders
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-brand-muted">Order #{data.id} · from request #{data.request_id}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-dark">{data.listing_title}</h1>
          <p className="mt-1 text-sm text-brand-muted">{role === "supplier" ? `${data.manufacturer_name} · ${data.manufacturer_organisation}` : data.supplier_name}</p>
        </div>
        <OrderProgress status={data.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Order summary" />
            <div className="px-5 py-2">
              <Dl
                rows={[
                  ["Quantity", kg(data.quantity_kg)],
                  ["Agreed price", `${money(data.price_per_kg, data.currency)} / kg`],
                  ["Total", <span key="t" className="tabular font-semibold">{money(data.total_amount, data.currency)}</span>],
                  ["Delivery address", data.delivery_address],
                  ["Placed", dateTime(data.created_at)],
                  ["Last update", dateTime(data.updated_at)],
                ]}
              />
            </div>
          </Card>

          {actions.length > 0 && (
            <Card>
              <CardHeader title="Update this order" hint={role === "supplier" ? "Move the order forward as you process it." : "You can cancel before the supplier confirms, and confirm receipt after dispatch."} />
              <div className="space-y-3 p-5">
                <Field label="Note (optional)" htmlFor="note" hint="Shown in the tracking timeline, e.g. vehicle or invoice number.">
                  <input id="note" className="input" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
                </Field>
                {err && <Notice tone="warn">{err}</Notice>}
                <div className="flex flex-wrap gap-2">
                  {actions.map((a) => (
                    <Button key={a} variant={a === "cancelled" ? "danger" : "primary"} loading={busy === a} onClick={() => update(a)}>
                      {ORDER_ACTION_LABELS[a]}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {role === "manufacturer" && (
            <Card>
              <CardHeader title="Order again" hint="Sends a new request to the same supplier for the same material." />
              <div className="flex flex-wrap items-end gap-3 p-5">
                <Field label="Quantity (kg)" htmlFor="repeat-qty" hint={`Leave blank to reuse ${kg(data.quantity_kg)}.`}>
                  <input id="repeat-qty" type="number" min={0} step="any" className="input w-40" value={repeatQty} onChange={(e) => setRepeatQty(e.target.value)} />
                </Field>
                <Button variant="secondary" loading={busy === "repeat"} onClick={repeat}>
                  <Repeat className="h-4 w-4" aria-hidden /> Repeat order
                </Button>
                {err && actions.length === 0 && <div className="w-full"><Notice tone="warn">{err}</Notice></div>}
              </div>
            </Card>
          )}
        </div>

        <Card className="self-start">
          <CardHeader title="Tracking history" hint="Every status change, who made it and when." />
          <div className="p-5">
            <OrderTimeline events={data.events ?? []} />
          </div>
        </Card>
      </div>
    </>
  );
}
