/** Number formatting that avoids false precision: never more than three significant figures. */
export function fmt(value: number | null | undefined, sig = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  if (value === 0) return "0";
  return Number(value.toPrecision(sig)).toLocaleString("en-GB", { maximumSignificantDigits: sig });
}

export const fmtUnit = (value: number | null | undefined, unit: string, sig = 3) => `${fmt(value, sig)} ${unit}`;

/** Compact mass: grams below 1 kg, tonnes above 10,000 kg. */
export function fmtMass(kg: number, suffix = ""): string {
  if (kg !== 0 && Math.abs(kg) < 1) return `${fmt(kg * 1000)} g${suffix}`;
  if (Math.abs(kg) >= 10000) return `${fmt(kg / 1000)} t${suffix}`;
  return `${fmt(kg)} kg${suffix}`;
}

export function fmtVolume(litres: number): string {
  if (Math.abs(litres) >= 10000) return `${fmt(litres / 1000)} m³`;
  return `${fmt(litres)} L`;
}

export function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "n/a";
  if (Math.abs(value) < 0.5) return "No change";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(0)}%`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Typographic form of a unit for the UI (the API and PDF use plain ASCII). */
export const prettyUnit = (unit: string) => unit.replace("CO2e", "CO₂e");

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");
