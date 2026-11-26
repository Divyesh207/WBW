import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, PackagePlus, Pencil, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Notice, PageHeader, Spinner } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { AvailabilityBadge, CATEGORY_LABELS, GradeBadge, RequireRole, kg, money } from "../../features/market/shared";
import { useAsync } from "../../hooks/useAsync";
import { ApiError } from "../../services/api";
import { marketApi } from "../../services/marketApi";
import type { Listing, ListingInput } from "../../types/market";

type FormState = Record<Exclude<keyof ListingInput, "is_active">, string> & { is_active: boolean };

const EMPTY: FormState = {
  title: "", material_id: "", category: "recycled", form: "", description: "", price_per_kg: "", quality_grade: "B",
  recycled_content_pct: "100", available_kg: "", min_order_kg: "", lead_time_days: "7", location: "", is_active: true,
};

const toForm = (l: Listing): FormState => ({
  title: l.title, material_id: l.material_id ?? "", category: l.category, form: l.form, description: l.description,
  price_per_kg: String(l.price_per_kg), quality_grade: l.quality_grade, recycled_content_pct: String(l.recycled_content_pct),
  available_kg: String(l.available_kg), min_order_kg: String(l.min_order_kg), lead_time_days: String(l.lead_time_days), location: l.location, is_active: l.is_active,
});

function validate(f: FormState): string | null {
  if (f.title.trim().length < 3) return "Give the listing a title of at least 3 characters.";
  if (!(Number(f.price_per_kg) > 0)) return "Enter a price per kg above 0.";
  if (!(Number(f.min_order_kg) > 0)) return "Enter a minimum order above 0 kg.";
  if (f.available_kg === "" || Number(f.available_kg) < 0) return "Enter the quantity available (0 or more).";
  const pct = Number(f.recycled_content_pct);
  if (Number.isNaN(pct) || pct < 0 || pct > 100) return "Recycled content must be between 0 and 100%.";
  if (Number(f.lead_time_days) < 0 || !Number.isInteger(Number(f.lead_time_days))) return "Lead time must be a whole number of days.";
  return null;
}

export default function SupplierListings() {
  return (
    <RequireRole role="supplier">
      <ListingsInner />
    </RequireRole>
  );
}

function ListingsInner() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const meta = useAsync(marketApi.meta);
  const { data, error, loading, reload } = useAsync(marketApi.myListings);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (params.get("new")) open("new");
    const edit = Number(params.get("edit"));
    if (edit && data) {
      const item = data.find((l) => l.id === edit);
      if (item) open(item.id, item);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function open(target: number | "new", item?: Listing) {
    setEditing(target);
    setForm(item ? toForm(item) : EMPTY);
    setErr(null);
    setParams({}, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const set = (key: keyof FormState) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validate(form);
    if (problem) return setErr(problem);
    const body: ListingInput = {
      title: form.title.trim(), material_id: form.material_id || null, category: form.category as ListingInput["category"], form: form.form, description: form.description,
      price_per_kg: Number(form.price_per_kg), quality_grade: form.quality_grade as ListingInput["quality_grade"], recycled_content_pct: Number(form.recycled_content_pct),
      available_kg: Number(form.available_kg), min_order_kg: Number(form.min_order_kg), lead_time_days: Number(form.lead_time_days), location: form.location, is_active: form.is_active,
    };
    setBusy(true);
    setErr(null);
    try {
      if (editing === "new") await marketApi.createListing(body);
      else if (editing) await marketApi.updateListing(editing, body);
      toast.success(editing === "new" ? "Listing published." : "Listing updated.");
      setEditing(null);
      reload();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Saving failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: Listing) => {
    if (!window.confirm(`Remove “${item.title}”? Listings with past requests are archived instead of deleted.`)) return;
    try {
      const { result } = await marketApi.deleteListing(item.id);
      toast.success(result === "archived" ? "Listing archived (it has request history)." : "Listing deleted.");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Remove failed.");
    }
  };

  return (
    <>
      <PageHeader
        title="My listings"
        description="Materials you offer to manufacturers. Price, grade and stock are shown exactly as you set them."
        actions={
          editing === null && (
            <Button onClick={() => open("new")}>
              <PackagePlus className="h-4 w-4" aria-hidden /> New listing
            </Button>
          )
        }
      />

      {editing !== null && (
        <Card className="mb-6">
          <CardHeader title={editing === "new" ? "New listing" : "Edit listing"} />
          <form onSubmit={save} className="grid gap-4 p-5 sm:grid-cols-2" noValidate>
            <Field label="Title" htmlFor="title" required className="sm:col-span-2">
              <input id="title" className="input" value={form.title} onChange={set("title")} placeholder="e.g. rPET clear flakes, hot-washed" />
            </Field>
            <Field label="Category" htmlFor="category" required>
              <select id="category" className="input" value={form.category} onChange={set("category")}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Matches library material" htmlFor="material_id" hint="Links the listing to assessment recommendations. Optional.">
              <select id="material_id" className="input" value={form.material_id} onChange={set("material_id")}>
                <option value="">None</option>
                {meta.data?.materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Form" htmlFor="form">
              <input id="form" className="input" value={form.form} onChange={set("form")} placeholder="Flakes, pellets, sheets, bales…" />
            </Field>
            <Field label="Quality grade" htmlFor="grade" required>
              <select id="grade" className="input" value={form.quality_grade} onChange={set("quality_grade")}>
                <option value="A">A — premium / food-contact capable</option>
                <option value="B">B — standard industrial</option>
                <option value="C">C — mixed / non-critical uses</option>
              </select>
            </Field>
            <Field label="Price (₹ per kg)" htmlFor="price" required>
              <input id="price" type="number" min={0} step="any" className="input" value={form.price_per_kg} onChange={set("price_per_kg")} />
            </Field>
            <Field label="Recycled content (%)" htmlFor="recycled" required>
              <input id="recycled" type="number" min={0} max={100} className="input" value={form.recycled_content_pct} onChange={set("recycled_content_pct")} />
            </Field>
            <Field label="Available now (kg)" htmlFor="available" required>
              <input id="available" type="number" min={0} step="any" className="input" value={form.available_kg} onChange={set("available_kg")} />
            </Field>
            <Field label="Minimum order (kg)" htmlFor="min" required>
              <input id="min" type="number" min={0} step="any" className="input" value={form.min_order_kg} onChange={set("min_order_kg")} />
            </Field>
            <Field label="Lead time (days)" htmlFor="lead" required>
              <input id="lead" type="number" min={0} className="input" value={form.lead_time_days} onChange={set("lead_time_days")} />
            </Field>
            <Field label="Dispatch location" htmlFor="location" hint="Defaults to your company city.">
              <input id="location" className="input" value={form.location} onChange={set("location")} />
            </Field>
            <Field label="Description" htmlFor="desc" className="sm:col-span-2">
              <textarea id="desc" rows={3} className="input" maxLength={2000} value={form.description} onChange={set("description")} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-brand-ink sm:col-span-2">
              <input type="checkbox" className="h-4 w-4 accent-brand-green" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              Visible to manufacturers
            </label>
            {err && (
              <div className="sm:col-span-2">
                <Notice tone="warn">{err}</Notice>
              </div>
            )}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" loading={busy}>
                {editing === "new" ? "Publish listing" : "Save changes"}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data!.length === 0 ? (
        <EmptyState icon={<PackagePlus className="h-8 w-8" />} title="No listings yet" description="Create a listing for each material you can supply." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[50rem] text-sm">
            <thead>
              <tr className="border-b border-brand-line text-left text-xs uppercase tracking-wider text-brand-muted">
                <th className="px-5 py-3 font-medium">Listing</th>
                <th className="px-5 py-3 font-medium">Grade</th>
                <th className="px-5 py-3 text-right font-medium">Price</th>
                <th className="px-5 py-3 text-right font-medium">Stock</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {data!.map((l) => (
                <tr key={l.id} className={l.is_active ? "" : "opacity-60"}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-brand-ink">{l.title}</p>
                    <p className="text-xs text-brand-muted">
                      {CATEGORY_LABELS[l.category]}
                      {l.library ? ` · linked to ${l.library.name}` : ""}
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <GradeBadge grade={l.quality_grade} />
                  </td>
                  <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-brand-ink">{money(l.price_per_kg, l.currency)}/kg</td>
                  <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-brand-ink">
                    {kg(l.available_kg)}
                    <span className="block text-xs text-brand-muted">min {kg(l.min_order_kg)}</span>
                  </td>
                  <td className="px-5 py-3.5">{l.is_active ? <AvailabilityBadge value={l.availability} /> : <Badge tone="outline"><Archive className="h-3 w-3" aria-hidden /> Hidden</Badge>}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    <button type="button" className="rounded p-1.5 text-brand-muted hover:bg-brand-paper hover:text-brand-green" onClick={() => open(l.id, l)} aria-label={`Edit ${l.title}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded p-1.5 text-brand-muted hover:bg-red-50 hover:text-red-600" onClick={() => remove(l)} aria-label={`Remove ${l.title}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
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
