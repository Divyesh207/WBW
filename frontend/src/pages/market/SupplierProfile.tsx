import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Globe, Mail, MapPin, Phone } from "lucide-react";
import { Badge, Button, Card, CardHeader, ErrorState, Field, Notice, PageHeader, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { AvailabilityBadge, DemoTag, GradeBadge, RequireRole, money } from "../../features/market/shared";
import { useAsync } from "../../hooks/useAsync";
import { ApiError } from "../../services/api";
import { marketApi } from "../../services/marketApi";
import type { SupplierProfile } from "../../types/market";

const TYPES: Record<string, string> = { recycler: "Recycler", waste_producer: "Waste producer (industrial by-products)", material_supplier: "Sustainable material supplier" };

/* ------------------------------------------------ supplier edits own profile */
export default function SupplierProfileEdit() {
  return (
    <RequireRole role="supplier">
      <EditInner />
    </RequireRole>
  );
}

function EditInner() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(marketApi.myProfile);
  const [form, setForm] = useState<SupplierProfile | null>(null);
  const [certs, setCerts] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setForm(data);
      setCerts(data.certifications.join(", "));
    }
  }, [data]);

  if (loading && !form) return <Spinner />;
  if (error || !form) return <ErrorState message={error ?? "Profile not found."} onRetry={reload} />;

  const set = (key: keyof SupplierProfile) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (form.company_name.trim().length < 2) return setErr("Company name must be at least 2 characters.");
    setBusy(true);
    setErr(null);
    try {
      const saved = await marketApi.updateProfile({
        company_name: form.company_name.trim(), description: form.description, city: form.city, state: form.state, contact_email: form.contact_email,
        phone: form.phone, website: form.website, supplier_type: form.supplier_type, certifications: certs.split(",").map((c) => c.trim()).filter(Boolean),
      });
      setForm(saved);
      toast.success("Company profile saved.");
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Saving failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Company profile" description="Shown to manufacturers on your listings and supplier page." actions={<Link to={`/app/market/suppliers/${form.id}`} className="text-sm font-medium text-brand-green hover:underline">View public page</Link>} />
      <Card>
        <form onSubmit={save} className="grid gap-4 p-5 sm:grid-cols-2" noValidate>
          <Field label="Company name" htmlFor="company" required>
            <input id="company" className="input" value={form.company_name} onChange={set("company_name")} />
          </Field>
          <Field label="Supplier type" htmlFor="type">
            <select id="type" className="input" value={form.supplier_type} onChange={set("supplier_type")}>
              {Object.entries(TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="About the company" htmlFor="about" className="sm:col-span-2" hint="What you make, which waste streams you process, typical customers.">
            <textarea id="about" rows={4} className="input" maxLength={2000} value={form.description} onChange={set("description")} />
          </Field>
          <Field label="City" htmlFor="city">
            <input id="city" className="input" value={form.city} onChange={set("city")} />
          </Field>
          <Field label="State" htmlFor="state">
            <input id="state" className="input" value={form.state} onChange={set("state")} />
          </Field>
          <Field label="Contact email" htmlFor="cemail">
            <input id="cemail" type="email" className="input" value={form.contact_email} onChange={set("contact_email")} />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <input id="phone" className="input" value={form.phone} onChange={set("phone")} />
          </Field>
          <Field label="Website" htmlFor="web">
            <input id="web" className="input" value={form.website} onChange={set("website")} />
          </Field>
          <Field label="Certifications" htmlFor="certs" hint="Separate with commas, e.g. ISO 14001, FSC Recycled.">
            <input id="certs" className="input" value={certs} onChange={(e) => setCerts(e.target.value)} />
          </Field>
          {err && (
            <div className="sm:col-span-2">
              <Notice tone="warn">{err}</Notice>
            </div>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy}>
              Save profile
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

/* ------------------------------------------------ public supplier page */
export function SupplierPublic() {
  const { id } = useParams();
  const { data, error, loading, reload } = useAsync(() => marketApi.supplier(id!), [id]);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorState message={error ?? "Supplier not found."} onRetry={reload} />;
  return (
    <>
      <Link to="/app/market/browse" className="mb-4 inline-flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-green">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Browse materials
      </Link>
      <PageHeader title={data.company_name} description={TYPES[data.supplier_type]} actions={<DemoTag show={data.is_demo} />} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="self-start p-5 text-sm">
          {data.description && <p className="text-brand-ink">{data.description}</p>}
          <ul className="mt-4 space-y-2 text-brand-muted">
            {(data.city || data.state) && <li className="flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden />{[data.city, data.state].filter(Boolean).join(", ")}</li>}
            {data.contact_email && <li className="flex items-center gap-2"><Mail className="h-4 w-4" aria-hidden />{data.contact_email}</li>}
            {data.phone && <li className="flex items-center gap-2"><Phone className="h-4 w-4" aria-hidden />{data.phone}</li>}
            {data.website && <li className="flex items-center gap-2"><Globe className="h-4 w-4" aria-hidden />{data.website}</li>}
          </ul>
          {data.certifications.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {data.certifications.map((c) => (
                <Badge key={c} tone="outline">
                  {c}
                </Badge>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-brand-muted">{data.completed_orders} completed order{data.completed_orders === 1 ? "" : "s"} on the platform</p>
        </Card>
        <Card>
          <CardHeader title={`Active listings (${data.listings?.length ?? 0})`} />
          <ul className="divide-y divide-brand-line">
            {data.listings?.map((l) => (
              <li key={l.id}>
                <Link to={`/app/market/listings/${l.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-brand-paper">
                  <span className="flex items-center gap-3">
                    <GradeBadge grade={l.quality_grade} />
                    <span>
                      <span className="block text-sm font-medium text-brand-ink">{l.title}</span>
                      <span className="text-xs text-brand-muted">{l.form}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular text-sm font-semibold text-brand-dark">{money(l.price_per_kg, l.currency)}/kg</span>
                    <AvailabilityBadge value={l.availability} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
