import type { ProductSpec } from "../../types";

/** Wizard state. Numeric inputs are kept as strings so partially typed values are preserved. */
export interface MaterialRowState {
  key: number;
  material_id: string;
  quantity_kg: string;
}

export interface FormState {
  name: string;
  category: string;
  description: string;
  production_quantity: string;
  product_weight_kg: string;
  lifespan_years: string;
  materials: MaterialRowState[];
  method: string;
  energy_kwh_per_unit: string;
  energy_source: string;
  water_l_per_unit: string;
  waste_pct: string;
  transport_distance_km: string;
  transport_mode: string;
  packaging_material: string;
  packaging_weight_kg: string;
  recyclability: string;
  disposal_method: string;
  use_type: string;
  repairability: string;
}

export type Errors = Record<string, string>;

let rowKey = 1;
export const newRow = (material_id = "", quantity_kg = ""): MaterialRowState => ({ key: rowKey++, material_id, quantity_kg });

export const EMPTY_FORM: FormState = {
  name: "",
  category: "",
  description: "",
  production_quantity: "",
  product_weight_kg: "",
  lifespan_years: "",
  materials: [newRow()],
  method: "",
  energy_kwh_per_unit: "",
  energy_source: "grid_average",
  water_l_per_unit: "0",
  waste_pct: "",
  transport_distance_km: "",
  transport_mode: "road",
  packaging_material: "",
  packaging_weight_kg: "",
  recyclability: "",
  disposal_method: "",
  use_type: "",
  repairability: "",
};

export function fromSpec(spec: ProductSpec): FormState {
  return {
    name: spec.name,
    category: spec.category,
    description: spec.description,
    production_quantity: String(spec.production_quantity),
    product_weight_kg: String(spec.product_weight_kg),
    lifespan_years: String(spec.lifespan_years),
    materials: spec.materials.map((m) => newRow(m.material_id, String(m.quantity_kg))),
    method: spec.manufacturing.method,
    energy_kwh_per_unit: String(spec.manufacturing.energy_kwh_per_unit),
    energy_source: spec.manufacturing.energy_source,
    water_l_per_unit: String(spec.manufacturing.water_l_per_unit),
    waste_pct: String(spec.manufacturing.waste_pct),
    transport_distance_km: String(spec.manufacturing.transport_distance_km),
    transport_mode: spec.manufacturing.transport_mode,
    packaging_material: spec.packaging.material,
    packaging_weight_kg: String(spec.packaging.weight_kg),
    recyclability: spec.end_of_life.recyclability,
    disposal_method: spec.end_of_life.disposal_method,
    use_type: spec.end_of_life.use_type,
    repairability: spec.end_of_life.repairability,
  };
}

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

export function toSpec(f: FormState): ProductSpec {
  return {
    name: f.name.trim(),
    category: f.category,
    description: f.description.trim(),
    production_quantity: Math.round(num(f.production_quantity)),
    product_weight_kg: num(f.product_weight_kg),
    lifespan_years: num(f.lifespan_years),
    materials: f.materials.map((m) => ({ material_id: m.material_id, quantity_kg: num(m.quantity_kg) })),
    manufacturing: {
      method: f.method,
      energy_kwh_per_unit: num(f.energy_kwh_per_unit),
      energy_source: f.energy_source,
      water_l_per_unit: num(f.water_l_per_unit),
      waste_pct: num(f.waste_pct),
      transport_distance_km: num(f.transport_distance_km),
      transport_mode: f.transport_mode,
    },
    packaging: { material: f.packaging_material, weight_kg: f.packaging_material === "none" ? 0 : num(f.packaging_weight_kg) },
    end_of_life: {
      recyclability: f.recyclability,
      disposal_method: f.disposal_method,
      use_type: f.use_type,
      repairability: f.repairability,
    },
  };
}

export const materialTotal = (f: FormState) => f.materials.reduce((sum, m) => sum + (Number(m.quantity_kg) || 0), 0);

function check(errors: Errors, key: string, value: string, label: string, opts: { min?: number; max?: number; positive?: boolean; integer?: boolean }) {
  const n = num(value);
  if (Number.isNaN(n)) errors[key] = `Enter ${label}.`;
  else if (opts.positive && n <= 0) errors[key] = `${cap(label)} must be greater than 0.`;
  else if (opts.min !== undefined && n < opts.min) errors[key] = `${cap(label)} cannot be less than ${opts.min}.`;
  else if (opts.max !== undefined && n > opts.max) errors[key] = `${cap(label)} cannot be more than ${opts.max.toLocaleString("en-GB")}.`;
  else if (opts.integer && !Number.isInteger(n)) errors[key] = `${cap(label)} must be a whole number.`;
}
function cap(label: string) {
  const text = label.replace(/^(a|an|the) /i, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Validate one wizard step (0-3). Step 4 is the review. Messages say how to fix the problem. */
export function validateStep(step: number, f: FormState): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (f.name.trim().length < 2) e.name = "Give the product a name (at least 2 characters).";
    if (!f.category) e.category = "Choose a product category.";
    if (f.description.length > 1000) e.description = "Keep the description under 1,000 characters.";
    check(e, "production_quantity", f.production_quantity, "the production quantity", { min: 1, max: 100_000_000, integer: true });
    check(e, "product_weight_kg", f.product_weight_kg, "the product weight", { positive: true, max: 100_000 });
    check(e, "lifespan_years", f.lifespan_years, "the expected lifespan", { positive: true, max: 200 });
  }
  if (step === 1) {
    const seen = new Set<string>();
    f.materials.forEach((m) => {
      if (!m.material_id) e[`material_${m.key}`] = "Choose a material.";
      else if (seen.has(m.material_id)) e[`material_${m.key}`] = "Already listed — combine into one row.";
      seen.add(m.material_id);
      const q = num(m.quantity_kg);
      if (Number.isNaN(q) || q <= 0) e[`quantity_${m.key}`] = "Enter a quantity above 0.";
    });
    const weight = num(f.product_weight_kg);
    const total = materialTotal(f);
    if (!Object.keys(e).length && weight > 0 && Math.abs(total - weight) > 0.05 * weight) {
      e.materials = `Materials add up to ${+total.toPrecision(4)} kg but the product weighs ${+weight.toPrecision(4)} kg. Adjust the quantities, or match the product weight to the total.`;
    }
  }
  if (step === 2) {
    if (!f.method) e.method = "Choose a manufacturing method.";
    check(e, "energy_kwh_per_unit", f.energy_kwh_per_unit, "the energy used per unit", { min: 0, max: 100_000 });
    if (!f.energy_source) e.energy_source = "Choose an energy source.";
    check(e, "water_l_per_unit", f.water_l_per_unit, "the water used per unit (0 if none)", { min: 0, max: 10_000_000 });
    check(e, "waste_pct", f.waste_pct, "the manufacturing waste percentage", { min: 0, max: 90 });
    check(e, "transport_distance_km", f.transport_distance_km, "the transport distance", { min: 0, max: 50_000 });
    if (!f.transport_mode) e.transport_mode = "Choose a transport mode.";
  }
  if (step === 3) {
    if (!f.packaging_material) e.packaging_material = "Choose a packaging material (or “No packaging”).";
    else if (f.packaging_material !== "none") check(e, "packaging_weight_kg", f.packaging_weight_kg, "the packaging weight per unit", { positive: true, max: 10_000 });
    if (!f.recyclability) e.recyclability = "Rate how recyclable the product is.";
    if (!f.disposal_method) e.disposal_method = "Choose the expected disposal method.";
    if (!f.use_type) e.use_type = "Say whether the product is reusable or single-use.";
    if (!f.repairability) e.repairability = "Rate repairability (or “Not applicable”).";
  }
  return e;
}
