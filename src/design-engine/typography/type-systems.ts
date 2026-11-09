/**
 * Typography systems per style. Each role lists font candidates in preference order; the JSX
 * layer uses the first installed font and reports a warning when it falls back. The final
 * candidates are fonts that ship with Windows so a result is always produced.
 */
export type FontWeight = "thin" | "light" | "regular" | "medium" | "semibold" | "bold" | "extrabold" | "black";

export interface FontRole { fonts: string[]; weight?: FontWeight; tracking?: number }

export interface TypeSystem {
  heading: FontRole;
  body: FontRole;
  accent: FontRole;
  /** Modular scale ratio for headline/sub/body sizes. */
  scale: number;
  headingCaps: boolean;
}

const SERIF_FALLBACK = ["Georgia", "TimesNewRomanPSMT", "Times New Roman"];
const SANS_FALLBACK = ["Segoe UI", "ArialMT", "Arial"];

export const TYPE_SYSTEMS: Record<string, TypeSystem> = {
  minimalist: { heading: { fonts: ["Helvetica Neue", "Inter", ...SANS_FALLBACK], weight: "light", tracking: 50 }, body: { fonts: ["Inter", ...SANS_FALLBACK], weight: "regular" }, accent: { fonts: ["Inter", ...SANS_FALLBACK], weight: "medium", tracking: 200 }, scale: 1.618, headingCaps: false },
  luxury: { heading: { fonts: ["Didot", "Bodoni 72", "Playfair Display", "Bodoni MT", ...SERIF_FALLBACK], weight: "regular", tracking: 150 }, body: { fonts: ["Montserrat", "Gill Sans MT", ...SANS_FALLBACK], weight: "light", tracking: 40 }, accent: { fonts: ["Montserrat", ...SANS_FALLBACK], weight: "regular", tracking: 400 }, scale: 1.618, headingCaps: true },
  corporate: { heading: { fonts: ["Source Sans Pro", "Myriad Pro", ...SANS_FALLBACK], weight: "bold" }, body: { fonts: ["Source Sans Pro", "Myriad Pro", ...SANS_FALLBACK], weight: "regular" }, accent: { fonts: ["Source Sans Pro", ...SANS_FALLBACK], weight: "medium", tracking: 100 }, scale: 1.333, headingCaps: false },
  editorial: { heading: { fonts: ["Playfair Display", "Minion Pro", ...SERIF_FALLBACK], weight: "bold" }, body: { fonts: ["Minion Pro", ...SERIF_FALLBACK], weight: "regular" }, accent: { fonts: ["Franklin Gothic Medium", ...SANS_FALLBACK], weight: "medium", tracking: 150 }, scale: 1.5, headingCaps: false },
  modern: { heading: { fonts: ["Inter", "Montserrat", ...SANS_FALLBACK], weight: "bold", tracking: -10 }, body: { fonts: ["Inter", ...SANS_FALLBACK], weight: "regular" }, accent: { fonts: ["Inter", ...SANS_FALLBACK], weight: "semibold", tracking: 120 }, scale: 1.5, headingCaps: false },
  retro: { heading: { fonts: ["Cooper Black", "Bauhaus 93", "Rockwell Extra Bold", "Impact", ...SANS_FALLBACK], weight: "bold" }, body: { fonts: ["Rockwell", ...SERIF_FALLBACK], weight: "regular" }, accent: { fonts: ["Rockwell", ...SERIF_FALLBACK], weight: "bold", tracking: 100 }, scale: 1.5, headingCaps: true },
  swiss: { heading: { fonts: ["Helvetica Neue", "Helvetica", "Akzidenz-Grotesk", ...SANS_FALLBACK], weight: "bold", tracking: -20 }, body: { fonts: ["Helvetica Neue", "Helvetica", ...SANS_FALLBACK], weight: "regular" }, accent: { fonts: ["Helvetica Neue", ...SANS_FALLBACK], weight: "bold" }, scale: 1.618, headingCaps: false },
  brutalist: { heading: { fonts: ["Arial Black", "Impact", ...SANS_FALLBACK], weight: "black", tracking: -30 }, body: { fonts: ["Courier New", "Consolas", ...SANS_FALLBACK], weight: "regular" }, accent: { fonts: ["Courier New", "Consolas"], weight: "bold" }, scale: 2, headingCaps: true },
  geometric: { heading: { fonts: ["Futura PT", "Futura", "Century Gothic", ...SANS_FALLBACK], weight: "bold", tracking: 40 }, body: { fonts: ["Century Gothic", ...SANS_FALLBACK], weight: "regular" }, accent: { fonts: ["Century Gothic", ...SANS_FALLBACK], weight: "bold", tracking: 200 }, scale: 1.5, headingCaps: true },
  organic: { heading: { fonts: ["Cormorant Garamond", "Garamond", ...SERIF_FALLBACK], weight: "medium" }, body: { fonts: ["Lato", "Calibri", ...SANS_FALLBACK], weight: "regular" }, accent: { fonts: ["Lato", "Calibri", ...SANS_FALLBACK], weight: "regular", tracking: 150 }, scale: 1.414, headingCaps: false },
  playful: { heading: { fonts: ["Poppins", "Comic Sans MS", "Segoe Print", ...SANS_FALLBACK], weight: "black" }, body: { fonts: ["Poppins", "Nunito", ...SANS_FALLBACK], weight: "regular" }, accent: { fonts: ["Poppins", ...SANS_FALLBACK], weight: "bold" }, scale: 1.5, headingCaps: false },
  futuristic: { heading: { fonts: ["Orbitron", "Eurostile", "Bahnschrift", ...SANS_FALLBACK], weight: "bold", tracking: 200 }, body: { fonts: ["Bahnschrift", "Segoe UI", ...SANS_FALLBACK], weight: "light" }, accent: { fonts: ["Bahnschrift", ...SANS_FALLBACK], weight: "regular", tracking: 400 }, scale: 1.618, headingCaps: true },
  vintage: { heading: { fonts: ["Baskerville", "Baskerville Old Face", "Book Antiqua", ...SERIF_FALLBACK], weight: "bold", tracking: 80 }, body: { fonts: ["Book Antiqua", ...SERIF_FALLBACK], weight: "regular" }, accent: { fonts: ["Copperplate Gothic Bold", "Copperplate", ...SERIF_FALLBACK], weight: "regular", tracking: 200 }, scale: 1.5, headingCaps: true },
  wireframe: { heading: { fonts: ["Inter", ...SANS_FALLBACK], weight: "bold" }, body: { fonts: ["Inter", ...SANS_FALLBACK], weight: "regular" }, accent: { fonts: ["Inter", ...SANS_FALLBACK], weight: "medium" }, scale: 1.25, headingCaps: false },
  contemporary: { heading: { fonts: ["DM Serif Display", "Playfair Display", ...SERIF_FALLBACK], weight: "regular" }, body: { fonts: ["DM Sans", "Inter", ...SANS_FALLBACK], weight: "regular" }, accent: { fonts: ["DM Sans", ...SANS_FALLBACK], weight: "medium", tracking: 150 }, scale: 1.5, headingCaps: false },
};

/** Type sizes (points) derived from a base size and modular scale. */
export function typeScale(basePt: number, ratio: number): { display: number; h1: number; h2: number; h3: number; body: number; caption: number } {
  const r = (n: number) => Math.round(basePt * ratio ** n * 10) / 10;
  return { display: r(4), h1: r(3), h2: r(2), h3: r(1), body: basePt, caption: Math.max(6, Math.round((basePt / ratio) * 10) / 10) };
}
