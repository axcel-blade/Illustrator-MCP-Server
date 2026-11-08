import { el, heading, imageOrPlaceholder, STANDARD_LAYERS, type TemplateDefinition } from "./helpers.js";

/*
 * Professional template library. Every template is proportional to its size (overrides keep the
 * composition), uses palette roles and typography roles only, and yields editable Illustrator
 * objects: rectangles, ellipses, paths and live text. Font sizes are in points; positions are in
 * the template's document units.
 */

const poster: TemplateDefinition = {
  id: "poster", name: "Poster", category: "poster", description: "Hero image, dominant headline, supporting copy and footer band.",
  defaultSize: { width: 210, height: 297, units: "mm" },
  build(ctx, { width: w, height: h, units }) {
    const m = w * 0.08;
    return {
      document: { name: ctx.copy.headline, width: w, height: h, units },
      background: { type: "solid", color: "palette.background" },
      layers: STANDARD_LAYERS,
      grid: { columns: 12, margin: m, gutter: w * 0.02 },
      elements: [
        el.circle("Decorative Circle", "Graphics", w * 0.66, h * 0.36, w * 0.3, "palette.surface", { role: "decoration" }),
        ...imageOrPlaceholder(ctx, "Hero Image", w * 0.3, h * 0.17, w * 0.4, h * 0.38),
        el.text("Eyebrow", "Typography", ctx.copy.brand.toUpperCase(), m, m, 9, { fontRole: "accent", color: "palette.secondary", role: "eyebrow" }),
        el.text("Headline", "Typography", heading(ctx, ctx.copy.headline), w / 2, h * 0.62, 48, { fontRole: "heading", textAlign: "center", color: "palette.text", role: "headline" }),
        el.text("Subheadline", "Typography", ctx.copy.subheadline, w / 2, h * 0.72, 14, { fontRole: "body", textAlign: "center", color: "palette.secondary", role: "subheadline" }),
        el.line("Divider", "Graphics", w / 2 - w * 0.08, h * 0.79, w / 2 + w * 0.08, h * 0.79, "palette.accent", 1),
        el.text("Body", "Typography", ctx.copy.body, w * 0.2, h * 0.82, 10, { width: w * 0.6, height: h * 0.07, textAlign: "center", color: "palette.text", role: "body" }),
        el.rect("Footer Band", "Graphics", 0, h * 0.93, w, h * 0.07, "palette.primary", { role: "footer" }),
        el.text("Footer CTA", "Typography", ctx.copy.cta.toUpperCase(), w / 2, h * 0.952, 10, { fontRole: "accent", textAlign: "center", color: "palette.background", role: "cta" }),
      ],
    };
  },
};

const flyer: TemplateDefinition = {
  id: "flyer", name: "Flyer", category: "flyer", description: "Split layout with a color block, headline, bulleted offers and CTA button.",
  defaultSize: { width: 148, height: 210, units: "mm" },
  build(ctx, { width: w, height: h, units }) {
    const m = w * 0.08;
    const items = ctx.copy.items.slice(0, 4);
    return {
      document: { name: ctx.copy.headline, width: w, height: h, units },
      background: { type: "solid", color: "palette.background" },
      layers: STANDARD_LAYERS,
      elements: [
        el.rect("Color Block", "Graphics", 0, 0, w, h * 0.42, "palette.primary", { role: "decoration" }),
        ...imageOrPlaceholder(ctx, "Feature Image", w * 0.5, h * 0.08, w * 0.42, h * 0.28),
        el.text("Headline", "Typography", heading(ctx, ctx.copy.headline), m, h * 0.12, 34, { fontRole: "heading", width: w * 0.4, height: h * 0.22, color: "palette.background", role: "headline" }),
        el.text("Subheadline", "Typography", ctx.copy.subheadline, m, h * 0.47, 14, { fontRole: "heading", color: "palette.text", role: "subheadline" }),
        ...items.map((it, i) => el.text(`Item ${i + 1}`, "Typography", `•  ${it}`, m, h * (0.55 + i * 0.065), 11, { color: "palette.text", role: "list-item" })),
        el.rect("CTA Button", "Graphics", m, h * 0.83, w * 0.45, h * 0.07, "palette.accent", { cornerRadius: h * 0.035, role: "cta" }),
        el.text("CTA Label", "Typography", ctx.copy.cta.toUpperCase(), m + w * 0.225, h * 0.852, 10, { fontRole: "accent", textAlign: "center", color: "palette.background", role: "cta" }),
        el.text("Contact", "Typography", ctx.copy.contact, w - m, h * 0.95, 8, { textAlign: "right", color: "palette.muted", role: "caption" }),
      ],
    };
  },
};

const logo: TemplateDefinition = {
  id: "logo", name: "Minimalist Logo", category: "logo", description: "Geometric monogram mark with wordmark and tagline lockup.",
  defaultSize: { width: 1000, height: 1000, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    const initial = ctx.copy.brand.trim().charAt(0).toUpperCase() || "A";
    const cx = w / 2, cy = h * 0.4, r = w * 0.17;
    const geometric = ["geometric", "modern", "swiss", "futuristic", "brutalist"].includes(ctx.style);
    return {
      document: { name: `${ctx.copy.brand} Logo`, width: w, height: h, units },
      background: { type: "solid", color: "palette.background" },
      layers: [{ name: "Logo" }, { name: "Background", locked: true }],
      elements: [
        geometric ? el.poly("Mark Shape", "Logo", cx, cy, r, 6, "palette.primary", { role: "mark" }) : el.circle("Mark Shape", "Logo", cx, cy, r, "palette.primary", { role: "mark" }),
        el.circle("Mark Accent", "Logo", cx + r * 0.62, cy - r * 0.62, r * 0.16, "palette.accent", { role: "mark" }),
        el.text("Monogram", "Logo", initial, cx, cy - r * 0.55, 150, { fontRole: "heading", textAlign: "center", color: "palette.background", role: "mark" }),
        el.text("Wordmark", "Logo", heading(ctx, ctx.copy.brand), cx, h * 0.66, 64, { fontRole: "heading", textAlign: "center", color: "palette.text", role: "headline" }),
        el.text("Tagline", "Logo", ctx.copy.tagline.toUpperCase(), cx, h * 0.76, 20, { fontRole: "accent", textAlign: "center", color: "palette.muted", tracking: 300, role: "subheadline" }),
      ],
    };
  },
};

const businessCard: TemplateDefinition = {
  id: "business-card", name: "Business Card", category: "business-card", description: "Front side: brand bar, name, title and contact details.",
  defaultSize: { width: 85, height: 55, units: "mm" },
  build(ctx, { width: w, height: h, units }) {
    const m = w * 0.08;
    return {
      document: { name: `${ctx.copy.brand} Business Card`, width: w, height: h, units, colorMode: "CMYK" },
      background: { type: "solid", color: "palette.background" },
      layers: STANDARD_LAYERS,
      elements: [
        el.rect("Brand Bar", "Graphics", 0, 0, w * 0.04, h, "palette.primary", { role: "decoration" }),
        el.text("Brand", "Typography", heading(ctx, ctx.copy.brand), m, m, 11, { fontRole: "heading", color: "palette.primary", role: "eyebrow" }),
        el.text("Name", "Typography", ctx.copy.headline, m, h * 0.45, 13, { fontRole: "heading", color: "palette.text", role: "headline" }),
        el.text("Title", "Typography", ctx.copy.subheadline, m, h * 0.58, 8, { fontRole: "accent", color: "palette.secondary", role: "subheadline" }),
        el.text("Contact", "Typography", ctx.copy.contact, m, h * 0.74, 6.5, { width: w * 0.8, height: h * 0.2, color: "palette.text", leading: 9, role: "caption" }),
        el.circle("Accent Dot", "Graphics", w - m, m + 2, 2, "palette.accent", { role: "decoration" }),
      ],
    };
  },
};

const social: TemplateDefinition = {
  id: "social-media", name: "Social Media Post", category: "social-media", description: "Square post with bold headline, shape accents and handle.",
  defaultSize: { width: 1080, height: 1080, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    const m = w * 0.08;
    return {
      document: { name: ctx.copy.headline, width: w, height: h, units },
      background: { type: "gradient", gradient: { type: "linear", angle: 135, stops: [{ color: "palette.background", position: 0 }, { color: "palette.surface", position: 100 }] } },
      layers: STANDARD_LAYERS,
      elements: [
        el.circle("Blob Large", "Graphics", w * 0.85, h * 0.18, w * 0.28, "palette.accent", { opacity: 85, role: "decoration" }),
        el.circle("Blob Small", "Graphics", w * 0.12, h * 0.9, w * 0.12, "palette.secondary", { opacity: 70, role: "decoration" }),
        el.text("Eyebrow", "Typography", ctx.copy.tagline.toUpperCase(), m, h * 0.3, 28, { fontRole: "accent", color: "palette.secondary", role: "eyebrow" }),
        el.text("Headline", "Typography", heading(ctx, ctx.copy.headline), m, h * 0.36, 96, { fontRole: "heading", width: w * 0.8, height: h * 0.32, color: "palette.text", leading: 100, role: "headline" }),
        el.text("Subheadline", "Typography", ctx.copy.subheadline, m, h * 0.72, 34, { width: w * 0.7, height: h * 0.1, color: "palette.text", role: "subheadline" }),
        el.text("Handle", "Typography", `@${ctx.copy.brand.replace(/\s+/g, "").toLowerCase()}`, w - m, h - m - 30, 26, { textAlign: "right", fontRole: "accent", color: "palette.primary", role: "caption" }),
      ],
    };
  },
};

const brandIdentity: TemplateDefinition = {
  id: "brand-identity", name: "Brand Identity Board", category: "brand-identity", description: "Logo lockup, color swatches with hex labels and typography specimen.",
  defaultSize: { width: 1920, height: 1080, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    const m = w * 0.05;
    const roles = ["primary", "secondary", "accent", "surface", "text"] as const;
    const sw = (w * 0.5 - m) / roles.length;
    return {
      document: { name: `${ctx.copy.brand} Brand Identity`, width: w, height: h, units },
      background: { type: "solid", color: "palette.background" },
      layers: STANDARD_LAYERS,
      elements: [
        el.text("Board Title", "Typography", "BRAND IDENTITY", m, m, 18, { fontRole: "accent", color: "palette.muted", tracking: 300, role: "eyebrow" }),
        el.circle("Logo Mark", "Graphics", m + h * 0.16, h * 0.4, h * 0.14, "palette.primary", { role: "mark" }),
        el.text("Logo Wordmark", "Typography", heading(ctx, ctx.copy.brand), m + h * 0.36, h * 0.34, 80, { fontRole: "heading", color: "palette.text", role: "headline" }),
        el.text("Logo Tagline", "Typography", ctx.copy.tagline, m + h * 0.36, h * 0.45, 26, { color: "palette.secondary", role: "subheadline" }),
        ...roles.flatMap((r, i) => [
          el.rect(`Swatch ${r}`, "Graphics", m + i * sw, h * 0.66, sw - 16, h * 0.18, `palette.${r}`, { stroke: { color: "palette.muted", width: 0.5 }, role: "swatch" }),
          el.text(`Swatch ${r} Label`, "Typography", `${r.toUpperCase()}\n${ctx.palette.colors[r]}`, m + i * sw, h * 0.86, 14, { color: "palette.text", role: "caption" }),
        ]),
        el.text("Type Heading Specimen", "Typography", `Aa  ${ctx.type.heading.fonts[0]}`, w * 0.58, h * 0.62, 56, { fontRole: "heading", color: "palette.text", role: "specimen" }),
        el.text("Type Body Specimen", "Typography", `Aa  ${ctx.type.body.fonts[0]} — The quick brown fox jumps over the lazy dog.`, w * 0.58, h * 0.78, 20, { width: w * 0.37, height: h * 0.12, color: "palette.text", role: "specimen" }),
      ],
    };
  },
};

const brandGuidelines: TemplateDefinition = {
  id: "brand-guidelines", name: "Brand Guidelines Page", category: "brand-guidelines", description: "Guideline spread: section header, clear-space diagram and usage rules.",
  defaultSize: { width: 297, height: 210, units: "mm" },
  build(ctx, { width: w, height: h, units }) {
    const m = w * 0.06;
    const rules = ctx.copy.items.length ? ctx.copy.items : ["Keep clear space equal to the mark height", "Never stretch or rotate the logo", "Use approved palette colors only"];
    return {
      document: { name: `${ctx.copy.brand} Guidelines`, width: w, height: h, units },
      background: { type: "solid", color: "palette.background" },
      layers: STANDARD_LAYERS,
      elements: [
        el.rect("Section Band", "Graphics", 0, 0, w * 0.32, h, "palette.primary", { role: "decoration" }),
        el.text("Section Number", "Typography", "01", m, m, 60, { fontRole: "heading", color: "palette.background", role: "headline" }),
        el.text("Section Title", "Typography", heading(ctx, "Logo Usage"), m, h * 0.4, 24, { fontRole: "heading", color: "palette.background", role: "subheadline" }),
        el.rect("Clear Space Box", "Graphics", w * 0.45, h * 0.18, w * 0.3, h * 0.4, "none", { stroke: { color: "palette.muted", width: 0.5, dashes: [2, 2] }, role: "diagram" }),
        el.circle("Logo Sample", "Graphics", w * 0.6, h * 0.38, h * 0.1, "palette.primary", { role: "mark" }),
        ...rules.slice(0, 4).map((r, i) => el.text(`Rule ${i + 1}`, "Typography", `${i + 1}. ${r}`, w * 0.45, h * (0.68 + i * 0.07), 10, { color: "palette.text", role: "list-item" })),
      ],
    };
  },
};

const brochure: TemplateDefinition = {
  id: "brochure", name: "Tri-fold Brochure (outside)", category: "brochure", description: "Three panels on US Letter landscape: inside flap, back, and cover.",
  defaultSize: { width: 279.4, height: 215.9, units: "mm" },
  build(ctx, { width: w, height: h, units }) {
    const p = w / 3, m = p * 0.1;
    return {
      document: { name: `${ctx.copy.brand} Brochure`, width: w, height: h, units, colorMode: "CMYK" },
      background: { type: "solid", color: "palette.background" },
      layers: [{ name: "Typography" }, { name: "Graphics" }, { name: "Images" }, { name: "Folds" }, { name: "Background", locked: true }],
      elements: [
        el.line("Fold 1", "Folds", p, 0, p, h, "palette.muted", 0.25),
        el.line("Fold 2", "Folds", p * 2, 0, p * 2, h, "palette.muted", 0.25),
        el.text("Flap Heading", "Typography", heading(ctx, ctx.copy.subheadline), m, m * 2, 16, { fontRole: "heading", width: p - 2 * m, height: h * 0.15, color: "palette.primary", role: "subheadline" }),
        el.text("Flap Body", "Typography", ctx.copy.body, m, h * 0.25, 9, { width: p - 2 * m, height: h * 0.6, color: "palette.text", role: "body" }),
        el.text("Back Contact", "Typography", ctx.copy.contact, p + p / 2, h * 0.8, 9, { textAlign: "center", color: "palette.text", role: "caption" }),
        el.rect("Cover Panel", "Graphics", p * 2, 0, p, h, "palette.primary", { role: "decoration" }),
        ...imageOrPlaceholder(ctx, "Cover Image", p * 2 + m, h * 0.12, p - 2 * m, h * 0.42),
        el.text("Cover Title", "Typography", heading(ctx, ctx.copy.headline), p * 2 + m, h * 0.6, 26, { fontRole: "heading", width: p - 2 * m, height: h * 0.2, color: "palette.background", role: "headline" }),
        el.text("Cover Brand", "Typography", ctx.copy.brand.toUpperCase(), p * 2 + m, h * 0.9, 9, { fontRole: "accent", color: "palette.background", role: "eyebrow" }),
      ],
    };
  },
};

const packaging: TemplateDefinition = {
  id: "packaging", name: "Packaging Front Panel + Dieline", category: "packaging", description: "Flat box layout: four side panels with front art, plus top/bottom flaps.",
  defaultSize: { width: 300, height: 220, units: "mm" },
  build(ctx, { width: w, height: h, units }) {
    const pw = w / 4, ph = h * 0.6, top = h * 0.2;
    const panels = ["Side A", "Front", "Side B", "Back"];
    return {
      document: { name: `${ctx.copy.brand} Packaging`, width: w, height: h, units, colorMode: "CMYK" },
      background: { type: "none" },
      layers: [{ name: "Typography" }, { name: "Artwork" }, { name: "Dieline" }],
      elements: [
        ...panels.map((p, i) => el.rect(`Panel ${p}`, "Artwork", i * pw, top, pw, ph, i === 1 ? "palette.primary" : "palette.surface", { role: "panel" })),
        el.rect("Top Flap", "Artwork", pw, 0, pw, top, "palette.surface", { role: "panel" }),
        el.rect("Bottom Flap", "Artwork", pw, top + ph, pw, top, "palette.surface", { role: "panel" }),
        el.rect("Dieline Outline", "Dieline", 0, top, w, ph, "none", { stroke: { color: "#EC008C", width: 0.25 }, role: "dieline" }),
        el.text("Front Brand", "Typography", heading(ctx, ctx.copy.brand), pw * 1.5, top + ph * 0.18, 22, { fontRole: "heading", textAlign: "center", color: "palette.background", role: "headline" }),
        el.circle("Front Emblem", "Artwork", pw * 1.5, top + ph * 0.5, pw * 0.25, "palette.accent", { role: "mark" }),
        el.text("Front Product", "Typography", ctx.copy.headline, pw * 1.5, top + ph * 0.75, 12, { textAlign: "center", color: "palette.background", role: "subheadline" }),
        el.text("Back Copy", "Typography", ctx.copy.body, pw * 3 + pw * 0.1, top + ph * 0.1, 7, { width: pw * 0.8, height: ph * 0.6, color: "palette.text", role: "body" }),
      ],
    };
  },
};

const productLabel: TemplateDefinition = {
  id: "product-label", name: "Product Label", category: "product-label", description: "Rounded label with badge, product name, descriptor and net weight.",
  defaultSize: { width: 90, height: 120, units: "mm" },
  build(ctx, { width: w, height: h, units }) {
    return {
      document: { name: `${ctx.copy.headline} Label`, width: w, height: h, units, colorMode: "CMYK" },
      background: { type: "none" },
      layers: STANDARD_LAYERS,
      elements: [
        el.rect("Label Body", "Graphics", w * 0.04, h * 0.04, w * 0.92, h * 0.92, "palette.background", { cornerRadius: w * 0.08, stroke: { color: "palette.primary", width: 1 }, role: "panel" }),
        el.rect("Inner Border", "Graphics", w * 0.09, h * 0.08, w * 0.82, h * 0.84, "none", { cornerRadius: w * 0.05, stroke: { color: "palette.accent", width: 0.5 }, role: "decoration" }),
        el.star("Badge", "Graphics", w / 2, h * 0.24, w * 0.14, w * 0.11, 16, "palette.accent"),
        el.text("Brand", "Typography", ctx.copy.brand.toUpperCase(), w / 2, h * 0.43, 9, { fontRole: "accent", textAlign: "center", color: "palette.secondary", role: "eyebrow" }),
        el.text("Product Name", "Typography", heading(ctx, ctx.copy.headline), w / 2, h * 0.5, 22, { fontRole: "heading", textAlign: "center", color: "palette.primary", role: "headline" }),
        el.text("Descriptor", "Typography", ctx.copy.subheadline, w / 2, h * 0.64, 9, { textAlign: "center", color: "palette.text", role: "subheadline" }),
        el.text("Net Weight", "Typography", ctx.copy.cta, w / 2, h * 0.84, 7, { textAlign: "center", color: "palette.muted", role: "caption" }),
      ],
    };
  },
};

const infographic: TemplateDefinition = {
  id: "infographic", name: "Infographic", category: "infographic", description: "Title, numbered stat blocks with bars, and source footnote.",
  defaultSize: { width: 1080, height: 1920, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    const m = w * 0.08;
    const items = ctx.copy.items.length ? ctx.copy.items : ["Step one", "Step two", "Step three", "Step four"];
    const rowH = (h * 0.62) / items.length;
    return {
      document: { name: ctx.copy.headline, width: w, height: h, units },
      background: { type: "solid", color: "palette.background" },
      layers: STANDARD_LAYERS,
      elements: [
        el.text("Headline", "Typography", heading(ctx, ctx.copy.headline), m, m, 72, { fontRole: "heading", width: w - 2 * m, height: h * 0.12, color: "palette.text", role: "headline" }),
        el.text("Subheadline", "Typography", ctx.copy.subheadline, m, h * 0.17, 30, { color: "palette.secondary", role: "subheadline" }),
        ...items.slice(0, 6).flatMap((it, i) => {
          const y = h * 0.26 + i * rowH;
          const frac = 0.35 + ((items.length - i) / items.length) * 0.5;
          return [
            el.circle(`Stat ${i + 1} Badge`, "Graphics", m + 50, y + 50, 50, i % 2 ? "palette.accent" : "palette.primary", { role: "marker" }),
            el.text(`Stat ${i + 1} Number`, "Typography", String(i + 1).padStart(2, "0"), m + 50, y + 28, 36, { fontRole: "heading", textAlign: "center", color: "palette.background", role: "marker" }),
            el.text(`Stat ${i + 1} Label`, "Typography", it, m + 130, y + 10, 32, { color: "palette.text", role: "list-item" }),
            el.rect(`Stat ${i + 1} Bar`, "Graphics", m + 130, y + 62, (w - 2 * m - 130) * frac, 22, i % 2 ? "palette.accent" : "palette.primary", { cornerRadius: 11, role: "chart" }),
          ];
        }),
        el.text("Source", "Typography", ctx.copy.contact, m, h - m, 20, { color: "palette.muted", role: "caption" }),
      ],
    };
  },
};

const editorial: TemplateDefinition = {
  id: "editorial", name: "Editorial Layout", category: "editorial", description: "Magazine page: kicker, large serif title, deck, two-column body and pull quote.",
  defaultSize: { width: 210, height: 297, units: "mm" },
  build(ctx, { width: w, height: h, units }) {
    const m = w * 0.09, col = (w - 2 * m - 6) / 2;
    return {
      document: { name: ctx.copy.headline, width: w, height: h, units },
      background: { type: "solid", color: "palette.background" },
      layers: STANDARD_LAYERS,
      grid: { columns: 2, margin: m, gutter: 6 },
      elements: [
        el.text("Kicker", "Typography", ctx.copy.tagline.toUpperCase(), m, m, 8, { fontRole: "accent", color: "palette.accent", tracking: 200, role: "eyebrow" }),
        el.text("Title", "Typography", ctx.copy.headline, m, m + 8, 44, { fontRole: "heading", width: w - 2 * m, height: h * 0.2, color: "palette.text", leading: 46, role: "headline" }),
        el.text("Deck", "Typography", ctx.copy.subheadline, m, h * 0.33, 13, { width: w - 2 * m, height: h * 0.06, color: "palette.secondary", role: "subheadline" }),
        el.line("Rule", "Graphics", m, h * 0.4, w - m, h * 0.4, "palette.text", 0.5),
        el.text("Body Column 1", "Typography", ctx.copy.body, m, h * 0.43, 9, { width: col, height: h * 0.47, color: "palette.text", leading: 13, textAlign: "justify", role: "body" }),
        ...imageOrPlaceholder(ctx, "Column Image", m + col + 6, h * 0.43, col, h * 0.22),
        el.text("Pull Quote", "Typography", `“${ctx.copy.tagline}”`, m + col + 6, h * 0.69, 16, { fontRole: "heading", width: col, height: h * 0.14, color: "palette.accent", role: "quote" }),
        el.text("Folio", "Typography", `${ctx.copy.brand} — 01`, w - m, h - m * 0.6, 7, { textAlign: "right", color: "palette.muted", role: "caption" }),
      ],
    };
  },
};

const iconSet: TemplateDefinition = {
  id: "icon-set", name: "Icon Set", category: "icon-set", description: "Grid of consistent geometric icons on a shared keyline.",
  defaultSize: { width: 1200, height: 600, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    const labels = ctx.copy.items.length ? ctx.copy.items.slice(0, 8) : ["Home", "Search", "Profile", "Settings", "Mail", "Star", "Cart", "Info"];
    const cols = 4, cell = Math.min(w / cols, (h * 0.85) / 2), r = cell * 0.22;
    const shapes = [
      (n: string, cx: number, cy: number) => [el.poly(`${n} Roof`, "Icons", cx, cy - r * 0.2, r, 3, "palette.primary"), el.rect(`${n} Base`, "Icons", cx - r * 0.6, cy, r * 1.2, r * 0.8, "palette.primary")],
      (n: string, cx: number, cy: number) => [el.circle(`${n} Lens`, "Icons", cx - r * 0.15, cy - r * 0.15, r * 0.6, "none", { stroke: { color: "palette.primary", width: r * 0.18 } }), el.line(`${n} Handle`, "Icons", cx + r * 0.3, cy + r * 0.3, cx + r * 0.8, cy + r * 0.8, "palette.primary", r * 0.2)],
      (n: string, cx: number, cy: number) => [el.circle(`${n} Head`, "Icons", cx, cy - r * 0.35, r * 0.4, "palette.primary"), { type: "ellipse", name: `${n} Body`, layer: "Icons", x: cx - r * 0.75, y: cy + r * 0.15, width: r * 1.5, height: r * 0.9, fill: "palette.primary", stroke: "none" }],
      (n: string, cx: number, cy: number) => [el.star(`${n} Gear`, "Icons", cx, cy, r, r * 0.78, 8, "palette.primary"), el.circle(`${n} Hub`, "Icons", cx, cy, r * 0.35, "palette.background")],
      (n: string, cx: number, cy: number) => [el.rect(`${n} Envelope`, "Icons", cx - r, cy - r * 0.65, r * 2, r * 1.3, "none", { stroke: { color: "palette.primary", width: r * 0.15 } }), { type: "path", name: `${n} Flap`, layer: "Icons", points: [{ x: cx - r, y: cy - r * 0.65 }, { x: cx, y: cy + r * 0.1 }, { x: cx + r, y: cy - r * 0.65 }], closed: false, fill: "none", stroke: { color: "palette.primary", width: r * 0.15 } }],
      (n: string, cx: number, cy: number) => [el.star(`${n} Shape`, "Icons", cx, cy, r, r * 0.45, 5, "palette.accent")],
      (n: string, cx: number, cy: number) => [el.rect(`${n} Basket`, "Icons", cx - r * 0.8, cy - r * 0.4, r * 1.6, r * 0.9, "palette.primary", { cornerRadius: r * 0.1 }), el.circle(`${n} Wheel L`, "Icons", cx - r * 0.45, cy + r * 0.75, r * 0.18, "palette.primary"), el.circle(`${n} Wheel R`, "Icons", cx + r * 0.45, cy + r * 0.75, r * 0.18, "palette.primary")],
      (n: string, cx: number, cy: number) => [el.circle(`${n} Ring`, "Icons", cx, cy, r, "palette.primary"), el.rect(`${n} Stem`, "Icons", cx - r * 0.1, cy - r * 0.15, r * 0.2, r * 0.65, "palette.background"), el.circle(`${n} Dot`, "Icons", cx, cy - r * 0.45, r * 0.12, "palette.background")],
    ];
    return {
      document: { name: `${ctx.copy.brand} Icon Set`, width: w, height: h, units },
      background: { type: "solid", color: "palette.background" },
      layers: [{ name: "Labels" }, { name: "Icons" }, { name: "Keylines" }, { name: "Background", locked: true }],
      elements: labels.flatMap((label, i) => {
        const cx = (w / cols) * (i % cols) + w / cols / 2;
        const cy = h * 0.08 + cell * Math.floor(i / cols) + cell * 0.42;
        return [
          el.rect(`${label} Keyline`, "Keylines", cx - cell * 0.38, cy - cell * 0.38, cell * 0.76, cell * 0.76, "palette.surface", { cornerRadius: cell * 0.12, role: "keyline" }),
          ...(shapes[i % shapes.length]!(label, cx, cy) as ReturnType<typeof el.rect>[]),
          el.text(`${label} Label`, "Labels", label, cx, cy + cell * 0.42, 14, { textAlign: "center", color: "palette.muted", role: "caption" }),
        ];
      }),
    };
  },
};

const illustration: TemplateDefinition = {
  id: "illustration", name: "Vector Landscape Illustration", category: "illustration", description: "Layered flat landscape: sky gradient, sun, mountains, hills and trees.",
  defaultSize: { width: 1600, height: 1000, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    const mountain = (name: string, x0: number, peakX: number, peakY: number, x1: number, fill: string) =>
      ({ type: "path", name, layer: "Landscape", points: [{ x: x0, y: h * 0.75 }, { x: peakX, y: peakY }, { x: x1, y: h * 0.75 }], closed: true, fill, stroke: "none" }) as ReturnType<typeof el.rect>;
    const hill = (name: string, y: number, fill: string) =>
      ({ type: "path", name, layer: "Foreground", closed: true, fill, stroke: "none", points: [
        { x: 0, y: h }, { x: 0, y, out: [w * 0.25, y - h * 0.08] }, { x: w * 0.5, y: y + h * 0.02, in: [w * 0.35, y + h * 0.06], out: [w * 0.7, y - h * 0.04] }, { x: w, y: y - h * 0.03, in: [w * 0.85, y - h * 0.06] }, { x: w, y: h } ] }) as ReturnType<typeof el.rect>;
    return {
      document: { name: ctx.copy.headline || "Illustration", width: w, height: h, units },
      background: { type: "gradient", gradient: { type: "linear", angle: -90, stops: [{ color: "palette.surface", position: 0 }, { color: "palette.background", position: 100 }] } },
      layers: [{ name: "Foreground" }, { name: "Landscape" }, { name: "Sky" }, { name: "Background", locked: true }],
      elements: [
        el.circle("Sun", "Sky", w * 0.72, h * 0.28, h * 0.12, "palette.accent", { effects: [{ type: "outerGlow", radius: 30, opacity: 0.5 }] }),
        mountain("Mountain Back", w * 0.05, w * 0.35, h * 0.3, w * 0.7, "palette.secondary"),
        mountain("Mountain Front", w * 0.4, w * 0.62, h * 0.38, w * 0.95, "palette.primary"),
        hill("Hill Back", h * 0.72, "palette.secondary"),
        hill("Hill Front", h * 0.82, "palette.primary"),
        ...[0.15, 0.22, 0.85].flatMap((fx, i) => [
          el.rect(`Tree ${i + 1} Trunk`, "Foreground", w * fx - 6, h * 0.8, 12, h * 0.07, "palette.text"),
          el.poly(`Tree ${i + 1} Crown`, "Foreground", w * fx, h * 0.76, h * 0.07, 3, "palette.text"),
        ]),
      ],
    };
  },
};

const presentation: TemplateDefinition = {
  id: "presentation", name: "Presentation Slide", category: "presentation", description: "16:9 title slide with accent bar, title, subtitle and footer.",
  defaultSize: { width: 1920, height: 1080, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    const m = w * 0.07;
    return {
      document: { name: ctx.copy.headline, width: w, height: h, units },
      background: { type: "solid", color: "palette.background" },
      layers: STANDARD_LAYERS,
      elements: [
        el.rect("Accent Bar", "Graphics", m, h * 0.36, w * 0.06, 12, "palette.accent", { role: "decoration" }),
        el.text("Title", "Typography", heading(ctx, ctx.copy.headline), m, h * 0.4, 96, { fontRole: "heading", width: w * 0.6, height: h * 0.25, color: "palette.text", role: "headline" }),
        el.text("Subtitle", "Typography", ctx.copy.subheadline, m, h * 0.68, 36, { color: "palette.secondary", role: "subheadline" }),
        ...imageOrPlaceholder(ctx, "Slide Image", w * 0.7, 0, w * 0.3, h),
        el.text("Footer", "Typography", `${ctx.copy.brand}  |  ${ctx.copy.contact}`, m, h - m * 0.7, 18, { color: "palette.muted", role: "caption" }),
      ],
    };
  },
};

const printAd: TemplateDefinition = {
  id: "print-ad", name: "Print Advertisement", category: "print-ad", description: "Full-bleed image area, benefit headline, logo and legal line.",
  defaultSize: { width: 210, height: 297, units: "mm" },
  build(ctx, { width: w, height: h, units }) {
    const m = w * 0.07;
    return {
      document: { name: `${ctx.copy.brand} Ad`, width: w, height: h, units, colorMode: "CMYK" },
      background: { type: "solid", color: "palette.background" },
      layers: STANDARD_LAYERS,
      elements: [
        ...imageOrPlaceholder(ctx, "Ad Image", 0, 0, w, h * 0.6),
        el.text("Headline", "Typography", heading(ctx, ctx.copy.headline), m, h * 0.64, 36, { fontRole: "heading", width: w - 2 * m, height: h * 0.14, color: "palette.text", role: "headline" }),
        el.text("Body", "Typography", ctx.copy.body, m, h * 0.79, 10, { width: w * 0.55, height: h * 0.1, color: "palette.text", role: "body" }),
        el.circle("Logo Mark", "Graphics", w - m - 10, h * 0.85, 10, "palette.primary", { role: "mark" }),
        el.text("Logo Text", "Typography", ctx.copy.brand, w - m - 10, h * 0.885, 10, { fontRole: "heading", textAlign: "center", color: "palette.primary", role: "eyebrow" }),
        el.text("Legal", "Typography", ctx.copy.contact, m, h - m * 0.6, 6, { color: "palette.muted", role: "caption" }),
      ],
    };
  },
};

const menu: TemplateDefinition = {
  id: "restaurant-menu", name: "Restaurant Menu", category: "restaurant-menu", description: "Single page menu: masthead, sections with dotted price leaders.",
  defaultSize: { width: 215.9, height: 355.6, units: "mm" },
  build(ctx, { width: w, height: h, units }) {
    const m = w * 0.1;
    const dishes = ctx.copy.items.length ? ctx.copy.items : ["Burrata & heirloom tomato", "Charred octopus", "Wild mushroom risotto", "Braised short rib", "Lemon tart", "Dark chocolate mousse"];
    return {
      document: { name: `${ctx.copy.brand} Menu`, width: w, height: h, units, colorMode: "CMYK" },
      background: { type: "solid", color: "palette.background" },
      layers: STANDARD_LAYERS,
      elements: [
        el.text("Restaurant Name", "Typography", heading(ctx, ctx.copy.brand), w / 2, m, 40, { fontRole: "heading", textAlign: "center", color: "palette.primary", role: "headline" }),
        el.text("Menu Tagline", "Typography", ctx.copy.tagline.toUpperCase(), w / 2, m + 18, 9, { fontRole: "accent", textAlign: "center", color: "palette.secondary", tracking: 300, role: "subheadline" }),
        el.line("Masthead Rule", "Graphics", m, m + 28, w - m, m + 28, "palette.accent", 0.75),
        ...dishes.slice(0, 10).flatMap((d, i) => {
          const y = m + 42 + i * ((h - m * 2 - 50) / Math.max(dishes.length, 6));
          return [
            el.text(`Dish ${i + 1}`, "Typography", d, m, y, 12, { fontRole: "heading", color: "palette.text", role: "list-item" }),
            el.line(`Dish ${i + 1} Leader`, "Graphics", m + d.length * 2.4 + 4, y + 3.5, w - m - 14, y + 3.5, "palette.muted", 0.3),
            el.text(`Dish ${i + 1} Price`, "Typography", String(12 + i * 3), w - m, y, 12, { textAlign: "right", color: "palette.text", role: "price" }),
          ];
        }),
        el.text("Menu Footer", "Typography", ctx.copy.contact, w / 2, h - m * 0.7, 8, { textAlign: "center", color: "palette.muted", role: "caption" }),
      ],
    };
  },
};

const event: TemplateDefinition = {
  id: "event-graphic", name: "Event Graphic", category: "event-graphic", description: "Bold date block, event name, venue and registration CTA (landscape banner).",
  defaultSize: { width: 1920, height: 1080, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    const m = w * 0.06;
    return {
      document: { name: ctx.copy.headline, width: w, height: h, units },
      background: { type: "solid", color: "palette.primary" },
      layers: STANDARD_LAYERS,
      elements: [
        el.circle("Ring Large", "Graphics", w * 0.82, h * 0.5, h * 0.42, "none", { stroke: { color: "palette.accent", width: 24 }, role: "decoration" }),
        el.circle("Ring Small", "Graphics", w * 0.82, h * 0.5, h * 0.24, "palette.accent", { opacity: 80, role: "decoration" }),
        el.rect("Date Block", "Graphics", m, h * 0.14, 260, 120, "palette.accent", { role: "marker" }),
        el.text("Date", "Typography", ctx.copy.tagline, m + 130, h * 0.14 + 36, 40, { fontRole: "heading", textAlign: "center", color: "palette.primary", role: "eyebrow" }),
        el.text("Event Name", "Typography", heading(ctx, ctx.copy.headline), m, h * 0.36, 110, { fontRole: "heading", width: w * 0.58, height: h * 0.32, color: "palette.background", leading: 112, role: "headline" }),
        el.text("Venue", "Typography", ctx.copy.subheadline, m, h * 0.72, 36, { color: "palette.background", role: "subheadline" }),
        el.text("CTA", "Typography", ctx.copy.cta.toUpperCase(), m, h * 0.84, 30, { fontRole: "accent", color: "palette.accent", tracking: 200, role: "cta" }),
      ],
    };
  },
};

const catalogue: TemplateDefinition = {
  id: "product-catalogue", name: "Product Catalogue Page", category: "product-catalogue", description: "Header plus 2×3 product grid with image frames, names and prices.",
  defaultSize: { width: 210, height: 297, units: "mm" },
  build(ctx, { width: w, height: h, units }) {
    const m = w * 0.08, gap = 6, cols = 2, rows = 3;
    const cw = (w - 2 * m - gap) / cols, ch = (h * 0.78 - gap * (rows - 1)) / rows;
    const products = ctx.copy.items.length ? ctx.copy.items : ["Product One", "Product Two", "Product Three", "Product Four", "Product Five", "Product Six"];
    return {
      document: { name: `${ctx.copy.brand} Catalogue`, width: w, height: h, units, colorMode: "CMYK" },
      background: { type: "solid", color: "palette.background" },
      layers: STANDARD_LAYERS,
      elements: [
        el.text("Catalogue Title", "Typography", heading(ctx, ctx.copy.headline), m, m * 0.8, 26, { fontRole: "heading", color: "palette.text", role: "headline" }),
        el.text("Catalogue Brand", "Typography", ctx.copy.brand.toUpperCase(), w - m, m * 0.95, 8, { fontRole: "accent", textAlign: "right", color: "palette.muted", role: "eyebrow" }),
        ...products.slice(0, cols * rows).flatMap((p, i) => {
          const x = m + (i % cols) * (cw + gap), y = h * 0.16 + Math.floor(i / cols) * (ch + gap);
          return [
            el.rect(`Card ${i + 1}`, "Graphics", x, y, cw, ch, "palette.surface", { cornerRadius: 2, role: "card" }),
            el.rect(`Card ${i + 1} Image`, "Images", x + 4, y + 4, cw - 8, ch * 0.66, "palette.background", { role: "image-placeholder" }),
            el.text(`Card ${i + 1} Name`, "Typography", p, x + 4, y + ch * 0.74, 10, { fontRole: "heading", color: "palette.text", role: "list-item" }),
            el.text(`Card ${i + 1} Price`, "Typography", `$${(19 + i * 10).toFixed(2)}`, x + cw - 4, y + ch * 0.74, 10, { textAlign: "right", color: "palette.accent", role: "price" }),
          ];
        }),
      ],
    };
  },
};

const corporateIdentity: TemplateDefinition = {
  id: "corporate-identity", name: "Corporate Identity Sheet", category: "corporate-identity", description: "Stationery set on one artboard: letterhead, business card and envelope.",
  defaultSize: { width: 420, height: 297, units: "mm" },
  build(ctx, { width: w, height: h, units }) {
    return {
      document: { name: `${ctx.copy.brand} Stationery`, width: w, height: h, units },
      background: { type: "solid", color: "palette.surface" },
      layers: STANDARD_LAYERS,
      elements: [
        el.rect("Letterhead", "Graphics", 20, 20, 170, 240, "#FFFFFF", { effects: [{ type: "shadow", offsetX: 2, offsetY: 3, blur: 6, opacity: 0.25 }], role: "panel" }),
        el.rect("Letterhead Bar", "Graphics", 20, 20, 170, 6, "palette.primary"),
        el.text("Letterhead Brand", "Typography", heading(ctx, ctx.copy.brand), 32, 40, 16, { fontRole: "heading", color: "palette.primary", role: "headline" }),
        el.text("Letterhead Contact", "Typography", ctx.copy.contact, 32, 245, 7, { color: "palette.muted", role: "caption" }),
        el.rect("Card", "Graphics", 220, 30, 85, 55, "palette.primary", { effects: [{ type: "shadow", offsetX: 2, offsetY: 3, blur: 6, opacity: 0.25 }], role: "panel" }),
        el.text("Card Brand", "Typography", heading(ctx, ctx.copy.brand), 262.5, 52, 12, { fontRole: "heading", textAlign: "center", color: "palette.background", role: "eyebrow" }),
        el.rect("Envelope", "Graphics", 220, 120, 180, 100, "#FFFFFF", { effects: [{ type: "shadow", offsetX: 2, offsetY: 3, blur: 6, opacity: 0.25 }], role: "panel" }),
        el.circle("Envelope Mark", "Graphics", 238, 138, 8, "palette.accent"),
        el.text("Envelope Brand", "Typography", ctx.copy.brand, 252, 134, 9, { fontRole: "heading", color: "palette.text", role: "caption" }),
      ],
    };
  },
};

export const TEMPLATES: TemplateDefinition[] = [
  logo, corporateIdentity, brandIdentity, brandGuidelines, poster, flyer, brochure, businessCard, packaging, productLabel,
  social, infographic, editorial, iconSet, illustration, presentation, printAd, menu, event, catalogue,
];

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
