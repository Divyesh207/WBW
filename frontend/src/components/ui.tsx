import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cx } from "../utils/format";

/* ------------------------------------------------------------------ Button */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "inverse";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const BUTTON_VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-green text-white hover:bg-brand-dark",
  secondary: "border border-brand-line bg-white text-brand-ink hover:border-brand-green hover:text-brand-green",
  ghost: "text-brand-ink hover:bg-brand-ink/5",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  inverse: "bg-brand-lime text-brand-dark hover:bg-white",
};
const BUTTON_SIZES = { sm: "h-8 px-3", md: "h-10 px-4", lg: "h-12 px-6 text-base" };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof BUTTON_SIZES;
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  to,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  to: string;
  variant?: Variant;
  size?: keyof typeof BUTTON_SIZES;
  className?: string;
  children: ReactNode;
}) {
  const cls = cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
  return to.startsWith("#") ? (
    <a href={to} className={cls}>
      {children}
    </a>
  ) : (
    <Link to={to} className={cls}>
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------- Card */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-lg border border-brand-line bg-white", className)}>{children}</section>;
}

export function CardHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brand-line px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-brand-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-brand-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- Badge */
const TONES = {
  neutral: "bg-brand-ink/5 text-brand-ink",
  green: "bg-emerald-50 text-brand-green",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  dark: "bg-brand-dark text-brand-paper",
  outline: "border border-brand-line text-brand-muted",
};

export function Badge({ tone = "neutral", children, title }: { tone?: keyof typeof TONES; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium", TONES[tone])}>
      {children}
    </span>
  );
}

/** Marks a figure as modelled rather than measured. */
export function EstimateTag({ label = "Estimate" }: { label?: string }) {
  return (
    <Badge tone="outline" title="Calculated from illustrative factors — not a measurement.">
      {label}
    </Badge>
  );
}

/* ------------------------------------------------------------ Page chrome */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-brand-dark">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-brand-muted">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, unit, note, tag }: { label: string; value: string; unit?: string; note?: ReactNode; tag?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-muted">{label}</p>
        {tag}
      </div>
      <p className="tabular mt-3 font-display text-2xl font-semibold text-brand-dark">
        {value}
        {unit && <span className="ml-1.5 font-sans text-sm font-medium text-brand-muted">{unit}</span>}
      </p>
      {note && <p className="mt-1 text-xs text-brand-muted">{note}</p>}
    </Card>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  const Icon = tone === "warn" ? AlertTriangle : Info;
  return (
    <div
      className={cx(
        "flex gap-3 rounded-md border-l-2 px-4 py-3 text-sm",
        tone === "warn" ? "border-amber-500 bg-amber-50 text-amber-900" : "border-brand-emerald bg-white text-brand-ink",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ States */
export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-brand-muted" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-brand-ink/5", className)} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-brand-line bg-white px-6 py-14 text-center">
      {icon && <div className="mb-4 text-brand-green">{icon}</div>}
      <h2 className="text-base font-semibold text-brand-dark">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-brand-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-red-200 bg-white px-6 py-12 text-center" role="alert">
      <AlertTriangle className="mb-3 h-6 w-6 text-red-600" aria-hidden />
      <h2 className="text-base font-semibold text-brand-ink">Something went wrong</h2>
      <p className="mt-1 max-w-md text-sm text-brand-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- Forms */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-brand-ink">
        {label}
        {required && <span className="ml-0.5 text-brand-green">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-brand-muted">{hint}</p>
      )}
    </div>
  );
}

export function Dl({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-brand-line text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-6 py-2.5">
          <dt className="text-brand-muted">{k}</dt>
          <dd className="text-right font-medium text-brand-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
