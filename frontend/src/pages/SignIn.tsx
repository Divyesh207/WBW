import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Factory, Store } from "lucide-react";
import { BrandLogo } from "../components/brand/BrandLogo";
import { Button, Field, Notice } from "../components/ui";
import { useToast } from "../components/Toast";
import { homeFor, useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/api";
import type { Role } from "../types/market";
import { cx } from "../utils/format";

// Test credentials for the local demo; also documented in backend/app/services/marketplace_seed.py.
const DEMO_PASSWORD = "Demo@2026";
const DEMOS = [
  { email: "manufacturer@wbw.demo", label: "Demo manufacturer", hint: "GreenPack Bottling", icon: Factory },
  { email: "ecopolymer@wbw.demo", label: "Demo supplier", hint: "EcoPolymer Recyclers", icon: Store },
];

export default function SignIn() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<"signin" | "register">(params.get("mode") === "register" ? "register" : "signin");
  const [role, setRole] = useState<Role>("manufacturer");
  const [form, setForm] = useState({ name: "", email: "", password: "", organisation: "", company_name: "", city: "", state: "", supplier_type: "recycler" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = params.get("next");

  useEffect(() => {
    document.title = "Sign in · Waste Before Waste";
  }, []);

  const go = (u: { role: Role }) => navigate(next && next.startsWith("/app") ? next : homeFor(u as never));
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const run = async (action: () => Promise<{ role: Role; name: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const u = await action();
      toast.success(`Signed in as ${u.name}.`);
      go(u);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signin") run(() => login(form.email, form.password));
    else run(() => register({ ...form, role }));
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-dark p-12 lg:flex">
        <Link to="/" aria-label="Waste Before Waste — home">
          <BrandLogo theme="dark" size={36} />
        </Link>
        <div>
          <p className="max-w-md font-display text-3xl font-semibold leading-snug text-brand-paper">Choose better materials before production, then source them from suppliers who make them.</p>
          <ul className="mt-8 space-y-3 text-sm text-brand-paper/75">
            <li>Manufacturers: assess products, compare recycled and waste-based materials, request quotes and track orders.</li>
            <li>Suppliers and waste producers: list materials, answer requests and manage deliveries.</li>
          </ul>
        </div>
        <p className="text-xs text-brand-paper/50">Think Before You Manufacture.</p>
      </div>

      <div className="flex flex-col items-center justify-center bg-brand-paper px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden" aria-label="Waste Before Waste — home">
            <BrandLogo size={32} />
          </Link>

          {user ? (
            <div className="mt-10 lg:mt-0">
              <h1 className="text-2xl font-semibold tracking-tight text-brand-dark">You are signed in</h1>
              <p className="mt-2 text-sm text-brand-muted">
                {user.name} · {user.organisation} ({user.role})
              </p>
              <Button className="mt-6 w-full" size="lg" onClick={() => go(user)}>
                Continue <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-10 flex gap-1 rounded-md border border-brand-line bg-white p-1 lg:mt-0" role="tablist">
                {(["signin", "register"] as const).map((m) => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }} className={cx("flex-1 rounded px-3 py-2 text-sm font-medium", mode === m ? "bg-brand-dark text-white" : "text-brand-muted hover:text-brand-ink")}>
                    {m === "signin" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                {mode === "register" && (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-brand-ink">I am a</p>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
                      {([["manufacturer", "Manufacturer", Factory], ["supplier", "Supplier / waste producer", Store]] as const).map(([value, label, Icon]) => (
                        <button key={value} type="button" role="radio" aria-checked={role === value} onClick={() => setRole(value)} className={cx("flex items-center gap-2 rounded-md border px-3 py-3 text-left text-sm", role === value ? "border-brand-green bg-emerald-50 font-medium text-brand-dark" : "border-brand-line bg-white text-brand-muted")}>
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {mode === "register" && (
                  <Field label="Your name" htmlFor="name" required>
                    <input id="name" className="input" value={form.name} onChange={set("name")} autoComplete="name" />
                  </Field>
                )}
                <Field label="Email" htmlFor="email" required>
                  <input id="email" type="email" className="input" value={form.email} onChange={set("email")} autoComplete="email" />
                </Field>
                <Field label="Password" htmlFor="password" required hint={mode === "register" ? "At least 8 characters, with a letter and a number." : undefined}>
                  <input id="password" type="password" className="input" value={form.password} onChange={set("password")} autoComplete={mode === "register" ? "new-password" : "current-password"} />
                </Field>
                {mode === "register" && role === "manufacturer" && (
                  <Field label="Company" htmlFor="organisation">
                    <input id="organisation" className="input" value={form.organisation} onChange={set("organisation")} autoComplete="organization" />
                  </Field>
                )}
                {mode === "register" && role === "supplier" && (
                  <>
                    <Field label="Company name" htmlFor="company_name" required>
                      <input id="company_name" className="input" value={form.company_name} onChange={set("company_name")} autoComplete="organization" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="City" htmlFor="city">
                        <input id="city" className="input" value={form.city} onChange={set("city")} />
                      </Field>
                      <Field label="State" htmlFor="state">
                        <input id="state" className="input" value={form.state} onChange={set("state")} />
                      </Field>
                    </div>
                    <Field label="Supplier type" htmlFor="supplier_type">
                      <select id="supplier_type" className="input" value={form.supplier_type} onChange={set("supplier_type")}>
                        <option value="recycler">Recycler</option>
                        <option value="waste_producer">Waste producer (industrial by-products)</option>
                        <option value="material_supplier">Sustainable material supplier</option>
                      </select>
                    </Field>
                  </>
                )}
                {error && <Notice tone="warn">{error}</Notice>}
                <Button type="submit" className="w-full" size="lg" loading={busy}>
                  {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <div className="mt-8 border-t border-brand-line pt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-brand-muted">Try a demo account</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {DEMOS.map(({ email, label, hint, icon: Icon }) => (
                    <button key={email} type="button" disabled={busy} onClick={() => run(() => login(email, DEMO_PASSWORD))} className="flex items-center gap-3 rounded-md border border-brand-line bg-white px-3 py-2.5 text-left hover:border-brand-green disabled:opacity-50">
                      <Icon className="h-4 w-4 shrink-0 text-brand-green" aria-hidden />
                      <span>
                        <span className="block text-sm font-medium text-brand-ink">{label}</span>
                        <span className="block text-xs text-brand-muted">{hint} (fictional)</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <p className="mt-8 text-center text-sm text-brand-muted">
            <Link to="/app" className="text-brand-green hover:underline">
              Use the assessment tools without signing in
            </Link>
            <span className="mx-2 text-brand-line">·</span>
            <Link to="/" className="hover:underline">
              Back to website
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
