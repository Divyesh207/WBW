import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { GitCompareArrows, MapPin, PackageSearch, Search, Timer, X } from "lucide-react";
import { Button, Card, EmptyState, ErrorState, Notice, PageHeader, Skeleton } from "../../components/ui";
import { AvailabilityBadge, CATEGORY_LABELS, CategoryBadge, DemoTag, GradeBadge, kg, money } from "../../features/market/shared";
import { useAsync } from "../../hooks/useAsync";
import { marketApi } from "../../services/marketApi";
import type { Listing } from "../../types/market";
import { cx } from "../../utils/format";

const SORTS = [
  ["relevance", "Best match"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["quality", "Quality grade"],
  ["availability", "Most available"],
  ["recycled", "Recycled content"],
  ["lead_time", "Shortest lead time"],
] as const;

export default function Browse() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const meta = useAsync(marketApi.meta);
  const filters = {
    q: params.get("q") ?? "",
    category: params.get("category") ?? "",
    material_id: params.get("material_id") ?? "",
    min_grade: params.get("min_grade") ?? "",
    location: params.get("location") ?? "",
    max_price: params.get("max_price") ? Number(params.get("max_price")) : null,
    in_stock: params.get("in_stock") === "1",
    sort: params.get("sort") ?? "relevance",
  };
  const key = params.toString();
  const listings = useAsync(() => marketApi.listings(filters), [key]);
  const [query, setQuery] = useState(filters.q);
  const [picked, setPicked] = useState<Listing[]>([]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };
  const toggle = (item: Listing) =>
    setPicked((list) => (list.some((x) => x.id === item.id) ? list.filter((x) => x.id !== item.id) : list.length >= 4 ? list : [...list, item]));
  const materialName = useMemo(() => meta.data?.materials.find((m) => m.id === filters.material_id)?.name, [meta.data, filters.material_id]);
  const active = Object.entries(filters).filter(([k, v]) => k !== "sort" && v);

  return (
    <>
      <PageHeader title="Browse sustainable materials" description="Recycled, waste-based and bio-based raw materials listed by suppliers. Filter, then tick up to four listings to compare price, quality, quantity and availability." />

      {materialName && (
        <div className="mb-4">
          <Notice>
            Showing suppliers for <strong>{materialName}</strong>, a material recommended by the environmental assessment.{" "}
            <button type="button" className="font-medium text-brand-green underline" onClick={() => update({ material_id: null })}>
              Show all materials
            </button>
          </Notice>
        </div>
      )}

      <Card className="mb-6 p-4">
        <form
          className="grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: query.trim() || null });
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-brand-muted" aria-hidden />
            <input className="input pl-9" placeholder="Search material, form or supplier" value={query} onChange={(e) => setQuery(e.target.value)} onBlur={() => update({ q: query.trim() || null })} aria-label="Search listings" />
          </div>
          <select className="input" value={filters.category} onChange={(e) => update({ category: e.target.value })} aria-label="Category">
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className="input" value={filters.min_grade} onChange={(e) => update({ min_grade: e.target.value })} aria-label="Minimum quality grade">
            <option value="">Any quality</option>
            <option value="A">Grade A only</option>
            <option value="B">Grade B or better</option>
          </select>
          <input className="input" type="number" min={1} placeholder="Max ₹ per kg" value={filters.max_price ?? ""} onChange={(e) => update({ max_price: e.target.value || null })} aria-label="Maximum price per kg" />
          <select className="input" value={filters.sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort by">
            {SORTS.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2 text-brand-ink">
            <input type="checkbox" className="h-4 w-4 accent-brand-green" checked={filters.in_stock} onChange={(e) => update({ in_stock: e.target.checked ? "1" : null })} />
            In stock only
          </label>
          <input className="input h-8 w-48" placeholder="City or state" defaultValue={filters.location} onBlur={(e) => update({ location: e.target.value.trim() || null })} aria-label="Location" />
          <select className="input h-8 w-56" value={filters.material_id} onChange={(e) => update({ material_id: e.target.value })} aria-label="Library material">
            <option value="">Any library material</option>
            {meta.data?.materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {active.length > 0 && (
            <button type="button" className="text-brand-green hover:underline" onClick={() => { setQuery(""); setParams(new URLSearchParams(), { replace: true }); }}>
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {listings.error ? (
        <ErrorState message={listings.error} onRetry={listings.reload} />
      ) : listings.loading && !listings.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : listings.data!.length === 0 ? (
        <EmptyState icon={<PackageSearch className="h-8 w-8" />} title="No listings match" description="Try removing a filter or searching for a different material." />
      ) : (
        <>
          <p className="mb-3 text-sm text-brand-muted">
            {listings.data!.length} listing{listings.data!.length === 1 ? "" : "s"}
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {listings.data!.map((item) => {
              const on = picked.some((x) => x.id === item.id);
              return (
                <Card key={item.id} className={cx("flex flex-col p-5 transition-colors", on && "border-brand-green")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      <CategoryBadge category={item.category} />
                      <AvailabilityBadge value={item.availability} />
                    </div>
                    <GradeBadge grade={item.quality_grade} />
                  </div>
                  <Link to={`/app/market/listings/${item.id}`} className="mt-3 text-base font-semibold text-brand-dark hover:text-brand-green">
                    {item.title}
                  </Link>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-muted">
                    {item.supplier_name} <DemoTag show={item.supplier_is_demo} />
                  </p>
                  <p className="tabular mt-4 font-display text-2xl font-semibold text-brand-dark">
                    {money(item.price_per_kg, item.currency)}
                    <span className="ml-1 font-sans text-sm font-normal text-brand-muted">/ kg</span>
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-brand-muted">Available</dt>
                    <dd className="tabular text-right font-medium text-brand-ink">{kg(item.available_kg)}</dd>
                    <dt className="text-brand-muted">Minimum order</dt>
                    <dd className="tabular text-right font-medium text-brand-ink">{kg(item.min_order_kg)}</dd>
                    <dt className="text-brand-muted">Recycled content</dt>
                    <dd className="tabular text-right font-medium text-brand-ink">{item.recycled_content_pct}%</dd>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-brand-muted">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {item.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Timer className="h-3.5 w-3.5" aria-hidden />
                      {item.lead_time_days} days
                    </span>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                    <label className="flex items-center gap-2 text-sm text-brand-ink">
                      <input type="checkbox" className="h-4 w-4 accent-brand-green" checked={on} disabled={!on && picked.length >= 4} onChange={() => toggle(item)} />
                      Compare
                    </label>
                    <Link to={`/app/market/listings/${item.id}`} className="text-sm font-medium text-brand-green hover:underline">
                      View and request
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {picked.length > 0 && (
        <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-line bg-white px-5 py-3 shadow-lg shadow-brand-dark/5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-brand-muted">Compare ({picked.length}/4):</span>
            {picked.map((x) => (
              <span key={x.id} className="flex items-center gap-1 rounded bg-brand-paper px-2 py-1 text-xs text-brand-ink">
                {x.title}
                <button type="button" onClick={() => toggle(x)} aria-label={`Remove ${x.title}`} className="text-brand-muted hover:text-red-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
          <Button disabled={picked.length < 2} onClick={() => navigate(`/app/market/compare?ids=${picked.map((x) => x.id).join(",")}`)}>
            <GitCompareArrows className="h-4 w-4" aria-hidden /> {picked.length < 2 ? "Pick at least 2" : "Compare listings"}
          </Button>
        </div>
      )}
    </>
  );
}
