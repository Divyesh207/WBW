import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Building2, Leaf, Send } from "lucide-react";
import { Badge, Button, ButtonLink, Card, CardHeader, Dl, ErrorState, Field, Notice, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { AvailabilityBadge, CategoryBadge, DemoTag, GradeBadge, kg, money } from "../../features/market/shared";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../hooks/useAuth";
import { ApiError } from "../../services/api";
import { marketApi } from "../../services/marketApi";

const SUPPLIER_TYPES: Record<string, string> = { recycler: "Recycler", waste_producer: "Waste producer", material_supplier: "Sustainable material supplier" };

export default function ListingDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => marketApi.listing(id!), [id]);
  const [form, setForm] = useState({ quantity: "", target: "", requiredBy: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (loading && !data) return <Spinner label="Loading listing…" />;
  if (error || !data) return <ErrorState message={error ?? "Listing not found."} onRetry={reload} />;

  const qty = Number(form.quantity) || 0;
  const assessmentId = params.get("assessment") ? Number(params.get("assessment")) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (qty < data.min_order_kg) return setFormError(`Enter at least the minimum order of ${data.min_order_kg} kg.`);
    if (qty > data.available_kg) return setFormError(`Only ${data.available_kg} kg is available.`);
    setBusy(true);
    setFormError(null);
    try {
      const created = await marketApi.sendRequest({
        listing_id: data.id,
        quantity_kg: qty,
        target_price_per_kg: form.target ? Number(form.target) : null,
        required_by: form.requiredBy || null,
        message: form.message,
        assessment_id: assessmentId,
      });
      toast.success(`Request #${created.id} sent to ${data.supplier_name}.`);
      navigate("/app/market/requests");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "The request could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  const s = data.supplier;
  return (
    <>
      <Link to="/app/market/browse" className="mb-4 inline-flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-green">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Browse materials
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={data.category} />
            <AvailabilityBadge value={data.availability} />
            <DemoTag show={data.supplier_is_demo} />
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-brand-dark">{data.title}</h1>
          <p className="mt-1 text-sm text-brand-muted">
            {data.form && `${data.form} · `}
            {data.supplier_name} · {data.location}
          </p>
        </div>
        <div className="text-right">
          <p className="tabular font-display text-3xl font-semibold text-brand-dark">
            {money(data.price_per_kg, data.currency)}
            <span className="ml-1 font-sans text-sm font-normal text-brand-muted">/ kg</span>
          </p>
          <p className="text-xs text-brand-muted">Listed price, set by the supplier</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Material details" />
            <div className="px-5 py-2">
              <Dl
                rows={[
                  ["Quality grade", <span key="g" className="inline-flex items-center gap-2"><GradeBadge grade={data.quality_grade} /> {data.quality_grade === "A" ? "Premium" : data.quality_grade === "B" ? "Standard industrial" : "Mixed / non-critical uses"}</span>],
                  ["Recycled content", `${data.recycled_content_pct}%`],
                  ["Available now", kg(data.available_kg)],
                  ["Minimum order", kg(data.min_order_kg)],
                  ["Lead time", `${data.lead_time_days} days`],
                  ["Dispatch location", data.location || "—"],
                ]}
              />
            </div>
            {data.description && <p className="border-t border-brand-line px-5 py-4 text-sm text-brand-ink">{data.description}</p>}
          </Card>

          {data.library && (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Leaf className="h-4 w-4 text-brand-green" aria-hidden />
                <h2 className="text-sm font-semibold text-brand-ink">Linked to the assessment library: {data.library.name}</h2>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-brand-muted">Carbon</dt>
                  <dd className="tabular font-semibold text-brand-ink">{data.library.emission_factor} kg CO₂e/kg</dd>
                </div>
                <div>
                  <dt className="text-xs text-brand-muted">Embodied energy</dt>
                  <dd className="tabular font-semibold text-brand-ink">{data.library.embodied_energy} MJ/kg</dd>
                </div>
                <div>
                  <dt className="text-xs text-brand-muted">Water</dt>
                  <dd className="tabular font-semibold text-brand-ink">{data.library.water} L/kg</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-brand-muted">Illustrative library factors used by the assessment engine, not figures verified by this supplier.</p>
            </Card>
          )}

          <Card>
            <CardHeader title="Supplier" action={<Building2 className="h-4 w-4 text-brand-muted" aria-hidden />} />
            <div className="p-5">
              <p className="flex items-center gap-2 text-base font-semibold text-brand-dark">
                {s.company_name} <DemoTag show={s.is_demo} />
              </p>
              <p className="text-xs text-brand-muted">
                {SUPPLIER_TYPES[s.supplier_type]} · {[s.city, s.state].filter(Boolean).join(", ")} · {s.active_listings} active listing{s.active_listings === 1 ? "" : "s"}
              </p>
              {s.description && <p className="mt-3 text-sm text-brand-ink">{s.description}</p>}
              {s.certifications.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.certifications.map((c) => (
                    <Badge key={c} tone="outline">
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
              <Link to={`/app/market/suppliers/${s.id}`} className="mt-4 inline-block text-sm font-medium text-brand-green hover:underline">
                View all listings from this supplier
              </Link>
            </div>
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader title="Request this material" hint="The supplier can accept, send a quote or decline." />
          <div className="p-5">
            {!user ? (
              <div className="text-sm text-brand-muted">
                <p>Sign in with a manufacturer account to send a request.</p>
                <ButtonLink to={`/signin?next=/app/market/listings/${data.id}`} className="mt-4 w-full">
                  Sign in to request
                </ButtonLink>
              </div>
            ) : user.role !== "manufacturer" ? (
              <Notice>Requests are sent by manufacturer accounts. You are signed in as a supplier.</Notice>
            ) : data.availability === "out_of_stock" ? (
              <Notice tone="warn">This listing is out of stock.</Notice>
            ) : (
              <form onSubmit={submit} className="space-y-4" noValidate>
                <Field label="Quantity (kg)" htmlFor="qty" required hint={`Between ${data.min_order_kg} and ${data.available_kg} kg.`}>
                  <input id="qty" type="number" min={data.min_order_kg} max={data.available_kg} step="any" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Target price (₹/kg)" htmlFor="target" hint="Optional">
                    <input id="target" type="number" min={0} step="any" className="input" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
                  </Field>
                  <Field label="Required by" htmlFor="required" hint="Optional">
                    <input id="required" type="date" min={new Date().toISOString().slice(0, 10)} className="input" value={form.requiredBy} onChange={(e) => setForm({ ...form, requiredBy: e.target.value })} />
                  </Field>
                </div>
                <Field label="Message to supplier" htmlFor="message">
                  <textarea id="message" rows={3} className="input" maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Intended use, specification, delivery needs…" />
                </Field>
                {qty > 0 && (
                  <p className="rounded-md bg-brand-paper px-3 py-2 text-sm text-brand-ink">
                    Estimated at listed price: <span className="tabular font-semibold">{money(qty * data.price_per_kg, data.currency)}</span>
                  </p>
                )}
                {assessmentId && <p className="text-xs text-brand-muted">This request will be linked to assessment #{assessmentId}.</p>}
                {formError && <Notice tone="warn">{formError}</Notice>}
                <Button type="submit" className="w-full" loading={busy}>
                  <Send className="h-4 w-4" aria-hidden /> Send request
                </Button>
              </form>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
