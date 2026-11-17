/** Chart colours, kept apart from the chart library so light pages can use them without loading it. */

/** One colour per life-cycle stage, used consistently in every chart and in the PDF. */
export const STAGE_COLORS: Record<string, string> = {
  materials: "#064E3B",
  manufacturing: "#10B981",
  packaging: "#D97706",
  transport: "#84CC16",
  end_of_life: "#64748B",
};
export const SERIES = ["#064E3B", "#10B981", "#D97706", "#84CC16", "#64748B", "#0E7490", "#A16207", "#94A3B8"];
export const ORIGINAL_COLOR = "#94A3B8";
export const OPTIMIZED_COLOR = "#10B981";
