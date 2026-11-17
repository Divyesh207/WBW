import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, UserRound } from "lucide-react";
import { BrandLogo } from "../components/brand/BrandLogo";
import { Button } from "../components/ui";
import { useProfile } from "../utils/profile";

/** The prototype has no authentication: this screen opens the shared demo workspace. */
export default function SignIn() {
  const navigate = useNavigate();
  const [profile] = useProfile();

  useEffect(() => {
    document.title = "Sign in · Waste Before Waste";
  }, []);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-dark p-12 lg:flex">
        <Link to="/" aria-label="Waste Before Waste — home">
          <BrandLogo theme="dark" size={36} />
        </Link>
        <div>
          <p className="max-w-md font-display text-3xl font-semibold leading-snug text-brand-paper">Don't manage waste after it exists. Prevent it before it is manufactured.</p>
          <p className="mt-4 text-sm text-brand-paper/60">Think Before You Manufacture.</p>
        </div>
        <p className="text-xs text-brand-paper/50">Preliminary screening tool · illustrative factors · estimates only</p>
      </div>

      <div className="flex flex-col items-center justify-center bg-brand-paper px-6 py-16">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden" aria-label="Waste Before Waste — home">
            <BrandLogo size={32} />
          </Link>
          <h1 className="mt-10 text-2xl font-semibold tracking-tight text-brand-dark lg:mt-0">Welcome back</h1>
          <p className="mt-2 text-sm text-brand-muted">This prototype runs as a single demo workspace. No password or account is needed.</p>

          <div className="mt-8 flex items-center gap-3 rounded-lg border border-brand-line bg-white p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-lime text-brand-dark">
              <UserRound className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-brand-ink">{profile.name}</p>
              <p className="truncate text-xs text-brand-muted">{profile.organisation}</p>
            </div>
          </div>

          <Button className="mt-4 w-full" size="lg" onClick={() => navigate("/app")}>
            Continue to dashboard <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
          <p className="mt-6 text-center text-xs text-brand-muted">
            Demo assessments are preloaded. You can rename the demo user in Settings.
          </p>
          <p className="mt-8 text-center text-sm">
            <Link to="/" className="text-brand-green hover:underline">
              ← Back to website
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
