import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  FileText,
  FlaskConical,
  GitCompareArrows,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PlusCircle,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { BrandIcon } from "../components/brand/BrandIcon";
import { BrandLogo } from "../components/brand/BrandLogo";
import { LoadingScreen } from "../components/LoadingScreen";
import { Button, ButtonLink } from "../components/ui";
import { useAsync } from "../hooks/useAsync";
import { ReferenceProvider } from "../hooks/useReference";
import { api } from "../services/api";
import { cx } from "../utils/format";
import { useProfile } from "../utils/profile";

const NAV = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/new", label: "New Assessment", icon: PlusCircle },
  { to: "/app/assessments", label: "My Assessments", icon: ListChecks },
  { to: "/app/materials", label: "Material Explorer", icon: FlaskConical },
  { to: "/app/compare", label: "Compare Alternatives", icon: GitCompareArrows },
  { to: "/app/reports", label: "Impact Reports", icon: FileText },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [profile] = useProfile();
  const initials = profile.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex h-full flex-col bg-brand-dark text-brand-paper">
      <NavLink to="/" className="flex h-16 items-center px-5" aria-label="Waste Before Waste home" onClick={onNavigate}>
        <BrandLogo theme="dark" size={30} />
      </NavLink>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Application">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive ? "bg-white/10 font-medium text-white" : "text-brand-paper/70 hover:bg-white/5 hover:text-white",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-lime text-xs font-semibold text-brand-dark">{initials || "DU"}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{profile.name}</p>
            <p className="truncate text-xs text-brand-paper/60">{profile.organisation}</p>
          </div>
          <NavLink to="/" title="Exit to website" aria-label="Exit to website" className="text-brand-paper/60 hover:text-white">
            <LogOut className="h-4 w-4" />
          </NavLink>
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const reference = useAsync(api.reference);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const current = NAV.filter((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to))).pop();

  useEffect(() => {
    document.title = `${current?.label ?? "App"} · Waste Before Waste`;
  }, [current]);

  if (reference.loading && !reference.data) return <LoadingScreen />;

  if (reference.error || !reference.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-paper px-6 text-center">
        <BrandLogo layout="stacked" size={72} />
        <h1 className="mt-2 text-lg font-semibold text-brand-dark">The assessment service is not responding</h1>
        <p className="mt-2 max-w-md text-sm text-brand-muted">
          {reference.error} Start the backend with <code className="rounded bg-brand-ink/5 px-1.5 py-0.5 text-xs">uvicorn app.main:app --reload</code> in the{" "}
          <code className="rounded bg-brand-ink/5 px-1.5 py-0.5 text-xs">backend</code> folder, then try again.
        </p>
        <div className="mt-6 flex gap-3">
          <Button onClick={reference.reload}>Try again</Button>
          <ButtonLink to="/" variant="secondary">
            Back to website
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <ReferenceProvider reference={reference.data}>
      <div className="min-h-screen bg-brand-paper lg:pl-64">
        <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
          <Sidebar />
        </aside>

        {open && (
          <div className="no-print fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-brand-dark/50" onClick={() => setOpen(false)} aria-hidden />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">
              <Sidebar onNavigate={() => setOpen(false)} />
              <button type="button" className="absolute right-3 top-4 text-brand-paper/70 hover:text-white" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </aside>
          </div>
        )}

        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-brand-line bg-brand-paper/90 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-md p-1.5 text-brand-ink hover:bg-brand-ink/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            {/* Icon-only mark where the sidebar (and its full logo) is hidden */}
            <NavLink to="/app" className="lg:hidden" aria-label="Overview">
              <BrandIcon size={28} />
            </NavLink>
            <p className="hidden items-center gap-2 text-sm text-brand-muted sm:flex">
              <BarChart3 className="h-4 w-4" aria-hidden />
              <span>Pre-manufacturing screening</span>
              <span className="text-brand-line">/</span>
              <span className="font-medium text-brand-ink">{current?.label}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded border border-brand-line px-2 py-1 text-xs text-brand-muted md:inline">Illustrative factors · estimates only</span>
            <ButtonLink to="/app/new" size="sm">
              <PlusCircle className="h-4 w-4" aria-hidden />
              New assessment
            </ButtonLink>
          </div>
        </header>

        <main className="mx-auto w-full max-w-page px-4 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </ReferenceProvider>
  );
}
