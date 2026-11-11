import type { DesignTokens } from "../../schemas/design-plan.js";
import { McpDesignError } from "../../utils/errors.js";
import { LayoutNodeSchema, type ComponentNode, type DimValue, type LayoutNode } from "./layout.js";

/*
 * UI component library. Each component is a function of props + design tokens that returns an
 * auto-layout tree; part names are prefixed with the instance name ("Sign In / Label") so every
 * generated object stays individually addressable for revisions, like Figma layers.
 * Colors use palette roles only, so a component re-themes with the plan's palette.
 */

type Raw = Record<string, unknown>;
type Props = Record<string, unknown>;

interface ComponentDef {
  description: string;
  props: Record<string, string>;
  build(name: string, p: Props, t: DesignTokens, size: { width?: DimValue; height?: DimValue }): Raw;
}

const str = (v: unknown, d: string) => (typeof v === "string" && v.length ? v : d);
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const list = (v: unknown, d: string[]) => (Array.isArray(v) && v.length ? v.map(String) : d);

const stack = (name: string, o: Raw, children: Raw[] = []): Raw => ({ type: "stack", name, ...o, children });
const text = (name: string, content: string, o: Raw = {}): Raw => ({ type: "text", name, content, ...o });
const SHADOW_SM = { type: "shadow", offsetX: 0, offsetY: 2, blur: 8, opacity: 0.12 };

function icon(name: string, size: number, color: string, shape: "circle" | "square" = "square"): Raw {
  return shape === "circle"
    ? { type: "circle", name, radius: size / 2, fill: "none", stroke: { color, width: 1.75 }, role: "icon" }
    : { type: "rect", name, width: size, height: size, radius: size * 0.28, fill: "none", stroke: { color, width: 1.75 }, role: "icon" };
}

function initialsOf(s: string): string {
  return s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "A";
}

export const COMPONENTS: Record<string, ComponentDef> = {
  button: {
    description: "Button with label. Variants: primary, secondary, outline, ghost. Sizes: sm, md, lg.",
    props: { label: "string", variant: "primary|secondary|outline|ghost", size: "sm|md|lg", radius: "token|number" },
    build(name, p, t, size) {
      const variant = str(p.variant, "primary");
      const h = { sm: t.controlHeight - 12, md: t.controlHeight, lg: t.controlHeight + 8 }[str(p.size, "md") as "sm"] ?? t.controlHeight;
      const paint: Record<string, [string, string, unknown]> = {
        primary: ["palette.primary", "palette.onPrimary", "none"],
        secondary: ["palette.surface", "palette.text", "none"],
        outline: ["none", "palette.link", { color: "palette.primary", width: 1.5 }],
        ghost: ["none", "palette.link", "none"],
      };
      const [fill, color, stroke] = paint[variant] ?? paint.primary!;
      return stack(name, {
        direction: "horizontal", justify: "center", align: "center", padding: { x: str(p.size, "md") === "sm" ? "md" : "lg" },
        width: size.width ?? "hug", height: size.height ?? h, radius: p.radius ?? "md", fill, stroke, role: "cta",
      }, [text(`${name} / Label`, str(p.label, "Button"), { fontSize: str(p.size, "md") === "sm" ? "label" : "body", weight: "semibold", color, role: "cta" })]);
    },
  },
  input: {
    description: "Text field with optional label above; shows placeholder (muted) or value.",
    props: { label: "string?", placeholder: "string", value: "string?" },
    build(name, p, t, size) {
      const value = typeof p.value === "string" && p.value.length ? p.value : undefined;
      const children: Raw[] = [];
      if (p.label) children.push(text(`${name} / Label`, String(p.label), { fontSize: "label", weight: "medium", role: "label" }));
      children.push(stack(`${name} / Field`, {
        direction: "horizontal", align: "center", padding: { x: "md" }, width: "fill", height: t.controlHeight,
        radius: "md", fill: "palette.surface", stroke: { color: "palette.muted", width: 1 }, role: "input",
      }, [text(`${name} / ${value ? "Value" : "Placeholder"}`, value ?? str(p.placeholder, "Enter text"), { color: value ? "palette.text" : "palette.subtle" })]));
      return stack(name, { direction: "vertical", gap: "xs", width: size.width ?? "fill" }, children);
    },
  },
  search: {
    description: "Rounded search field with a search icon.",
    props: { placeholder: "string" },
    build(name, p, t, size) {
      return stack(name, {
        direction: "horizontal", align: "center", gap: "sm", padding: { x: "md" }, width: size.width ?? "fill", height: size.height ?? t.controlHeight,
        radius: "full", fill: "palette.surface", stroke: { color: "palette.muted", width: 1 }, role: "input",
      }, [icon(`${name} / Icon`, 16, "palette.muted", "circle"), text(`${name} / Placeholder`, str(p.placeholder, "Search"), { color: "palette.subtle" })]);
    },
  },
  card: {
    description: "Content card: optional image area, title, body, meta line and action button.",
    props: { title: "string", body: "string?", image: "boolean", imageHeight: "number", meta: "string?", action: "string?" },
    build(name, p, _t, size) {
      const children: Raw[] = [];
      if (bool(p.image, false)) children.push(placeholder(`${name} / Image`, "fill", num(p.imageHeight, 140)));
      if (p.meta) children.push(text(`${name} / Meta`, String(p.meta), { fontSize: "caption", fontRole: "accent", color: "palette.subtle", caps: "all", tracking: 80 }));
      children.push(text(`${name} / Title`, str(p.title, "Card title"), { fontSize: "title", fontRole: "heading", weight: "semibold", width: "fill", role: "headline" }));
      if (p.body) children.push(text(`${name} / Body`, String(p.body), { fontSize: "label", color: "palette.subtle", width: "fill", role: "body" }));
      if (p.action) children.push(COMPONENTS.button!.build(`${name} / Action`, { label: p.action, variant: "outline", size: "sm" }, _t, {}));
      return stack(name, { direction: "vertical", gap: "sm", padding: "md", width: size.width ?? "fill", height: size.height ?? "hug", radius: "lg", fill: "palette.surface", effects: [SHADOW_SM], role: "card" }, children);
    },
  },
  navbar: {
    description: "Website top navigation: brand, links, optional CTA button.",
    props: { brand: "string", links: "string[]", cta: "string?" },
    build(name, p, t, size) {
      const links = list(p.links, ["Product", "Pricing", "About"]);
      return stack(name, { direction: "horizontal", align: "center", gap: "lg", padding: { x: "xl" }, width: size.width ?? "fill", height: size.height ?? 72, fill: "palette.background", role: "navigation" }, [
        text(`${name} / Brand`, str(p.brand, "Brand"), { fontSize: "title", fontRole: "heading", weight: "bold", role: "logo" }),
        { type: "spacer" },
        ...links.map((l, i) => text(`${name} / Link ${i + 1}`, l, { fontSize: "label", weight: "medium", color: "palette.subtle", role: "link" })),
        ...(p.cta ? [COMPONENTS.button!.build(`${name} / CTA`, { label: p.cta, size: "sm" }, t, {})] : []),
      ]);
    },
  },
  "app-bar": {
    description: "Mobile top app bar: leading icon (back/menu/none), title, trailing avatar or icon.",
    props: { title: "string", leading: "back|menu|none", trailing: "avatar|icon|none", initials: "string?" },
    build(name, p, t, size) {
      const leading = str(p.leading, "none"), trailing = str(p.trailing, "none");
      const kids: Raw[] = [];
      if (leading === "menu") kids.push(stack(`${name} / Menu`, { direction: "vertical", gap: 4, role: "icon" }, [0, 1, 2].map((i) => ({ type: "rect", name: `${name} / Menu Bar ${i + 1}`, width: 20, height: 2, radius: 1, fill: "palette.text" }))));
      if (leading === "back") kids.push(text(`${name} / Back`, "‹", { fontSize: "heading", role: "icon" }));
      kids.push(text(`${name} / Title`, str(p.title, "Title"), { fontSize: "title", fontRole: "heading", weight: "semibold", width: "fill", role: "headline" }));
      if (trailing === "avatar") kids.push(COMPONENTS.avatar!.build(`${name} / Avatar`, { initials: p.initials ?? "AM", size: 36 }, t, {}));
      if (trailing === "icon") kids.push(icon(`${name} / Action`, 22, "palette.text", "circle"));
      return stack(name, { direction: "horizontal", align: "center", gap: "md", padding: { x: "md" }, width: size.width ?? "fill", height: size.height ?? 56, role: "navigation" }, kids);
    },
  },
  "tab-bar": {
    description: "Mobile bottom tab bar with icon + label items; one active.",
    props: { items: "string[]", active: "number" },
    build(name, p, _t, size) {
      const items = list(p.items, ["Home", "Search", "Inbox", "Profile"]);
      const active = num(p.active, 0);
      return stack(name, { direction: "horizontal", justify: "space-between", align: "center", padding: { x: "xl", top: "sm", bottom: "lg" }, width: size.width ?? "fill", height: size.height ?? 80, fill: "palette.surface", effects: [{ ...SHADOW_SM, offsetY: -2 }], role: "navigation" },
        items.map((label, i) => {
          const color = i === active ? "palette.primary" : "palette.subtle";
          return stack(`${name} / ${label}`, { direction: "vertical", align: "center", gap: "xxs" }, [
            { type: "rect", name: `${name} / ${label} / Icon`, width: 22, height: 22, radius: 6, fill: i === active ? "palette.primary" : "none", stroke: { color, width: 1.75 }, role: "icon" },
            text(`${name} / ${label} / Label`, label, { fontSize: "caption", weight: i === active ? "semibold" : "regular", color: i === active ? "palette.link" : "palette.subtle" }),
          ]);
        }));
    },
  },
  "list-item": {
    description: "Row with optional avatar, title, subtitle and trailing text/chevron.",
    props: { title: "string", subtitle: "string?", trailing: "string?", avatar: "boolean", divider: "boolean" },
    build(name, p, t, size) {
      const kids: Raw[] = [];
      if (bool(p.avatar, true)) kids.push(COMPONENTS.avatar!.build(`${name} / Avatar`, { initials: initialsOf(str(p.title, "Item")), size: 40 }, t, {}));
      kids.push(stack(`${name} / Text`, { direction: "vertical", gap: "xxs", width: "fill" }, [
        text(`${name} / Title`, str(p.title, "List item"), { weight: "medium", width: "fill", role: "list-item" }),
        ...(p.subtitle ? [text(`${name} / Subtitle`, String(p.subtitle), { fontSize: "label", color: "palette.subtle", width: "fill" })] : []),
      ]));
      kids.push(text(`${name} / Trailing`, str(p.trailing, "›"), { fontSize: p.trailing ? "label" : "title", color: "palette.subtle" }));
      return stack(name, { direction: "horizontal", align: "center", gap: "md", padding: { y: "sm" }, width: size.width ?? "fill", role: "list-item" }, kids);
    },
  },
  avatar: {
    description: "Circular avatar with initials.",
    props: { initials: "string", size: "number" },
    build(name, p, _t, size) {
      const s = num(p.size, 40);
      return stack(name, { direction: "horizontal", justify: "center", align: "center", width: size.width ?? s, height: size.height ?? s, radius: "full", fill: "palette.primary", role: "avatar" },
        [text(`${name} / Initials`, str(p.initials, "A").slice(0, 2).toUpperCase(), { fontSize: Math.round(s * 0.38), weight: "semibold", color: "palette.onPrimary" })]);
    },
  },
  badge: {
    description: "Small pill label. Tones: primary, accent, neutral.",
    props: { label: "string", tone: "primary|accent|neutral" },
    build(name, p, _t, size) {
      const tone = str(p.tone, "primary");
      const [fill, color] = tone === "neutral" ? ["palette.surface", "palette.text"] : tone === "accent" ? ["palette.accent", "palette.onAccent"] : ["palette.primary", "palette.onPrimary"];
      return stack(name, { direction: "horizontal", justify: "center", align: "center", padding: { x: "sm", y: "xxs" }, width: size.width ?? "hug", radius: "full", fill, role: "badge" },
        [text(`${name} / Label`, str(p.label, "New"), { fontSize: "caption", weight: "semibold", color })]);
    },
  },
  toggle: {
    description: "Labelled switch (on/off).",
    props: { label: "string", on: "boolean" },
    build(name, p, _t, size) {
      const on = bool(p.on, true);
      return stack(name, { direction: "horizontal", align: "center", gap: "md", padding: { y: "xs" }, width: size.width ?? "fill" }, [
        text(`${name} / Label`, str(p.label, "Setting"), { width: "fill" }),
        stack(`${name} / Track`, { direction: "horizontal", justify: on ? "end" : "start", align: "center", padding: 3, width: 48, height: 28, radius: "full", fill: on ? "palette.primary" : "palette.muted", role: "control" },
          [{ type: "circle", name: `${name} / Knob`, radius: 11, fill: "#FFFFFF" }]),
      ]);
    },
  },
  checkbox: {
    description: "Checkbox with label.",
    props: { label: "string", checked: "boolean" },
    build(name, p, _t, size) {
      const checked = bool(p.checked, true);
      return stack(name, { direction: "horizontal", align: "center", gap: "sm", width: size.width ?? "hug" }, [
        stack(`${name} / Box`, { direction: "horizontal", justify: "center", align: "center", width: 20, height: 20, radius: "sm", fill: checked ? "palette.primary" : "none", stroke: checked ? "none" : { color: "palette.muted", width: 1.5 }, role: "control" },
          checked ? [{ type: "rect", name: `${name} / Check`, width: 8, height: 8, radius: 2, fill: "#FFFFFF" }] : []),
        text(`${name} / Label`, str(p.label, "Option"), { fontSize: "label" }),
      ]);
    },
  },
  stat: {
    description: "KPI tile: label, big value, optional delta.",
    props: { label: "string", value: "string", delta: "string?" },
    build(name, p, _t, size) {
      return stack(name, { direction: "vertical", gap: "xs", padding: "md", width: size.width ?? "fill", height: size.height ?? "hug", radius: "lg", fill: "palette.surface", effects: [SHADOW_SM], role: "card" }, [
        text(`${name} / Label`, str(p.label, "Metric"), { fontSize: "label", color: "palette.subtle" }),
        text(`${name} / Value`, str(p.value, "1,234"), { fontSize: "heading", fontRole: "heading", weight: "bold", role: "headline" }),
        ...(p.delta ? [text(`${name} / Delta`, String(p.delta), { fontSize: "caption", weight: "semibold", color: "palette.link" })] : []),
      ]);
    },
  },
  image: {
    description: "Image placeholder frame (or a real image when path is given).",
    props: { path: "string?", label: "string?" },
    build(name, p, _t, size) {
      if (typeof p.path === "string" && p.path) return { type: "image", name, path: p.path, width: size.width ?? "fill", height: size.height ?? 160 };
      return placeholder(name, size.width ?? "fill", size.height ?? 160, str(p.label, "IMAGE"));
    },
  },
  chart: {
    description: "Bar chart placeholder; values are 0..1 bar heights.",
    props: { values: "number[]", title: "string?" },
    build(name, p, _t, size) {
      const values = Array.isArray(p.values) && p.values.length ? p.values.map(Number) : [0.4, 0.65, 0.5, 0.8, 0.6, 0.9, 0.7];
      const h = typeof size.height === "number" ? size.height : 220;
      const barArea = h - 72;
      return stack(name, { direction: "vertical", gap: "md", padding: "lg", width: size.width ?? "fill", height: h, radius: "lg", fill: "palette.surface", effects: [SHADOW_SM], role: "card" }, [
        text(`${name} / Title`, str(p.title, "Overview"), { fontSize: "title", fontRole: "heading", weight: "semibold" }),
        stack(`${name} / Bars`, { direction: "horizontal", align: "end", gap: "sm", width: "fill", height: "fill" },
          values.map((v, i) => ({ type: "rect", name: `${name} / Bar ${i + 1}`, width: "fill", height: Math.max(4, Math.min(1, v) * barArea), radius: "sm", fill: i === values.length - 1 ? "palette.accent" : "palette.primary", role: "data" }))),
      ]);
    },
  },
  progress: {
    description: "Horizontal progress bar; value 0..1.",
    props: { value: "number" },
    build(name, p, _t, size) {
      const v = Math.max(0, Math.min(1, num(p.value, 0.6)));
      return stack(name, { direction: "horizontal", width: size.width ?? "fill", height: size.height ?? 8, radius: "full", fill: "palette.surface", role: "control" },
        [{ type: "rect", name: `${name} / Value`, width: `${Math.round(v * 100)}%`, height: "fill", radius: "full", fill: "palette.primary" }]);
    },
  },
  divider: {
    description: "1-unit horizontal rule.",
    props: {},
    build(name, _p, _t, size) {
      return { type: "rect", name, width: size.width ?? "fill", height: size.height ?? 1, fill: "palette.muted", opacity: 40, role: "divider" };
    },
  },
  "status-bar": {
    description: "Mobile OS status bar (time + battery).",
    props: { time: "string" },
    build(name, p, _t, size) {
      return stack(name, { direction: "horizontal", align: "center", padding: { x: "lg" }, width: size.width ?? "fill", height: size.height ?? 44, role: "system" }, [
        text(`${name} / Time`, str(p.time, "9:41"), { fontSize: "label", weight: "semibold" }),
        { type: "spacer" },
        { type: "rect", name: `${name} / Battery`, width: 24, height: 11, radius: 3, fill: "palette.text" },
      ]);
    },
  },
  "section-header": {
    description: "Section title with optional trailing action link.",
    props: { title: "string", action: "string?" },
    build(name, p, _t, size) {
      return stack(name, { direction: "horizontal", align: "center", width: size.width ?? "fill" }, [
        text(`${name} / Title`, str(p.title, "Section"), { fontSize: "title", fontRole: "heading", weight: "semibold", width: "fill", role: "subheadline" }),
        ...(p.action ? [text(`${name} / Action`, String(p.action), { fontSize: "label", weight: "medium", color: "palette.link", role: "link" })] : []),
      ]);
    },
  },
  "sidebar-item": {
    description: "Navigation row for a sidebar; active rows are highlighted.",
    props: { label: "string", active: "boolean" },
    build(name, p, _t, size) {
      const active = bool(p.active, false);
      return stack(name, { direction: "horizontal", align: "center", gap: "sm", padding: { x: "md" }, width: size.width ?? "fill", height: size.height ?? 40, radius: "md", fill: active ? "palette.primary" : "none", role: "navigation" }, [
        { type: "rect", name: `${name} / Icon`, width: 16, height: 16, radius: 4, fill: "none", stroke: { color: active ? "palette.onPrimary" : "palette.secondary", width: 1.5 }, role: "icon" },
        text(`${name} / Label`, str(p.label, "Item"), { fontSize: "label", weight: active ? "semibold" : "regular", color: active ? "palette.onPrimary" : "palette.text" }),
      ]);
    },
  },
};

function placeholder(name: string, width: DimValue, height: DimValue, label = "IMAGE"): Raw {
  return stack(name, { direction: "horizontal", justify: "center", align: "center", width, height, radius: "md", fill: "palette.background", stroke: { color: "palette.muted", width: 1, dashes: [4, 4] }, role: "image-placeholder" },
    [text(`${name} / Label`, label, { fontSize: "caption", fontRole: "accent", color: "palette.subtle", tracking: 120, role: "placeholder-label" })]);
}

export function expandComponent(node: ComponentNode, tokens: DesignTokens): LayoutNode {
  const def = COMPONENTS[node.component];
  if (!def) throw new McpDesignError("PLAN_INVALID", `Unknown component "${node.component}". Available: ${Object.keys(COMPONENTS).join(", ")}`);
  const raw = def.build(node.name, node.props ?? {}, tokens, { width: node.width, height: node.height });
  const parsed = LayoutNodeSchema.safeParse(node.layer ? { ...raw, layer: node.layer } : raw);
  if (!parsed.success) throw new McpDesignError("PLAN_INVALID", `Component "${node.name}" (${node.component}) produced an invalid tree: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}

export function componentCatalog() {
  return Object.entries(COMPONENTS).map(([id, d]) => ({ id, description: d.description, props: d.props }));
}
