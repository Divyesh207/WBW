import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Calculator, Factory, FileDown, Gauge, Layers, Lightbulb, Menu, Recycle, Scale, X } from "lucide-react";
import { BrandIcon } from "../components/brand/BrandIcon";
import { BrandLogo } from "../components/brand/BrandLogo";
import { ButtonLink } from "../components/ui";
import { useLab } from "../features/landing/lab";
import { HeroStory } from "../features/landing/HeroStory";
import { ClosingVisual, HowItWorks, ImpactSection, MaterialFaceoff, ProblemCurve } from "../features/landing/Sections";

const LINKS = [
  ["Home", "#home"],
  ["How It Works", "#how-it-works"],
  ["Features", "#features"],
  ["Impact", "#impact"],
  ["About", "#about"],
];

const PROBLEMS = [
  ["Damage is designed in", "Environmental damage begins at product design, long before a factory is involved."],
  ["Materials are chosen blind", "Unsustainable material selection creates waste that a different specification would have avoided."],
  ["Production consumes more than it shows", "Manufacturing draws energy, water and raw materials whose cost never appears on a bill of materials."],
  ["The tools are out of reach", "Many businesses have no accessible way to check environmental consequences before production."],
];

const SOLUTIONS = [
  ["Pre-manufacturing environmental assessment", "Estimate carbon, energy, water, material use and waste from a specification, before anything is made."],
  ["Sustainable material recommendations", "See lower-impact materials for the same part, with the trade-offs stated rather than hidden."],
  ["Manufacturing optimization", "Flag energy use and scrap rates that sit above typical values for the chosen process."],
  ["Product lifecycle evaluation", "Follow the product from raw material through packaging and transport to end-of-life."],
  ["Environmental impact comparison", "Put the original and the optimised product side by side, recalculated on the same basis."],
];

const FEATURES = [
  [Calculator, "Environmental Impact Calculator", "Stage-by-stage estimates from configurable factor datasets."],
  [Scale, "Material Comparison Engine", "Compare library materials on carbon, energy and water per kilogram."],
  [Gauge, "Carbon Footprint Estimator", "Per-unit and whole-batch footprint with an uncertainty range."],
  [Lightbulb, "Sustainable Alternative Recommendations", "Every suggestion is recalculated, never assumed to be better."],
  [Factory, "Manufacturing Impact Analysis", "Energy intensity and scrap checked against process benchmarks."],
  [Layers, "Product Lifecycle Assessment", "Materials, production, packaging, transport and end-of-life in one boundary."],
  [Recycle, "Waste Prevention Insights", "Find scrap and packaging you can design out before production."],
  [FileDown, "Downloadable Environmental Reports", "Professional PDF, JSON export and print-ready reports."],
] as const;

const SDGS = [
  ["12", "Responsible Consumption and Production", "Primary goal", "Moves responsibility upstream: material and process choices are tested for waste and resource use before production, supporting waste prevention at source."],
  ["9", "Industry, Innovation and Infrastructure", "Secondary goal", "Gives small manufacturers and designers an accessible decision tool for cleaner, more resource-efficient production."],
  ["13", "Climate Action", "Secondary goal", "Makes the estimated carbon footprint visible at the point where it is cheapest to reduce: the specification."],
];

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.45, delay, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}

function SectionHeading({ eyebrow, title, lead, dark }: { eyebrow: string; title: string; lead?: string; dark?: boolean }) {
  return (
    <Reveal className="max-w-2xl">
      <p className={dark ? "text-xs font-medium uppercase tracking-[0.18em] text-brand-emerald" : "eyebrow"}>{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl ${dark ? "text-brand-paper" : "text-brand-dark"}`}>{title}</h2>
      {lead && <p className={`mt-4 text-base leading-relaxed ${dark ? "text-brand-paper/70" : "text-brand-muted"}`}>{lead}</p>}
    </Reveal>
  );
}

export default function Landing() {
  const [menu, setMenu] = useState(false);
  const { lab, live } = useLab();

  useEffect(() => {
    document.title = "Waste Before Waste — Think Before You Manufacture";
  }, []);

  return (
    <div className="bg-brand-paper">
      {/* ------------------------------------------------------------ A. Nav */}
      <header className="sticky top-0 z-40 border-b border-brand-line bg-brand-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-6 px-5 sm:px-8">
          <a href="#home" aria-label="Waste Before Waste — home" className="shrink-0">
            <BrandLogo size={32} />
          </a>
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {LINKS.map(([label, href]) => (
              <a key={href} href={href} className="text-sm text-brand-ink/80 transition-colors hover:text-brand-green">
                {label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            <ButtonLink to="/signin" variant="ghost">
              Sign In
            </ButtonLink>
            <ButtonLink to="/app/new">Get Started</ButtonLink>
          </div>
          <button type="button" className="rounded-md p-2 text-brand-ink hover:bg-brand-ink/5 lg:hidden" onClick={() => setMenu((m) => !m)} aria-label="Toggle menu" aria-expanded={menu}>
            {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menu && (
          <nav className="border-t border-brand-line bg-brand-paper px-5 py-4 lg:hidden" aria-label="Mobile">
            {LINKS.map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMenu(false)} className="block py-2.5 text-sm text-brand-ink">
                {label}
              </a>
            ))}
            <div className="mt-3 flex gap-2">
              <ButtonLink to="/signin" variant="secondary" className="flex-1">
                Sign In
              </ButtonLink>
              <ButtonLink to="/app/new" className="flex-1">
                Get Started
              </ButtonLink>
            </div>
          </nav>
        )}
      </header>

      <main>
        {/* ------------------------------------ B. Hero: the 3D scroll story */}
        <HeroStory lab={lab} live={live} />

        {/* ------------------------------------------------------ C. Problem */}
        <section className="bg-brand-dark">
          <div className="mx-auto max-w-page px-5 py-24 sm:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <SectionHeading dark eyebrow="The problem" title="By the time waste becomes visible, the damage has already begun." lead="Waste management starts at the bin. The decisions that created the waste were made months earlier, on a drawing, when changing them was still cheap." />
              <Reveal delay={0.1}>
                <ProblemCurve />
              </Reveal>
            </div>
            <div className="mt-14 grid gap-px overflow-hidden rounded-lg bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
              {PROBLEMS.map(([title, body], i) => (
                <Reveal key={title} delay={i * 0.05} className="bg-brand-dark p-6">
                  <p className="tabular font-display text-sm font-semibold text-brand-emerald">0{i + 1}</p>
                  <h3 className="mt-3 text-base font-semibold text-brand-paper">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-paper/70">{body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- D. Solution */}
        <section className="mx-auto max-w-page px-5 py-24 sm:px-8">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <SectionHeading eyebrow="The solution" title="Prevention, moved to where it is cheapest: the specification." lead="Waste Before Waste turns a product specification into an environmental screening, then shows what would change if you chose differently." />
              <blockquote className="mt-8 border-l-2 border-brand-emerald pl-5 text-base italic text-brand-dark">“Don't manage waste after it exists. Prevent it before it is manufactured.”</blockquote>
            </div>
            <ol className="divide-y divide-brand-line border-y border-brand-line">
              {SOLUTIONS.map(([title, body], i) => (
                <Reveal key={title} delay={i * 0.04}>
                  <li className="grid grid-cols-[3rem_1fr] gap-4 py-6">
                    <span className="tabular font-display text-2xl font-semibold text-brand-line">{i + 1}</span>
                    <div>
                      <h3 className="text-base font-semibold text-brand-dark">{title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-brand-muted">{body}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------- E. How it works */}
        <section id="how-it-works" className="scroll-mt-16 border-y border-brand-line bg-white">
          <div className="mx-auto max-w-page px-5 py-24 sm:px-8">
            <SectionHeading eyebrow="How it works" title="From specification to a better decision in five steps." lead="Step through a real assessment of the demo bottle. Select any stage, or let it play." />
            <HowItWorks lab={lab} />
          </div>
        </section>

        {/* ---------------------------------- F. Impact and alternatives (engine) */}
        <section id="impact" className="scroll-mt-16 mx-auto max-w-page px-5 py-24 sm:px-8">
          <SectionHeading eyebrow="Environmental impact · sustainable alternatives" title="See the footprint, then see what changes it." lead="Switch between the original bottle and the optimised one. Alternatives that help are applied; the one with a trade-off is flagged and left out." />
          <ImpactSection lab={lab} />
        </section>

        {/* ------------------------------------------ G. Material comparison */}
        <section className="border-y border-brand-line bg-brand-paper">
          <div className="mx-auto max-w-page px-5 py-24 sm:px-8">
            <SectionHeading eyebrow="Material comparison" title="Put any two materials head to head." lead="Fourteen materials from the platform's library, compared per kilogram on three indicators." />
            <MaterialFaceoff lab={lab} />
          </div>
        </section>

        {/* ----------------------------------------------------- H. Features */}
        <section id="features" className="scroll-mt-16 mx-auto max-w-page px-5 py-24 sm:px-8">
          <SectionHeading eyebrow="Features" title="Everything needed to question a design before it is built." />
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-brand-line bg-brand-line sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(([Icon, title, body], i) => (
              <Reveal key={title} delay={(i % 4) * 0.04} className="bg-white p-6">
                <Icon className="h-5 w-5 text-brand-green" strokeWidth={1.75} aria-hidden />
                <h3 className="mt-4 text-sm font-semibold text-brand-dark">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">{body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- I. SDG */}
        <section id="sdg" className="scroll-mt-16 border-t border-brand-line bg-white">
          <div className="mx-auto max-w-page px-5 py-24 sm:px-8">
            <SectionHeading eyebrow="SDG alignment" title="Built around the UN Sustainable Development Goals." lead="The project contributes to one primary and two secondary goals." />
            <div className="mt-14 grid gap-10 md:grid-cols-3">
              {SDGS.map(([number, title, tag, body], i) => (
                <Reveal key={number} delay={i * 0.06} className="border-t-2 border-brand-dark pt-6">
                  <div className="flex items-baseline justify-between">
                    <p className="font-display text-5xl font-semibold tracking-tight text-brand-dark">
                      <span className="mr-2 align-middle text-xs font-medium uppercase tracking-[0.18em] text-brand-muted">SDG</span>
                      {number}
                    </p>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${i === 0 ? "bg-brand-lime text-brand-dark" : "border border-brand-line text-brand-muted"}`}>{tag}</span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-brand-dark">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-muted">{body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- J. Final CTA */}
        <section className="relative overflow-hidden bg-brand-dark">
          <ClosingVisual lab={lab} />
          <Reveal className="relative mx-auto flex max-w-page flex-col items-center px-5 py-28 text-center sm:px-8">
            <BrandIcon size={56} variant="reversed" decorative />
            <h2 className="mt-8 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-brand-paper sm:text-5xl">Make Better Products Before Making Products.</h2>
            <p className="mt-5 max-w-xl text-base text-brand-paper/75">Understand the environmental cost of your product before it becomes a product.</p>
            <ButtonLink to="/app/new" size="lg" variant="inverse" className="mt-9">
              Start Your Environmental Assessment <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          </Reveal>
        </section>
      </main>

      {/* ---------------------------------------------------------- K. Footer */}
      <footer id="about" className="scroll-mt-16 border-t border-brand-line bg-brand-paper">
        <div className="mx-auto grid max-w-page gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <BrandLogo size={36} />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-brand-muted">
              Waste Before Waste is a pre-manufacturing environmental impact assessment and sustainable product optimization platform. It helps manufacturers, designers and entrepreneurs see the environmental consequences of a product while it can still be changed.
            </p>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-brand-muted">{lab.disclaimer}</p>
          </div>
          <div>
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-brand-ink">Navigate</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {LINKS.map(([label, href]) => (
                <li key={href}>
                  <a href={href} className="text-brand-muted hover:text-brand-green">
                    {label}
                  </a>
                </li>
              ))}
              <li>
                <Link to="/app" className="text-brand-muted hover:text-brand-green">
                  Open the dashboard
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-brand-ink">SDG alignment</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-brand-muted">
              {SDGS.map(([number, title]) => (
                <li key={number}>
                  <span className="font-medium text-brand-ink">SDG {number}</span> — {title}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-brand-line">
          <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-brand-muted sm:px-8">
            <p>© {new Date().getFullYear()} Waste Before Waste. An academic sustainability project.</p>
            <p>Think Before You Manufacture.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
