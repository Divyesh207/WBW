import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Check, ClipboardList, GitCompareArrows, Lightbulb, ScanSearch, Target } from "lucide-react";
import { STAGE_COLORS } from "../../utils/palette";
import { cx, fmt } from "../../utils/format";
import { useInView, usePrefersReducedMotion, type LabData, type LabRecommendation } from "./lab";

const EASE = [0.22, 1, 0.36, 1] as const;
const pretty = (unit: string) => unit.replace("CO2e", "CO₂e").replace("litres", "L");

/** Animates a number towards its target; jumps straight there when motion is reduced. */
export function useCountUp(target: number, run: boolean) {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (!run || reduced) {
      setValue(target);
      from.current = target;
      return;
    }
    const start = from.current;
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / 700);
      const next = start + (target - start) * (1 - (1 - t) ** 3);
      setValue(next);
      from.current = next;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, run, reduced]);
  return value;
}

/* ============================================================ Problem curve */
/**
 * Schematic of the design paradox: impact is committed early, while the freedom
 * to change it disappears. Drawn as an illustration of the idea, not from data.
 */
export function ProblemCurve() {
  const stages = ["Concept", "Design", "Materials", "Tooling", "Production", "Use", "Disposal"];
  const x = (i: number) => 40 + i * 80;
  const committed = "M40 232 C 110 228, 150 96, 200 78 S 330 52, 520 44";
  const freedom = "M40 46 C 120 50, 160 150, 200 176 S 330 222, 520 232";
  const draw = { initial: { pathLength: 0 }, whileInView: { pathLength: 1 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 1.4, ease: EASE } };
  return (
    <figure>
      <svg viewBox="0 0 560 300" className="w-full" role="img" aria-label="Schematic: environmental impact is committed early in design while the freedom to change it falls">
        {[44, 91, 138, 185, 232].map((y) => (
          <line key={y} x1={40} x2={520} y1={y} y2={y} stroke="#F8FAF7" strokeOpacity={0.08} />
        ))}
        {/* where each approach acts */}
        <rect x={x(1) - 34} y={30} width={148} height={216} rx={6} fill="#10B981" fillOpacity={0.14} />
        <rect x={x(6) - 34} y={30} width={54} height={216} rx={6} fill="#F8FAF7" fillOpacity={0.06} />
        <text x={x(1) + 40} y={22} textAnchor="middle" fontSize={11} fontWeight={600} fill="#BEF264">Waste Before Waste acts here</text>
        <text x={x(6) - 7} y={22} textAnchor="end" fontSize={11} fill="#F8FAF7" fillOpacity={0.6}>Waste management acts here</text>

        <motion.path d={committed} fill="none" stroke="#FB7185" strokeWidth={3} strokeLinecap="round" {...draw} />
        <motion.path d={freedom} fill="none" stroke="#BEF264" strokeWidth={3} strokeLinecap="round" {...draw} transition={{ ...draw.transition, delay: 0.2 }} />
        <text x={516} y={80} textAnchor="end" fontSize={12} fontWeight={600} fill="#FB7185">Impact already committed</text>
        <text x={516} y={204} textAnchor="end" fontSize={12} fontWeight={600} fill="#BEF264">Freedom to change it</text>

        {stages.map((label, i) => (
          <g key={label}>
            <line x1={x(i)} x2={x(i)} y1={246} y2={252} stroke="#F8FAF7" strokeOpacity={0.4} />
            <text x={x(i)} y={270} textAnchor="middle" fontSize={11} fill="#F8FAF7" fillOpacity={i === 1 || i === 2 ? 1 : 0.6} fontWeight={i === 1 || i === 2 ? 600 : 400}>
              {label}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 text-xs text-brand-paper/50">Schematic illustration of a widely described design principle. Not measured data.</figcaption>
    </figure>
  );
}

/* ================================================= Shared engine-data pieces */
function StageBars({ lab, mode, highlight }: { lab: LabData; mode: "original" | "optimized"; highlight?: string }) {
  const max = Math.max(...lab.demo.stages.map((s) => s.original));
  return (
    <ul className="space-y-2.5">
      {lab.demo.stages.map((s) => (
        <li key={s.key} className={cx("grid grid-cols-[8.5rem_1fr_4.5rem] items-center gap-3 text-xs transition-opacity", highlight && highlight !== s.key && "opacity-40")}>
          <span className="text-brand-muted">{s.label}</span>
          <span className="h-2.5 overflow-hidden rounded-sm bg-brand-paper">
            <motion.span className="block h-full rounded-sm" style={{ background: STAGE_COLORS[s.key] }} initial={false} animate={{ width: `${(s[mode] / max) * 100}%` }} transition={{ duration: 0.6, ease: EASE }} />
          </span>
          <span className="tabular text-right font-medium text-brand-ink">{fmt(s[mode])} kg</span>
        </li>
      ))}
    </ul>
  );
}

const VERDICT_STYLE: Record<LabRecommendation["verdict"], { label: string; cls: string }> = {
  beneficial: { label: "Improves", cls: "bg-emerald-50 text-brand-green" },
  mixed: { label: "Mixed", cls: "bg-amber-50 text-amber-800" },
  advisory: { label: "Design advice", cls: "bg-brand-ink/5 text-brand-ink" },
  not_beneficial: { label: "No gain", cls: "bg-red-50 text-red-700" },
};

function RecRow({ rec, detailed }: { rec: LabRecommendation; detailed?: boolean }) {
  const carbon = rec.impact?.carbon_pct ?? null;
  return (
    <li className="flex items-start gap-3 py-3">
      <span className={cx("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium", VERDICT_STYLE[rec.verdict].cls)}>{VERDICT_STYLE[rec.verdict].label}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-brand-ink">{rec.title}</p>
        {detailed && <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">{pretty(rec.verdict === "beneficial" && rec.significance === "clear" ? rec.estimated_benefit : rec.trade_off)}</p>}
      </div>
      {carbon !== null && (
        <span className={cx("tabular flex shrink-0 items-center gap-0.5 text-sm font-semibold", Math.abs(carbon) < 0.5 ? "text-brand-muted" : carbon < 0 ? "text-brand-green" : "text-red-600")}>
          {carbon < -0.5 ? <ArrowDown className="h-3.5 w-3.5" aria-hidden /> : carbon > 0.5 ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : null}
          {Math.abs(carbon).toFixed(0)}%
        </span>
      )}
    </li>
  );
}

/* ============================================================== How it works */
const STEPS = [
  { title: "Enter Product Details", body: "Describe the product, its materials, process, packaging and end of life.", icon: ClipboardList },
  { title: "Analyze Environmental Impact", body: "A transparent, rule-based engine estimates impact stage by stage.", icon: ScanSearch },
  { title: "Identify High-Impact Areas", body: "Hotspots show which decisions drive most of the footprint.", icon: Target },
  { title: "Explore Sustainable Alternatives", body: "Review alternatives with benefit, cost, feasibility and limits.", icon: Lightbulb },
  { title: "Compare and Optimize", body: "Apply the changes you choose and compare the recalculated result.", icon: GitCompareArrows },
];
const STEP_MS = 5200;

export function HowItWorks({ lab }: { lab: LabData }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLDivElement>("-120px");
  const auto = inView && !paused && !reduced;

  useEffect(() => {
    if (!auto) return;
    const timer = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(timer);
  }, [auto, active]);

  const carbon = lab.demo.metrics[0];
  const top = lab.demo.recommendations.slice(0, 3);
  const panels = [
    <div key="0" className="flex flex-wrap gap-2">
      {["Single-use bottle", "Virgin PET · 25 g", "Blow moulding", "0.035 kWh grid electricity", "3% scrap", "LDPE film · 4 g", "Road · 400 km", "Landfill", `${lab.demo.quantity.toLocaleString("en-GB")} units`].map((chip, i) => (
        <motion.span key={chip} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-md border border-brand-line bg-brand-paper px-2.5 py-1.5 text-xs text-brand-ink">
          {chip}
        </motion.span>
      ))}
    </div>,
    <div key="1">
      <p className="mb-4 text-sm text-brand-muted">
        Estimated <span className="tabular font-semibold text-brand-ink">{fmt(carbon.original)} kg CO₂e</span> for the batch (±{lab.demo.uncertainty_pct}%), split by life-cycle stage.
      </p>
      <StageBars lab={lab} mode="original" />
    </div>,
    <div key="2">
      <p className="mb-4 rounded-md border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900">{lab.demo.hotspot}</p>
      <StageBars lab={lab} mode="original" highlight="materials" />
    </div>,
    <ul key="3" className="divide-y divide-brand-line">
      {top.map((rec) => (
        <RecRow key={rec.id} rec={rec} />
      ))}
      <li className="pt-3 text-xs text-brand-muted">Each figure is the product recalculated with that one change.</li>
    </ul>,
    <div key="4">
      <p className="mb-4 text-sm text-brand-muted">
        With {lab.demo.applied} changes applied: <span className="tabular font-semibold text-brand-green">{fmt(carbon.optimized)} kg CO₂e</span>, an estimated {Math.abs(carbon.change_pct ?? 0).toFixed(0)}% lower.
      </p>
      <StageBars lab={lab} mode="optimized" />
    </div>,
  ];

  return (
    <div ref={ref} className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <ol role="tablist" aria-label="How it works" className="space-y-1">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <button
              type="button"
              role="tab"
              id={`step-tab-${i}`}
              aria-selected={active === i}
              aria-controls="step-panel"
              onClick={() => setActive(i)}
              className={cx("relative flex w-full items-start gap-4 overflow-hidden rounded-lg px-4 py-3.5 text-left transition-colors", active === i ? "bg-brand-paper" : "hover:bg-brand-paper/60")}
            >
              <span className={cx("tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold transition-colors", i < active ? "bg-brand-emerald text-white" : active === i ? "bg-brand-dark text-brand-paper" : "border border-brand-line text-brand-muted")}>
                {i < active ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span>
                <span className={cx("block text-base font-semibold", active === i ? "text-brand-dark" : "text-brand-ink/80")}>{step.title}</span>
                {active === i && <span className="mt-1 block text-sm leading-relaxed text-brand-muted">{step.body}</span>}
              </span>
              {active === i && auto && <motion.span key={`bar-${i}`} className="absolute bottom-0 left-0 h-0.5 bg-brand-emerald" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: STEP_MS / 1000, ease: "linear" }} />}
            </button>
          </li>
        ))}
      </ol>

      <div id="step-panel" role="tabpanel" aria-labelledby={`step-tab-${active}`} className="rounded-xl border border-brand-line bg-white">
        <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3 text-xs text-brand-muted">
          {(() => {
            const Icon = STEPS[active].icon;
            return <Icon className="h-4 w-4 text-brand-green" aria-hidden />;
          })()}
          <span className="font-medium text-brand-ink">Step {active + 1}</span>
          <span>· demo product: {lab.demo.name.toLowerCase()}</span>
        </div>
        <div className="min-h-[15.5rem] p-5">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              {panels[active]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ====================================== Impact: original vs optimised + recs */
export function ImpactSection({ lab }: { lab: LabData }) {
  const [mode, setMode] = useState<"original" | "optimized">("original");
  const [ref, inView] = useInView<HTMLDivElement>("-100px");
  const carbon = lab.demo.metrics[0];
  const shown = useCountUp(carbon[mode], inView);

  return (
    <div ref={ref} className="mt-14 grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-brand-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-brand-muted">{lab.demo.quantity.toLocaleString("en-GB")} bottles · estimated footprint</p>
            <p className="tabular mt-2 font-display text-4xl font-semibold text-brand-dark">
              {fmt(shown)} <span className="font-sans text-base font-medium text-brand-muted">kg CO₂e</span>
            </p>
          </div>
          <div className="inline-flex rounded-md border border-brand-line p-0.5 text-xs" role="radiogroup" aria-label="Scenario">
            {(["original", "optimized"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cx("rounded px-3 py-1.5 font-medium transition-colors", mode === m ? "bg-brand-dark text-white" : "text-brand-muted hover:text-brand-ink")}>
                {m === "original" ? "Original" : "Optimised"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6">
          <StageBars lab={lab} mode={mode} />
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-brand-line pt-5 sm:grid-cols-4">
          {lab.demo.metrics.slice(1).map((m) => (
            <div key={m.key}>
              <dt className="text-[11px] uppercase tracking-wider text-brand-muted">{m.label.replace(" consumption", "").replace("Manufacturing ", "")}</dt>
              <dd className="tabular mt-1 text-sm font-semibold text-brand-ink">
                {fmt(m[mode])} <span className="text-xs font-normal text-brand-muted">{pretty(m.unit)}</span>
              </dd>
              <dd className={cx("tabular text-xs", mode === "optimized" && m.change_pct && m.change_pct < -0.5 ? "text-brand-green" : "text-brand-muted")}>
                {mode === "optimized" ? (m.change_pct && Math.abs(m.change_pct) >= 0.5 ? `${m.change_pct < 0 ? "−" : "+"}${Math.abs(m.change_pct).toFixed(0)}%` : "no change") : " "}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-brand-muted">Not everything moves: these changes do not reduce manufacturing scrap, and the platform says so.</p>
      </div>

      <div className="rounded-xl border border-brand-line bg-white p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-muted">What the engine recommended · carbon change per alternative</p>
        <ul className="mt-3 divide-y divide-brand-line">
          {lab.demo.recommendations.map((rec) => (
            <RecRow key={rec.id} rec={rec} detailed />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ========================================================= Material face-off */
export function MaterialFaceoff({ lab }: { lab: LabData }) {
  const [a, setA] = useState("aluminium");
  const [b, setB] = useState("recycled_aluminium");
  const first = lab.materials.find((m) => m.id === a) ?? lab.materials[0];
  const second = lab.materials.find((m) => m.id === b) ?? lab.materials[1];
  const rows = [
    { key: "emission_factor" as const, label: "Carbon", unit: "kg CO₂e per kg" },
    { key: "embodied_energy" as const, label: "Embodied energy", unit: "MJ per kg" },
    { key: "water" as const, label: "Water", unit: "litres per kg" },
  ];
  const picker = (value: string, set: (v: string) => void, label: string, color: string) => (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-brand-muted">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
        {label}
      </span>
      <select className="input" value={value} onChange={(e) => set(e.target.value)}>
        {lab.materials.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="mt-14 grid gap-8 rounded-xl border border-brand-line bg-white p-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:p-8">
      <div className="space-y-5">
        {picker(a, setA, "Material A", "#064E3B")}
        {picker(b, setB, "Material B", "#10B981")}
        <div className="space-y-3 border-t border-brand-line pt-5 text-sm text-brand-muted">
          <p>
            <span className="font-medium text-brand-ink">{first.name}.</span> {first.notes}
          </p>
          <p>
            <span className="font-medium text-brand-ink">{second.name}.</span> {second.notes}
          </p>
        </div>
      </div>
      <div className="space-y-6">
        {rows.map((row) => {
          const max = Math.max(first[row.key], second[row.key]) || 1;
          const diff = first[row.key] ? ((second[row.key] - first[row.key]) / first[row.key]) * 100 : 0;
          return (
            <div key={row.key}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-brand-ink">
                  {row.label} <span className="font-normal text-brand-muted">· {row.unit}</span>
                </p>
                <p className={cx("tabular text-xs font-medium", Math.abs(diff) < 0.5 ? "text-brand-muted" : diff < 0 ? "text-brand-green" : "text-red-600")}>
                  B is {Math.abs(diff) < 0.5 ? "the same" : `${Math.abs(diff).toFixed(0)}% ${diff < 0 ? "lower" : "higher"}`}
                </p>
              </div>
              {[
                [first, "#064E3B"] as const,
                [second, "#10B981"] as const,
              ].map(([m, color], i) => (
                <div key={i} className="mb-1.5 grid grid-cols-[1fr_4.5rem] items-center gap-3">
                  <span className="h-3 overflow-hidden rounded-sm bg-brand-paper">
                    <motion.span className="block h-full rounded-sm" style={{ background: color }} initial={false} animate={{ width: `${Math.max((m[row.key] / max) * 100, 1)}%` }} transition={{ duration: 0.5, ease: EASE }} />
                  </span>
                  <span className="tabular text-right text-sm font-medium text-brand-ink">{fmt(m[row.key])}</span>
                </div>
              ))}
            </div>
          );
        })}
        <p className="border-t border-brand-line pt-4 text-xs leading-relaxed text-brand-muted">
          Illustrative factors from the platform's material library. Per kilogram is not per product: in the story at the top of this page, a glass bottle produces far more dots than PET because it needs eleven times the material.
        </p>
      </div>
    </div>
  );
}

/* ============================================================ Closing visual */
/**
 * Echo of the hero: a field of dots, most of which fade away as the section
 * scrolls in. The share that remains is the optimised bottle's footprint
 * relative to the original, taken from the engine.
 */
export function ClosingVisual({ lab }: { lab: LabData }) {
  const [ref, inView] = useInView<HTMLDivElement>("-120px");
  const carbon = lab.demo.metrics[0];
  const keep = carbon.original ? carbon.optimized / carbon.original : 1;
  const dots = useMemo(() => {
    let state = 11;
    const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
    return Array.from({ length: 420 }, () => ({ x: random() * 1200, y: random() * 520, r: 1.4 + random() * 2.2, order: random(), lime: random() > 0.4 }));
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.r}
            fill={d.lime ? "#BEF264" : "#10B981"}
            opacity={inView && d.order > keep ? 0.04 : 0.5}
            style={{ transition: `opacity 1.4s ease ${d.order * 1.2}s` }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#064E3B_0%,_#064E3BE6_35%,_transparent_75%)]" />
    </div>
  );
}
