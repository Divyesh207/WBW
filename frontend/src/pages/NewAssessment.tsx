import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button, Card, Dl, Field, Notice, PageHeader } from "../components/ui";
import { useToast } from "../components/Toast";
import { EMPTY_FORM, fromSpec, materialTotal, newRow, toSpec, validateStep, type Errors, type FormState } from "../features/assessment/form";
import { useAsync } from "../hooks/useAsync";
import { useReference } from "../hooks/useReference";
import { ApiError, api } from "../services/api";
import { cx, fmt } from "../utils/format";

const STEPS = ["Product", "Materials", "Manufacturing", "Packaging & end-of-life", "Review"];

export default function NewAssessment() {
  const ref = useReference();
  const navigate = useNavigate();
  const toast = useToast();
  const demos = useAsync(api.demoScenarios);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!(key in e)) return e;
      const { [key as string]: _, ...rest } = e;
      return rest;
    });
  };

  const total = materialTotal(form);
  const weight = Number(form.product_weight_kg) || 0;
  const method = ref.manufacturing_methods.find((m) => m.id === form.method);
  const benchmarkEnergy = method && weight ? method.typical_energy * weight : null;

  const next = () => {
    const found = validateStep(step, form);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Please fix the highlighted fields before continuing.");
      return;
    }
    setStep((s) => s + 1);
  };

  const loadDemo = (key: string) => {
    const scenario = demos.data?.find((d) => d.key === key);
    if (!scenario) return;
    setForm(fromSpec(scenario.spec));
    setErrors({});
    setServerError(null);
    toast.success(`Loaded demo: ${scenario.spec.name}. Review each step or jump to the end.`);
  };

  const submit = async () => {
    for (let s = 0; s < 4; s++) {
      const found = validateStep(s, form);
      if (Object.keys(found).length) {
        setErrors(found);
        setStep(s);
        toast.error("Some details are missing. Please complete this step.");
        return;
      }
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const created = await api.createAssessment(toSpec(form));
      toast.success("Assessment complete. Results are estimates based on illustrative factors.");
      navigate(`/app/assessments/${created.id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "The assessment could not be completed.";
      setServerError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const input = (key: keyof FormState, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={key}
      className={cx("input", errors[key] && "input-error")}
      value={form[key] as string}
      onChange={(e) => set(key, e.target.value as never)}
      aria-invalid={!!errors[key]}
      {...props}
    />
  );
  const number = (key: keyof FormState, step = "any") => input(key, { type: "number", inputMode: "decimal", min: 0, step });
  const select = (key: keyof FormState, options: [string, string][], placeholder = "Select…") => (
    <select id={key} className={cx("input", errors[key] && "input-error")} value={form[key] as string} onChange={(e) => set(key, e.target.value as never)} aria-invalid={!!errors[key]}>
      <option value="">{placeholder}</option>
      {options.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );

  const review = useMemo(() => (step === 4 ? toSpec(form) : null), [step, form]);

  return (
    <>
      <PageHeader
        title="New assessment"
        description="Describe the product as you plan to make it. The screening runs locally with illustrative factors and takes a moment."
        actions={
          <label className="flex items-center gap-2 text-sm text-brand-muted">
            <Sparkles className="h-4 w-4 text-brand-green" aria-hidden />
            <span className="sr-only">Load a demo scenario</span>
            <select className="input h-10 w-64" value="" onChange={(e) => loadDemo(e.target.value)} disabled={!demos.data}>
              <option value="">{demos.loading ? "Loading demos…" : "Load a demo scenario…"}</option>
              {demos.data?.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.spec.name}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {/* Stepper */}
      <ol className="mb-6 grid grid-cols-5 gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={cx("w-full border-t-2 pt-2.5 text-left transition-colors", i <= step ? "border-brand-green" : "border-brand-line", i < step && "hover:border-brand-dark")}
            >
              <span className={cx("flex items-center gap-1.5 text-xs font-medium", i <= step ? "text-brand-green" : "text-brand-muted")}>
                {i < step ? <Check className="h-3.5 w-3.5" aria-hidden /> : <span className="tabular">{i + 1}</span>}
                <span className="hidden sm:inline">Step</span>
              </span>
              <span className={cx("mt-0.5 hidden text-sm sm:block", i === step ? "font-semibold text-brand-dark" : "text-brand-muted")}>{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <Card className="p-6 sm:p-8">
        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <h2 className="text-lg font-semibold text-brand-dark sm:col-span-2">Basic product information</h2>
            <Field label="Product name" htmlFor="name" error={errors.name} required>
              {input("name", { placeholder: "e.g. Reusable lunch box", maxLength: 120 })}
            </Field>
            <Field label="Product category" htmlFor="category" error={errors.category} required>
              {select("category", ref.categories.map((c) => [c, c]))}
            </Field>
            <Field label="Product description" htmlFor="description" error={errors.description} className="sm:col-span-2" hint="Optional. Anything that helps a reader understand what is being assessed.">
              <textarea id="description" rows={3} className="input" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} />
            </Field>
            <Field label="Production quantity (units)" htmlFor="production_quantity" error={errors.production_quantity} required hint="Size of the planned production batch.">
              {number("production_quantity", "1")}
            </Field>
            <Field label="Product weight (kg per unit)" htmlFor="product_weight_kg" error={errors.product_weight_kg} required hint="Finished product, without packaging.">
              {number("product_weight_kg")}
            </Field>
            <Field label="Expected product lifespan (years)" htmlFor="lifespan_years" error={errors.lifespan_years} required hint="Use a fraction for short-lived items, e.g. 0.1.">
              {number("lifespan_years")}
            </Field>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-brand-dark">Raw material selection</h2>
            <p className="mt-1 text-sm text-brand-muted">List the materials in one finished unit. Quantities should add up to the product weight ({fmt(weight)} kg). Scrap is added in the next step.</p>
            <div className="mt-6 space-y-3">
              <div className="hidden grid-cols-[1fr_9rem_9rem_6rem_2.5rem] gap-3 text-xs font-medium uppercase tracking-wider text-brand-muted md:grid">
                <span>Material</span>
                <span>Quantity (kg)</span>
                <span>Material type</span>
                <span className="text-right">% of weight</span>
                <span />
              </div>
              {form.materials.map((row, index) => {
                const mat = ref.materials.find((m) => m.id === row.material_id);
                const share = weight ? ((Number(row.quantity_kg) || 0) / weight) * 100 : 0;
                const update = (patch: Partial<typeof row>) => {
                  set("materials", form.materials.map((m) => (m.key === row.key ? { ...m, ...patch } : m)));
                  setErrors((e) => {
                    const { [`material_${row.key}`]: _a, [`quantity_${row.key}`]: _b, materials: _c, ...rest } = e;
                    return rest;
                  });
                };
                return (
                  <div key={row.key} className="grid gap-3 rounded-md border border-brand-line p-3 md:grid-cols-[1fr_9rem_9rem_6rem_2.5rem] md:items-start md:border-0 md:p-0">
                    <div>
                      <label htmlFor={`material_${row.key}`} className="sr-only">
                        Material {index + 1}
                      </label>
                      <select id={`material_${row.key}`} className={cx("input", errors[`material_${row.key}`] && "input-error")} value={row.material_id} onChange={(e) => update({ material_id: e.target.value })}>
                        <option value="">Select a material…</option>
                        {ref.materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      {errors[`material_${row.key}`] && <p className="mt-1 text-xs text-red-600">{errors[`material_${row.key}`]}</p>}
                    </div>
                    <div>
                      <label htmlFor={`quantity_${row.key}`} className="sr-only">
                        Quantity in kg for material {index + 1}
                      </label>
                      <input id={`quantity_${row.key}`} type="number" min={0} step="any" inputMode="decimal" placeholder="kg" className={cx("input", errors[`quantity_${row.key}`] && "input-error")} value={row.quantity_kg} onChange={(e) => update({ quantity_kg: e.target.value })} />
                      {errors[`quantity_${row.key}`] && <p className="mt-1 text-xs text-red-600">{errors[`quantity_${row.key}`]}</p>}
                    </div>
                    <p className="flex h-10 items-center text-sm text-brand-muted">{mat ? ref.families[mat.family] : "—"}</p>
                    <p className="tabular flex h-10 items-center text-sm text-brand-ink md:justify-end">{share ? `${fmt(share)}%` : "—"}</p>
                    <button type="button" className="flex h-10 w-10 items-center justify-center rounded-md text-brand-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-30" disabled={form.materials.length === 1} onClick={() => set("materials", form.materials.filter((m) => m.key !== row.key))} aria-label={`Remove material ${index + 1}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brand-line pt-4">
              <Button variant="secondary" size="sm" onClick={() => set("materials", [...form.materials, newRow()])} disabled={form.materials.length >= ref.materials.length}>
                <Plus className="h-4 w-4" aria-hidden /> Add material
              </Button>
              <p className="tabular text-sm text-brand-muted">
                Total <span className="font-semibold text-brand-ink">{fmt(total)} kg</span> of {fmt(weight)} kg ({weight ? fmt((total / weight) * 100) : 0}%)
              </p>
            </div>
            {errors.materials && (
              <div className="mt-4">
                <Notice tone="warn">
                  {errors.materials}{" "}
                  <button type="button" className="font-semibold underline" onClick={() => { set("product_weight_kg", String(+total.toPrecision(6))); setErrors({}); }}>
                    Set product weight to {fmt(total)} kg
                  </button>
                </Notice>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <h2 className="text-lg font-semibold text-brand-dark sm:col-span-2">Manufacturing details</h2>
            <Field label="Manufacturing method" htmlFor="method" error={errors.method} required>
              {select("method", ref.manufacturing_methods.map((m) => [m.id, m.name]))}
            </Field>
            <Field
              label="Energy consumption (kWh per unit)"
              htmlFor="energy_kwh_per_unit"
              error={errors.energy_kwh_per_unit}
              required
              hint={
                benchmarkEnergy !== null && method ? (
                  <>
                    Indicative for {method.name.toLowerCase()}: about {fmt(benchmarkEnergy, 2)} kWh.{" "}
                    <button type="button" className="font-medium text-brand-green underline" onClick={() => set("energy_kwh_per_unit", String(+benchmarkEnergy.toPrecision(2)))}>
                      Use this value
                    </button>
                  </>
                ) : (
                  "Electricity used to make one unit."
                )
              }
            >
              {number("energy_kwh_per_unit")}
            </Field>
            <Field label="Energy source" htmlFor="energy_source" error={errors.energy_source} required>
              {select("energy_source", ref.energy_sources.map((s) => [s.id, s.name]))}
            </Field>
            <Field label="Water consumption (litres per unit)" htmlFor="water_l_per_unit" error={errors.water_l_per_unit} required hint="Process water only. Enter 0 if none.">
              {number("water_l_per_unit")}
            </Field>
            <Field label="Manufacturing waste (%)" htmlFor="waste_pct" error={errors.waste_pct} required hint={method ? `Share of input material lost as scrap. Indicative for this method: ${method.typical_waste_pct}%.` : "Share of input material lost as scrap."}>
              {number("waste_pct")}
            </Field>
            <div className="hidden sm:block" />
            <Field label="Transportation distance (km)" htmlFor="transport_distance_km" error={errors.transport_distance_km} required hint="Factory to market, one way.">
              {number("transport_distance_km")}
            </Field>
            <Field label="Transportation mode" htmlFor="transport_mode" error={errors.transport_mode} required>
              {select("transport_mode", ref.transport_modes.map((m) => [m.id, m.name]))}
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <h2 className="text-lg font-semibold text-brand-dark sm:col-span-2">Packaging and end-of-life</h2>
            <Field label="Packaging material" htmlFor="packaging_material" error={errors.packaging_material} required>
              {select("packaging_material", ref.packaging_options.map((p) => [p.id, p.name]))}
            </Field>
            <Field label="Packaging weight (kg per unit)" htmlFor="packaging_weight_kg" error={errors.packaging_weight_kg} required={form.packaging_material !== "none"} hint="Share of packaging attributable to one unit.">
              {form.packaging_material === "none" ? <input id="packaging_weight_kg" className="input" value="0" disabled /> : number("packaging_weight_kg")}
            </Field>
            <Field label="Recyclability" htmlFor="recyclability" error={errors.recyclability} required hint="How much of the product could realistically be recycled.">
              {select("recyclability", Object.entries(ref.recyclability_levels).map(([k, v]) => [k, `${v.label} (about ${Math.round(v.fraction * 100)}% recoverable)`]))}
            </Field>
            <Field label="Expected disposal method" htmlFor="disposal_method" error={errors.disposal_method} required>
              {select("disposal_method", Object.entries(ref.disposal_methods))}
            </Field>
            <Field label="Reusable or single-use" htmlFor="use_type" error={errors.use_type} required>
              {select("use_type", Object.entries(ref.use_types))}
            </Field>
            <Field label="Repairability" htmlFor="repairability" error={errors.repairability} required>
              {select("repairability", Object.entries(ref.repairability_levels))}
            </Field>
          </div>
        )}

        {step === 4 && review && (
          <div>
            <h2 className="text-lg font-semibold text-brand-dark">Review your specification</h2>
            <p className="mt-1 text-sm text-brand-muted">Check the details below. You can go back to any step to make changes.</p>
            <div className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
              <ReviewBlock title="Product" onEdit={() => setStep(0)}>
                <Dl
                  rows={[
                    ["Name", review.name],
                    ["Category", review.category],
                    ["Production quantity", `${review.production_quantity.toLocaleString("en-GB")} units`],
                    ["Product weight", `${fmt(review.product_weight_kg)} kg`],
                    ["Expected lifespan", `${fmt(review.lifespan_years)} years`],
                  ]}
                />
                {review.description && <p className="mt-2 text-sm text-brand-muted">{review.description}</p>}
              </ReviewBlock>
              <ReviewBlock title="Materials" onEdit={() => setStep(1)}>
                <Dl rows={review.materials.map((m) => [ref.materialName(m.material_id), `${fmt(m.quantity_kg)} kg · ${fmt((m.quantity_kg / review.product_weight_kg) * 100)}%`])} />
              </ReviewBlock>
              <ReviewBlock title="Manufacturing" onEdit={() => setStep(2)}>
                <Dl
                  rows={[
                    ["Method", ref.methodName(review.manufacturing.method)],
                    ["Energy", `${fmt(review.manufacturing.energy_kwh_per_unit)} kWh per unit`],
                    ["Energy source", ref.sourceName(review.manufacturing.energy_source)],
                    ["Process water", `${fmt(review.manufacturing.water_l_per_unit)} L per unit`],
                    ["Manufacturing waste", `${fmt(review.manufacturing.waste_pct)}%`],
                    ["Transport", `${fmt(review.manufacturing.transport_distance_km)} km · ${ref.modeName(review.manufacturing.transport_mode)}`],
                  ]}
                />
              </ReviewBlock>
              <ReviewBlock title="Packaging and end-of-life" onEdit={() => setStep(3)}>
                <Dl
                  rows={[
                    ["Packaging", ref.packagingName(review.packaging.material)],
                    ["Packaging weight", `${fmt(review.packaging.weight_kg)} kg per unit`],
                    ["Recyclability", ref.recyclability_levels[review.end_of_life.recyclability]?.label],
                    ["Disposal", ref.disposal_methods[review.end_of_life.disposal_method]],
                    ["Use", ref.use_types[review.end_of_life.use_type]],
                    ["Repairability", ref.repairability_levels[review.end_of_life.repairability]],
                  ]}
                />
              </ReviewBlock>
            </div>
            <div className="mt-8">
              <Notice>The analysis is a preliminary screening using illustrative factors. Results are estimates, not measurements, and not a certified ISO-compliant Life Cycle Assessment.</Notice>
            </div>
            {serverError && (
              <div className="mt-4">
                <Notice tone="warn">{serverError}</Notice>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-brand-line pt-6">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || submitting}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
          </Button>
          {step < 4 ? (
            <Button onClick={next}>
              Continue <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button size="lg" onClick={submit} loading={submitting}>
              {submitting ? "Analyzing…" : "Analyze Environmental Impact"}
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1 flex items-center justify-between border-b border-brand-dark pb-2">
        <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-brand-ink">{title}</h3>
        <button type="button" onClick={onEdit} className="text-xs font-medium text-brand-green hover:underline">
          Edit
        </button>
      </div>
      {children}
    </section>
  );
}
