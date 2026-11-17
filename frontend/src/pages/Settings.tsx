import { useState } from "react";
import { CheckCircle2, Database, RotateCcw, XCircle } from "lucide-react";
import { BrandLogo } from "../components/brand/BrandLogo";
import { Button, Card, CardHeader, Field, PageHeader } from "../components/ui";
import { useToast } from "../components/Toast";
import { useAsync } from "../hooks/useAsync";
import { useReference } from "../hooks/useReference";
import { ApiError, api } from "../services/api";
import { DEFAULT_PROFILE, useProfile } from "../utils/profile";

export default function Settings() {
  const ref = useReference();
  const toast = useToast();
  const [profile, saveProfile] = useProfile();
  const [draft, setDraft] = useState(profile);
  const health = useAsync(api.health);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const save = () => {
    if (draft.name.trim().length < 2) {
      toast.error("Enter a display name of at least 2 characters.");
      return;
    }
    saveProfile({ ...draft, name: draft.name.trim(), organisation: draft.organisation.trim() || DEFAULT_PROFILE.organisation });
    toast.success("Profile saved.");
  };

  const reset = async () => {
    setResetting(true);
    try {
      const { seeded } = await api.resetDemo();
      toast.success(`Demo data restored: ${seeded} assessments.`);
      setConfirmReset(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Reset failed.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Workspace preferences for the demonstration prototype. There are no accounts or API keys: everything runs locally." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Demo user profile" hint="Shown in the sidebar. Stored in this browser only." />
          <div className="space-y-4 p-5">
            <Field label="Display name" htmlFor="profile-name" required>
              <input id="profile-name" className="input" value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Organisation" htmlFor="profile-org">
              <input id="profile-org" className="input" value={draft.organisation} maxLength={80} onChange={(e) => setDraft({ ...draft, organisation: e.target.value })} />
            </Field>
            <Field label="Default results view" htmlFor="profile-basis" hint="Which basis an assessment opens with.">
              <select id="profile-basis" className="input" value={draft.basis} onChange={(e) => setDraft({ ...draft, basis: e.target.value as "batch" | "unit" })}>
                <option value="batch">Whole production batch</option>
                <option value="unit">Per unit</option>
              </select>
            </Field>
            <Button onClick={save}>Save profile</Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Assessment service" hint="Local FastAPI backend with SQLite storage" />
            <div className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3 text-sm">
                {health.loading ? (
                  <span className="text-brand-muted">Checking…</span>
                ) : health.error ? (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" aria-hidden />
                    <span className="text-brand-ink">Not reachable</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-brand-emerald" aria-hidden />
                    <span className="text-brand-ink">Connected</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={health.reload}>
                  Check again
                </Button>
                <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-md border border-brand-line bg-white px-3 text-sm font-medium text-brand-ink hover:border-brand-green hover:text-brand-green">
                  API documentation
                </a>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Demo data" hint="Restore the four preconfigured demonstration assessments" />
            <div className="p-5">
              <p className="text-sm text-brand-muted">This deletes every saved assessment, including ones you created, and reloads the demo scenarios. It cannot be undone.</p>
              <div className="mt-4 flex gap-2">
                {confirmReset ? (
                  <>
                    <Button variant="danger" onClick={reset} loading={resetting}>
                      Yes, delete and restore
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmReset(false)} disabled={resetting}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" onClick={() => setConfirmReset(true)}>
                    <RotateCcw className="h-4 w-4" aria-hidden /> Reset demo data
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Factor datasets" hint="Configurable JSON files in backend/app/data — replace them to plug in a licensed LCA database" action={<Database className="h-4 w-4 text-brand-muted" aria-hidden />} />
        <ul className="divide-y divide-brand-line">
          {Object.entries(ref.datasets).map(([key, meta]) => (
            <li key={key} className="px-5 py-4">
              <p className="text-sm font-semibold text-brand-ink">{meta.title}</p>
              <p className="mt-0.5 text-xs font-medium text-amber-700">{meta.status}</p>
              <p className="mt-1.5 text-sm text-brand-muted">{meta.note}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-6 p-6">
        <BrandLogo size={40} />
        <p className="max-w-md text-xs leading-relaxed text-brand-muted">
          Waste Before Waste v1.0 — an academic sustainability project aligned with SDG 12, SDG 9 and SDG 13. A preliminary screening tool; not a certified ISO 14040/14044 Life Cycle Assessment.
        </p>
      </Card>
    </>
  );
}
