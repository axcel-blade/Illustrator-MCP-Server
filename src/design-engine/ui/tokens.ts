import { DesignTokensSchema, type DesignTokens } from "../../schemas/design-plan.js";

/**
 * Style-aware design tokens for UI work (px). The base scale follows an 8-point grid; styles
 * adjust corner radii and type sizes so components inherit the design language.
 */
const RADIUS_BY_STYLE: Record<string, Partial<DesignTokens["radius"]>> = {
  brutalist: { sm: 0, md: 0, lg: 0, xl: 0, full: 0 },
  swiss: { sm: 0, md: 2, lg: 4, xl: 6 },
  corporate: { sm: 4, md: 6, lg: 10, xl: 16 },
  luxury: { sm: 0, md: 2, lg: 4, xl: 8 },
  editorial: { sm: 0, md: 2, lg: 4, xl: 8 },
  playful: { sm: 8, md: 14, lg: 24, xl: 32 },
  organic: { sm: 8, md: 12, lg: 20, xl: 28 },
  wireframe: { sm: 2, md: 4, lg: 8, xl: 12 },
};

export function tokensFor(style: string, platform: "mobile" | "web" = "mobile"): DesignTokens {
  const base = DesignTokensSchema.parse({});
  const web = platform === "web";
  return {
    spacing: { ...base.spacing },
    radius: { ...base.radius, ...(RADIUS_BY_STYLE[style] ?? {}) } as DesignTokens["radius"],
    fontSize: web ? { ...base.fontSize, heading: 32, display: 56, hero: 72 } : { ...base.fontSize },
    controlHeight: web ? 44 : 52,
  };
}
