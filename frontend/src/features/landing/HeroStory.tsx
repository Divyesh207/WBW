import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { ButtonLink } from "../../components/ui";
import { cx, fmt } from "../../utils/format";
import { supportsWebGL, useInView, usePrefersReducedMotion, type LabData } from "./lab";
import { useCountUp } from "./Sections";

// Three.js is downloaded separately, only for browsers that can show the scene.
const Story3D = lazy(() => import("./Story3D"));

/** One dot in the cloud stands for this many grams of CO2e. */
const GRAMS_PER_DOT = 0.1;
const CHAPTERS = ["Blueprint", "Footprint", "Alternative", "Decide"];
const STARTS = [0, 0.24, 0.52, 0.82];

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Flat stand-in for the 3D scene (no WebGL): the same idea with one dot per gram. */
function DotFallback({ grams }: { grams: number }) {
  const dots = useMemo(() => {
    let state = 7;
    const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
    return Array.from({ length: 700 }, (_, i) => {
      const r = 46 + 250 * Math.sqrt(i / 700) + random() * 10;
      const a = random() * Math.PI * 2;
      return [300 + Math.cos(a) * r, 230 + Math.sin(a) * r * 0.62, 1.6 + random() * 1.8];
    });
  }, []);
  const shown = Math.round(grams);
  return (
    <svg viewBox="0 0 600 460" className="h-full w-full" role="img" aria-label={`About ${shown} dots, one per gram of CO2e`}>
      {dots.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={i % 3 ? "#BEF264" : "#10B981"} opacity={i < shown ? 0.85 : 0} style={{ transition: "opacity 0.5s" }} />
      ))}
      <g transform="translate(300 230)" fill="#F8FAF7">
        <rect x={-9} y={-70} width={18} height={12} rx={2} />
        <path d="M-9 -56 h18 v8 c0 9 17 13 17 30 v72 a8 8 0 0 1 -8 8 h-36 a8 8 0 0 1 -8 -8 v-72 c0 -17 17 -21 17 -30 z" fillOpacity={0.25} stroke="#F8FAF7" strokeOpacity={0.8} strokeWidth={1.5} />
      </g>
    </svg>
  );
}

/**
 * Hero: a scroll-driven story. A product is only a drawing; it becomes real; its
 * footprint appears as a cloud of dots; a different decision changes the cloud.
 * With reduced motion or no WebGL it collapses to a normal, static hero.
 */
export function HeroStory({ lab, live }: { lab: LabData; live: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [webgl] = useState(supportsWebGL);
  const story = webgl && !reduced; // otherwise: no pinned scrolling, everything visible at once
  const section = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [chapter, setChapter] = useState(0);
  const [choice, setChoice] = useState(lab.options[1].id);
  const [compact, setCompact] = useState(() => window.innerWidth < 1024);
  const [viewRef, inView] = useInView<HTMLDivElement>("200px");

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!story) {
      progress.current = 1;
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = section.current;
      if (!el) return;
      const travel = el.offsetHeight - window.innerHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / travel)) : 0;
      progress.current = p;
      let next = 0;
      STARTS.forEach((start, i) => p >= start && (next = i));
      setChapter(next);
    };
    const onScroll = () => frame || (frame = requestAnimationFrame(measure));
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [story]);

  const source = lab.sources[0].id;
  const baseline = lab.options[0];
  // Until the visitor reaches "Alternative", the story is about the original decision.
  const option = story && chapter < 2 ? baseline : (lab.options.find((o) => o.id === choice) ?? baseline);
  const grams = option.results[source].carbon_kg * 1000;
  const baseGrams = baseline.results[source].carbon_kg * 1000;
  const maxGrams = Math.max(...lab.options.map((o) => o.results[source].carbon_kg * 1000));
  const change = ((grams - baseGrams) / baseGrams) * 100;
  const shownGrams = useCountUp(grams, true);

  const scrollToChapter = (i: number) => {
    const el = section.current;
    if (!el) return;
    const travel = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: el.offsetTop + (STARTS[i] + 0.04) * travel, behavior: "smooth" });
  };

  const fallback = <DotFallback grams={grams} />;
  const scene = webgl ? (
    <SceneBoundary fallback={fallback}>
      <Suspense fallback={null}>
        <Story3D progress={progress} count={grams / GRAMS_PER_DOT} maxCount={maxGrams / GRAMS_PER_DOT} look={option.look} animate={story && inView} compact={compact} />
      </Suspense>
    </SceneBoundary>
  ) : (
    fallback
  );

  const number = (
    <p className="tabular font-display text-6xl font-semibold leading-none text-brand-paper sm:text-7xl">
      {fmt(shownGrams)}
      <span className="ml-2 text-xl font-medium text-brand-paper/60 sm:text-2xl">g CO₂e</span>
    </p>
  );

  const picker = (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Bottle material">
      {lab.options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === option.id}
          onClick={() => setChoice(o.id)}
          className={cx(
            "rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-offset-brand-dark",
            o.id === option.id ? "border-brand-lime bg-brand-lime text-brand-dark" : "border-white/25 text-brand-paper/85 hover:border-white/60 hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  const verdict =
    option.id === baseline.id ? (
      <span className="text-brand-paper/60">The starting point: {option.mass_g} g of virgin PET.</span>
    ) : (
      <>
        <span className={change < 0 ? "font-semibold text-brand-lime" : "font-semibold text-rose-300"}>
          {Math.abs(change) >= 100 ? `${fmt(grams / baseGrams, 2)}× the dots` : `${Math.abs(change).toFixed(0)}% ${change < 0 ? "fewer" : "more"} dots`}
        </span>{" "}
        <span className="text-brand-paper/75">than virgin PET. {option.note}</span>
      </>
    );

  const intro = (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-emerald">Think Before You Manufacture.</p>
      <h1 className="mt-5 text-5xl font-semibold leading-[1.04] tracking-tight text-brand-paper sm:text-6xl xl:text-7xl">
        Stop Waste Before <span className="text-brand-lime">It Starts.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-brand-paper/75">
        Understand the environmental impact of your product before manufacturing. Evaluate materials, compare alternatives, and make smarter, more sustainable production decisions.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink to="/app/new" size="lg" variant="inverse">
          Analyze Your Product <ArrowRight className="h-4 w-4" aria-hidden />
        </ButtonLink>
        <ButtonLink to="#how-it-works" size="lg" variant="ghost" className="border border-white/25 !text-brand-paper hover:!bg-white/10">
          Explore How It Works
        </ButtonLink>
      </div>
    </>
  );

  const note = (
    <p className="text-xs leading-relaxed text-brand-paper/45">
      One dot = {GRAMS_PER_DOT} g CO₂e per 500 ml bottle. Model estimate from illustrative factors (about ±{option.results[source].uncertainty_pct}%), not a measurement
      {live ? "" : " · offline snapshot of the engine"}.
    </p>
  );

  /* ---------- Static hero: reduced motion or no WebGL ---------- */
  if (!story) {
    return (
      <section id="home" className="scroll-mt-16 bg-brand-dark">
        <div className="mx-auto grid max-w-page items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:py-24">
          <div>{intro}</div>
          <div>
            <div className="h-72 sm:h-96">{scene}</div>
            <div className="mt-4 space-y-4">
              {number}
              <p className="text-base leading-relaxed">{verdict}</p>
              {picker}
              {note}
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ---------- Scroll story ---------- */
  const panels: ReactNode[] = [
    intro,
    <>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-emerald">The footprint, made visible</p>
      <div className="mt-5">{number}</div>
      <p className="mt-6 max-w-md text-lg leading-relaxed text-brand-paper/80">
        Before a single bottle is filled, making it from virgin PET already causes an estimated {fmt(baseGrams)} g of CO₂e. Every dot is a tenth of a gram.
      </p>
      <div className="mt-4 lg:hidden">{note}</div>
    </>,
    <>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-emerald">Change the decision, not the waste</p>
      <div className="mt-5">{number}</div>
      <p className="mt-5 min-h-[3.5rem] max-w-md text-base leading-relaxed">{verdict}</p>
      <div className="mt-5 max-w-md">{picker}</div>
      <div className="mt-4 lg:hidden">{note}</div>
    </>,
    <>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-emerald">Analyze before manufacturing</p>
      <h2 className="mt-5 max-w-lg text-4xl font-semibold leading-tight tracking-tight text-brand-paper sm:text-5xl">That was one decision about one bottle.</h2>
      <p className="mt-5 max-w-md text-lg leading-relaxed text-brand-paper/80">Your product has dozens. See which ones matter while they can still be changed.</p>
      <div className="mt-8">
        <ButtonLink to="/app/new" size="lg" variant="inverse">
          Assess your own product <ArrowRight className="h-4 w-4" aria-hidden />
        </ButtonLink>
      </div>
    </>,
  ];

  return (
    <section id="home" ref={section} className="relative bg-brand-dark" style={{ height: "360vh" }}>
      <div ref={viewRef} className="sticky top-0 h-screen overflow-hidden" style={{ height: "100svh" }}>
        <div className="absolute inset-0 top-16">{scene}</div>
        {/* keeps copy readable where it overlaps the scene */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/70 to-transparent lg:bg-gradient-to-r lg:via-brand-dark/55" aria-hidden />

        <div className="relative mx-auto flex h-full max-w-page items-end px-5 pb-16 pt-24 sm:px-8 lg:items-center lg:pb-0">
          <div className="relative w-full lg:max-w-[36rem]">
            {panels.map((panel, i) => (
              <div
                key={i}
                aria-hidden={chapter !== i}
                className={cx(
                  "transition-all duration-500 ease-out",
                  i > 0 && "absolute inset-x-0 bottom-0 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2",
                  chapter === i ? "visible opacity-100" : "pointer-events-none invisible translate-y-3 opacity-0",
                )}
              >
                {panel}
              </div>
            ))}
          </div>
        </div>

        <nav className="absolute right-5 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-4 sm:right-8 md:flex" aria-label="Story chapters">
          {CHAPTERS.map((label, i) => (
            <button key={label} type="button" onClick={() => scrollToChapter(i)} aria-current={chapter === i ? "step" : undefined} className="group flex items-center gap-3 focus-visible:ring-offset-brand-dark">
              <span className={cx("text-xs transition-colors", chapter === i ? "font-medium text-brand-paper" : "text-brand-paper/40 group-hover:text-brand-paper/80")}>{label}</span>
              <span className={cx("h-px transition-all", chapter === i ? "w-8 bg-brand-lime" : "w-4 bg-brand-paper/40")} />
            </button>
          ))}
        </nav>

        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-page items-end justify-between gap-6 px-5 pb-4 sm:px-8">
          <div className={cx("hidden max-w-md transition-opacity duration-500 lg:block", chapter === 0 ? "opacity-0" : "opacity-100")}>{note}</div>
          <p className={cx("flex shrink-0 items-center gap-2 text-xs text-brand-paper/60 transition-opacity duration-500", chapter === 0 ? "opacity-100" : "opacity-0")}>
            <ArrowDown className="h-3.5 w-3.5 animate-bounce" aria-hidden /> Scroll to see what this bottle costs
          </p>
        </div>
      </div>
    </section>
  );
}
