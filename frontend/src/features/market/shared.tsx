import type { ReactNode } from "react";
import { Check, Lock, Store } from "lucide-react";
import { Badge, ButtonLink, EmptyState, Spinner } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import type { Availability, Category, Grade, OrderEvent, OrderStatus, RequestStatus, Role } from "../../types/market";
import { cx, fmtDate } from "../../utils/format";

/* ------------------------------------------------------------ formatting */
export function money(value: number | null | undefined, currency = "INR"): string {
  if (value === null || value === undefined) return "–";
  const whole = Number.isInteger(value) || value >= 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(value);
}

export function kg(value: number): string {
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value)} kg`;
}

export const dateTime = (iso: string) => `${fmtDate(iso)}, ${new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

/* ------------------------------------------------------------ badges */
export const CATEGORY_LABELS: Record<Category, string> = {
  recycled: "Recycled",
  waste_based: "Waste-based",
  bio_based: "Bio-based",
  low_impact_virgin: "Low-impact virgin",
};

export function CategoryBadge({ category }: { category: Category }) {
  return <Badge tone={category === "low_impact_virgin" ? "outline" : "green"}>{CATEGORY_LABELS[category]}</Badge>;
}

export function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <span title={`Quality grade ${grade}`} className={cx("inline-flex h-6 w-6 items-center justify-center rounded font-display text-xs font-semibold", grade === "A" ? "bg-brand-dark text-white" : grade === "B" ? "bg-brand-green/15 text-brand-green" : "bg-brand-ink/10 text-brand-ink")}>
      {grade}
    </span>
  );
}

const AVAILABILITY: Record<Availability, { label: string; tone: "green" | "amber" | "red" }> = {
  in_stock: { label: "In stock", tone: "green" },
  limited: { label: "Limited stock", tone: "amber" },
  out_of_stock: { label: "Out of stock", tone: "red" },
};

export function AvailabilityBadge({ value }: { value: Availability }) {
  return <Badge tone={AVAILABILITY[value].tone}>{AVAILABILITY[value].label}</Badge>;
}

export function DemoTag({ show }: { show: boolean }) {
  return show ? (
    <Badge tone="outline" title="Fictional demonstration supplier">
      Demo
    </Badge>
  ) : null;
}

const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: "neutral" | "green" | "amber" | "red" | "dark" | "outline" }> = {
  pending: { label: "Awaiting supplier", tone: "amber" },
  quoted: { label: "Quote received", tone: "neutral" },
  accepted: { label: "Accepted", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  cancelled: { label: "Cancelled", tone: "outline" },
  ordered: { label: "Ordered", tone: "dark" },
};
const REQUEST_STATUS_SUPPLIER: Partial<Record<RequestStatus, string>> = { pending: "New request", quoted: "Quote sent" };

export function RequestStatusBadge({ status, role = "manufacturer" }: { status: RequestStatus; role?: Role }) {
  const style = REQUEST_STATUS[status];
  return <Badge tone={style.tone}>{(role === "supplier" && REQUEST_STATUS_SUPPLIER[status]) || style.label}</Badge>;
}

const ORDER_STATUS: Record<OrderStatus, { label: string; tone: "neutral" | "green" | "amber" | "red" | "dark" | "outline" }> = {
  placed: { label: "Placed", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "neutral" },
  dispatched: { label: "Dispatched", tone: "dark" },
  delivered: { label: "Delivered", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_STATUS[status].tone}>{ORDER_STATUS[status].label}</Badge>;
}

export const ORDER_ACTION_LABELS: Record<OrderStatus, string> = {
  placed: "Place",
  confirmed: "Confirm order",
  dispatched: "Mark as dispatched",
  delivered: "Mark as delivered",
  cancelled: "Cancel order",
};

/* ------------------------------------------------------------ order progress */
const STEPS: OrderStatus[] = ["placed", "confirmed", "dispatched", "delivered"];

export function OrderProgress({ status, compact = false }: { status: OrderStatus; compact?: boolean }) {
  if (status === "cancelled") return <OrderStatusBadge status="cancelled" />;
  const at = STEPS.indexOf(status);
  return (
    <ol className={cx("flex items-center", compact ? "gap-1" : "gap-2")} aria-label={`Order ${status}`}>
      {STEPS.map((step, i) => (
        <li key={step} className="flex items-center gap-2">
          <span className={cx("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold", i <= at ? "bg-brand-green text-white" : "border border-brand-line text-brand-muted")}>
            {i < at || status === "delivered" ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
          </span>
          {(!compact || i === at) && <span className={cx("hidden whitespace-nowrap text-xs sm:inline", i === at ? "font-semibold text-brand-ink" : "text-brand-muted")}>{ORDER_STATUS[step].label}</span>}
          {i < STEPS.length - 1 && <span className={cx("h-px", compact ? "w-3" : "w-6", i < at ? "bg-brand-green" : "bg-brand-line")} />}
        </li>
      ))}
    </ol>
  );
}

export function OrderTimeline({ events }: { events: OrderEvent[] }) {
  return (
    <ol className="relative space-y-5 border-l border-brand-line pl-6">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className={cx("absolute -left-[31px] top-0.5 h-3 w-3 rounded-full border-2 border-white", e.status === "cancelled" ? "bg-red-500" : "bg-brand-green")} />
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={e.status} />
            <span className="text-xs text-brand-muted">
              {dateTime(e.created_at)} · {e.actor_name} ({e.actor_role})
            </span>
          </div>
          {e.note && <p className="mt-1 text-sm text-brand-ink">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------ access gate */
/** Shows children only to a signed-in user with the required role. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, checking } = useAuth();
  if (checking) return <Spinner label="Checking your account…" />;
  if (!user) {
    return (
      <EmptyState
        icon={<Lock className="h-8 w-8" />}
        title="Sign in to use the Supplier Marketplace"
        description={role === "supplier" ? "Supplier tools need a supplier account. Sign in or create one to list materials and manage requests." : "Requests and orders need a manufacturer account. Sign in or create one to contact suppliers."}
        action={<ButtonLink to={`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Sign in or create account</ButtonLink>}
      />
    );
  }
  if (user.role !== role) {
    return (
      <EmptyState
        icon={<Store className="h-8 w-8" />}
        title={role === "supplier" ? "This area is for suppliers" : "This area is for manufacturers"}
        description={`You are signed in as a ${user.role}. ${role === "supplier" ? "Sign in with a supplier account to manage listings." : "Sign in with a manufacturer account to request materials."}`}
        action={<ButtonLink to={user.role === "supplier" ? "/app/supplier" : "/app/market"}>Go to your dashboard</ButtonLink>}
      />
    );
  }
  return <>{children}</>;
}
