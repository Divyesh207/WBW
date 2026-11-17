import { BrandIcon } from "./BrandIcon";

/**
 * Official Waste Before Waste lock-ups.
 *
 * Every dimension is derived from one number (the symbol size) using the ratios
 * of the identity, so the logo scales as a unit and its proportions never change:
 *
 *   horizontal  symbol 52 : gap 18 : wordmark 22px, tracking 0.14em
 *   stacked     symbol 176 : gap 40 : wordmark 40px, tracking 0.16em
 *               tagline 15px Inter 500, tracking 0.22em, gap 16
 *
 * Wordmark: Sora SemiBold 600, #064E3B on light / #F8FAF7 on dark.
 * Clear space of a quarter of the symbol is reserved on every side.
 */
interface BrandLogoProps {
  layout?: "horizontal" | "stacked";
  /** "light" = for light backgrounds, "dark" = for dark backgrounds. */
  theme?: "light" | "dark";
  /** Symbol size in px; everything else follows. */
  size?: number;
  tagline?: boolean;
  className?: string;
}

const WORDMARK = "WASTE BEFORE WASTE";

export function BrandLogo({ layout = "horizontal", theme = "light", size, tagline = false, className }: BrandLogoProps) {
  const dark = theme === "dark";
  const wordColor = dark ? "#F8FAF7" : "#064E3B";
  const variant = dark ? "reversed" : "color";

  if (layout === "stacked") {
    const s = size ?? 96;
    const k = s / 176;
    return (
      <div
        role="img"
        aria-label="Waste Before Waste — Think Before You Manufacture."
        className={className}
        style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 40 * k, padding: s / 4 }}
      >
        <BrandIcon size={s} variant={variant} decorative />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * k }} aria-hidden>
          <span
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 600,
              fontSize: 40 * k,
              letterSpacing: "0.16em",
              marginRight: "-0.16em",
              lineHeight: 1,
              color: wordColor,
              whiteSpace: "nowrap",
            }}
          >
            {WORDMARK}
          </span>
          {tagline && (
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                fontSize: Math.max(15 * k, 8),
                letterSpacing: "0.22em",
                marginRight: "-0.22em",
                lineHeight: 1,
                textTransform: "uppercase",
                color: dark ? "#F8FAF7" : "#166534",
                whiteSpace: "nowrap",
              }}
            >
              Think Before You Manufacture.
            </span>
          )}
        </div>
      </div>
    );
  }

  const s = size ?? 32;
  const k = s / 52;
  return (
    <span
      role="img"
      aria-label="Waste Before Waste"
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 18 * k, whiteSpace: "nowrap" }}
    >
      <BrandIcon size={s} variant={variant} decorative />
      <span
        aria-hidden
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 600,
          fontSize: 22 * k,
          letterSpacing: "0.14em",
          lineHeight: 1,
          color: wordColor,
        }}
      >
        {WORDMARK}
      </span>
    </span>
  );
}
