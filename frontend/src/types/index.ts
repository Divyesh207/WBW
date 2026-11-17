// Mirrors the FastAPI schemas (backend/app/schemas and engine outputs).

export interface MaterialInput {
  material_id: string;
  quantity_kg: number;
}

export interface ProductSpec {
  name: string;
  category: string;
  description: string;
  production_quantity: number;
  product_weight_kg: number;
  lifespan_years: number;
  materials: MaterialInput[];
  manufacturing: {
    method: string;
    energy_kwh_per_unit: number;
    energy_source: string;
    water_l_per_unit: number;
    waste_pct: number;
    transport_distance_km: number;
    transport_mode: string;
  };
  packaging: { material: string; weight_kg: number };
  end_of_life: {
    recyclability: string;
    disposal_method: string;
    use_type: string;
    repairability: string;
  };
}

export interface Totals {
  carbon_kg: number;
  carbon_low_kg: number;
  carbon_high_kg: number;
  energy_kwh: number;
  process_energy_kwh: number;
  embodied_energy_kwh: number;
  water_l: number;
  process_water_l: number;
  embodied_water_l: number;
  material_input_kg: number;
  packaging_kg: number;
  raw_material_kg: number;
  waste_kg: number;
  annualised_carbon_kg?: number;
}

export interface Stage {
  key: string;
  label: string;
  carbon_kg: number;
  batch_carbon_kg: number;
  share_pct: number;
  uncertainty_pct: number;
}

export interface MaterialRow {
  material_id: string;
  name: string;
  family: string;
  net_kg: number;
  gross_kg: number;
  carbon_kg: number;
  energy_kwh: number;
  water_l: number;
  emission_factor: number;
  share_weight_pct: number;
  share_carbon_pct: number;
}

export interface Hotspot {
  id: string;
  area: string;
  severity: "high" | "medium" | "low";
  share_pct: number | null;
  indicator: string;
  detail: string;
}

export interface AssessmentResult {
  functional_unit: string;
  production_quantity: number;
  boundary: string;
  disclaimer: string;
  per_unit: Totals;
  batch: Totals;
  stages: Stage[];
  materials: MaterialRow[];
  benchmarks: {
    method: string;
    energy_kwh_per_kg: number;
    typical_energy_kwh_per_kg: number;
    energy_ratio: number;
    waste_pct: number;
    typical_waste_pct: number;
  };
  circularity: {
    recyclability_label: string;
    recycled_content_pct: number;
    renewable_content_pct: number;
    disposal_label: string;
    use_type: string;
    repairability: string;
    lifespan_years: number;
  };
  hotspots: Hotspot[];
  methodology_version?: string;
  data_quality: { score: number; max_score: number; rating: string; uncertainty_pct: number; published_share_pct?: number; notes: string[] };
  factors_used: { name: string; value: number; unit: string; basis: string; source_type?: "published" | "illustrative" }[];
  provenance: { metric: string; basis: string; note: string }[];
  assumptions: string[];
  warnings: string[];
}

export type Verdict = "beneficial" | "mixed" | "advisory" | "not_beneficial";

export interface Recommendation {
  id: string;
  category: string;
  title: string;
  current_situation: string;
  suggested_alternative: string;
  estimated_benefit: string;
  cost_implications: string;
  feasibility: "High" | "Medium" | "Low";
  feasibility_note: string;
  trade_offs: string[];
  applicable: boolean;
  significance?: "clear" | "marginal" | "not_quantified";
  verdict: Verdict;
  impact: null | {
    carbon_pct: number | null;
    carbon_kg: number;
    energy_pct: number | null;
    water_pct: number | null;
    material_pct: number | null;
    waste_pct: number | null;
  };
}

export type Direction = "improved" | "worsened" | "unchanged";

export interface CompareMetric {
  key: string;
  label: string;
  unit: string;
  original: number;
  optimized: number;
  change: number;
  change_pct: number | null;
  direction: Direction;
}

export interface Comparison {
  basis: string;
  metrics: CompareMetric[];
  circularity: { key: string; label: string; original: string; optimized: string; direction: Direction }[];
  stages: { key: string; label: string; original: number; optimized: number }[];
  summary: {
    carbon_change_pct: number | null;
    carbon_saved_kg: number;
    energy_saved_kwh: number;
    water_saved_l: number;
    material_saved_kg: number;
    waste_saved_kg: number;
    improved: string[];
    worsened: string[];
  };
}

export interface Assessment {
  id: number;
  name: string;
  category: string;
  created_at: string;
  is_demo: boolean;
  spec: ProductSpec;
  result: AssessmentResult;
  recommendations: Recommendation[];
  selected_ids: string[];
  optimized_spec: ProductSpec;
  optimized_result: AssessmentResult;
  comparison: Comparison;
}

export interface AssessmentSummary {
  id: number;
  name: string;
  category: string;
  created_at: string;
  is_demo: boolean;
  production_quantity: number;
  carbon_per_unit_kg: number;
  carbon_batch_kg: number;
  optimized_carbon_batch_kg: number;
  carbon_change_pct: number | null;
  applied_count: number;
  recommendation_count: number;
  data_quality: string;
  uncertainty_pct: number;
  top_hotspot: string | null;
}

export interface MaterialFactor {
  id: string;
  name: string;
  family: string;
  emission_factor: number;
  embodied_energy: number;
  water: number;
  recycled_content: number;
  renewable: boolean;
  durability: number;
  uncertainty_pct: number;
  basis: string;
  notes: string;
  alternatives: { to: string }[];
}

export interface NamedFactor {
  id: string;
  name: string;
  emission_factor: number;
  basis: string;
  uncertainty_pct: number;
}

export interface DatasetMeta {
  title: string;
  status: string;
  note: string;
}

export interface Reference {
  categories: string[];
  families: Record<string, string>;
  materials: MaterialFactor[];
  energy_sources: (NamedFactor & { renewable: boolean })[];
  manufacturing_methods: { id: string; name: string; typical_energy: number; typical_waste_pct: number }[];
  transport_modes: NamedFactor[];
  packaging_options: (NamedFactor & { family: string })[];
  recyclability_levels: Record<string, { label: string; fraction: number }>;
  disposal_methods: Record<string, string>;
  use_types: Record<string, string>;
  repairability_levels: Record<string, string>;
  datasets: Record<string, DatasetMeta>;
}

export interface DemoScenario {
  key: string;
  summary: string;
  spec: ProductSpec;
}

export interface Dashboard {
  basis: string;
  totals: {
    products: number;
    avg_carbon_per_unit_kg: number;
    total_carbon_kg: number;
    carbon_avoided_kg: number;
    carbon_avoided_pct: number;
    material_saved_kg: number;
    water_saved_l: number;
    energy_saved_kwh: number;
    waste_saved_kg: number;
    waste_reduction_pct: number;
  };
  by_stage: { key: string; label: string; carbon_kg: number }[];
  materials: { name: string; kg: number }[];
  comparison: { id: number; name: string; original: number; optimized: number }[];
  history: { id: number; name: string; date: string; carbon_batch_kg: number }[];
  recent: AssessmentSummary[];
}
