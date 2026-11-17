import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Reference } from "../types";

interface ReferenceHelpers extends Reference {
  materialName: (id: string) => string;
  methodName: (id: string) => string;
  sourceName: (id: string) => string;
  modeName: (id: string) => string;
  packagingName: (id: string) => string;
}

const ReferenceContext = createContext<ReferenceHelpers | null>(null);

export function ReferenceProvider({ reference, children }: { reference: Reference; children: ReactNode }) {
  const value = useMemo<ReferenceHelpers>(() => {
    const lookup = (list: { id: string; name: string }[]) => {
      const map = new Map(list.map((x) => [x.id, x.name]));
      return (id: string) => map.get(id) ?? id;
    };
    return {
      ...reference,
      materialName: lookup(reference.materials),
      methodName: lookup(reference.manufacturing_methods),
      sourceName: lookup(reference.energy_sources),
      modeName: lookup(reference.transport_modes),
      packagingName: lookup(reference.packaging_options),
    };
  }, [reference]);
  return <ReferenceContext.Provider value={value}>{children}</ReferenceContext.Provider>;
}

/** Factor datasets and form options, loaded once when the application opens. */
export function useReference() {
  const ctx = useContext(ReferenceContext);
  if (!ctx) throw new Error("useReference must be used inside ReferenceProvider");
  return ctx;
}
