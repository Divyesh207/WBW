import { useEffect, useState } from "react";
import snapshot from "./labSnapshot.json";

/**
 * Data for the landing page's interactive sections.
 *
 * Every number is produced by the backend engines (see backend/app/services/landing_lab.py).
 * The page starts from a snapshot exported by that code, then swaps in the live
 * /api/lab response when the backend is reachable.
 */
export interface LabResult {
  carbon_kg: number;
  energy_kwh: number;
  water_l: number;
  raw_material_kg: number;
  waste_kg: number;
  carbon_low_kg: number;
  carbon_high_kg: number;
  uncertainty_pct: number;
  stages: { key: string; label: string; carbon_kg: number; share_pct: number }[];
}

export type IndicatorKey = "carbon_kg" | "energy_kwh" | "water_l" | "raw_material_kg" | "waste_kg";

export interface LabOption {
  id: string;
  label: string;
  look: "pet" | "rpet" | "glass" | "aluminium";
  note: string;
  mass_g: number;
  factor: number;
  results: Record<string, LabResult>;
}

export interface LabRecommendation {
  id: string;
  title: string;
  category: string;
  verdict: "beneficial" | "mixed" | "advisory" | "not_beneficial";
  significance: "clear" | "marginal" | "not_quantified";
  feasibility: string;
  estimated_benefit: string;
  trade_off: string;
  impact: null | Record<"carbon_pct" | "energy_pct" | "water_pct" | "material_pct" | "waste_pct", number | null>;
  applied: boolean;
}

export interface LabData {
  methodology_version: string;
  product: string;
  basis: string;
  disclaimer: string;
  indicators: { key: IndicatorKey; label: string; unit: string; scale: number }[];
  sources: { id: string; label: string }[];
  options: LabOption[];
  materials: { id: string; name: string; family: string; emission_factor: number; embodied_energy: number; water: number; durability: number; notes: string }[];
  demo: {
    name: string;
    quantity: number;
    carbon_per_unit_kg: number;
    uncertainty_pct: number;
    data_quality: string;
    stages: { key: string; label: string; original: number; optimized: number }[];
    metrics: { key: string; label: string; unit: string; original: number; optimized: number; change_pct: number | null }[];
    applied: number;
    hotspot: string;
    recommendations: LabRecommendation[];
  };
}

/** Colours for the five indicators, shared by the 3D scene, the fallback and the legend. */
export const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  carbon_kg: "#BEF264",
  energy_kwh: "#FBBF24",
  water_l: "#38BDF8",
  raw_material_kg: "#E2E8F0",
  waste_kg: "#FB7185",
};

export function useLab(): { lab: LabData; live: boolean } {
  const [state, setState] = useState<{ lab: LabData; live: boolean }>({ lab: snapshot as unknown as LabData, live: false });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/lab", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((lab: LabData) => setState({ lab, live: true }))
      .catch(() => undefined); // backend offline: keep the engine snapshot
    return () => controller.abort();
  }, []);
  return state;
}

/** Largest value of each indicator across every option and electricity source (the gauge's full scale). */
export function indicatorMaxima(lab: LabData): Record<IndicatorKey, number> {
  const max = {} as Record<IndicatorKey, number>;
  for (const ind of lab.indicators) {
    max[ind.key] = Math.max(...lab.options.flatMap((o) => Object.values(o.results).map((r) => r[ind.key])));
  }
  return max;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** True while the element is on screen; used to pause rendering and trigger animations. */
export function useInView<T extends Element>(rootMargin = "0px"): [(node: T | null) => void, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, rootMargin]);
  return [setNode, inView];
}

export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch {
    return false;
  }
}
