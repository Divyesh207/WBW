/**
 * Official Waste Before Waste symbol.
 *
 * Always rendered from the original SVG files in /assets/brand — the artwork is
 * never redrawn here. Width and height are always equal, so it cannot be
 * stretched; pick the variant that suits the background instead of recolouring.
 */
export type IconVariant = "color" | "reversed" | "black" | "white";

const ICONS: Record<IconVariant, string> = {
  color: "/assets/brand/wbw-icon.svg", // light backgrounds
  reversed: "/assets/brand/wbw-icon-reversed.svg", // dark backgrounds
  black: "/assets/brand/wbw-icon-black.svg",
  white: "/assets/brand/wbw-icon-white.svg",
};

const TILES = {
  dark: "/assets/brand/wbw-app-icon.svg",
  light: "/assets/brand/wbw-app-icon-light.svg",
};

interface BrandIconProps {
  size?: number;
  variant?: IconVariant;
  /** Use the official app-icon tile (symbol on a rounded square) instead of the bare symbol. */
  tile?: keyof typeof TILES;
  className?: string;
  /** Hide from assistive tech when the wordmark next to it already names the brand. */
  decorative?: boolean;
}

export function BrandIcon({ size = 32, variant = "color", tile, className, decorative }: BrandIconProps) {
  return (
    <img
      src={tile ? TILES[tile] : ICONS[variant]}
      width={size}
      height={size}
      alt={decorative ? "" : "Waste Before Waste"}
      aria-hidden={decorative || undefined}
      draggable={false}
      className={className}
      style={{ width: size, height: size, flexShrink: 0, display: "block" }}
    />
  );
}
