import { tokensFor } from "../ui/tokens.js";
import type { Unit } from "../../utils/units.js";
import { heading, type TemplateContext, type TemplateDefinition } from "./helpers.js";

/*
 * UI screen templates ("first draft" screens). They are written entirely in auto layout with
 * components and design tokens, so every screen re-flows at any size and re-themes with the
 * palette. Units are px; the root stack fills the artboard.
 */

type Raw = Record<string, unknown>;
const C = (name: string, component: string, props: Raw = {}, extra: Raw = {}): Raw => ({ type: "component", name, component, props, ...extra });
const T = (name: string, content: string, o: Raw = {}): Raw => ({ type: "text", name, content, ...o });
const S = (name: string, o: Raw, children: Raw[]): Raw => ({ type: "stack", name, ...o, children });

const UI_LAYERS = [{ name: "UI" }, { name: "Background", locked: true }];

function base(ctx: TemplateContext, name: string, w: number, h: number, units: Unit, platform: "mobile" | "web") {
  return {
    document: { name, width: w, height: h, units, colorMode: "RGB" as const },
    background: { type: "solid" as const, color: "palette.background" },
    layers: UI_LAYERS,
    tokens: tokensFor(ctx.style, platform),
    elements: [],
  };
}

function items(ctx: TemplateContext, fallback: string[]): string[] {
  return ctx.copy.items.length ? ctx.copy.items : fallback;
}

const mobileLogin: TemplateDefinition = {
  id: "mobile-login", name: "Mobile Login Screen", category: "mobile-app",
  description: "Sign-in screen: logo mark, welcome copy, email/password fields, primary + secondary actions.",
  defaultSize: { width: 390, height: 844, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    return {
      ...base(ctx, `${ctx.copy.brand} – Sign in`, w, h, units, "mobile"),
      autoLayout: [S("Screen", { direction: "vertical", width: "fill", height: "fill", padding: { bottom: "lg" } }, [
        C("Status Bar", "status-bar"),
        S("Content", { direction: "vertical", gap: "lg", padding: { x: "lg", top: "xxl" }, width: "fill", height: "fill" }, [
          C("Logo", "avatar", { initials: ctx.copy.brand.slice(0, 1), size: 56 }),
          S("Intro", { direction: "vertical", gap: "xs", width: "fill" }, [
            T("Title", heading(ctx, ctx.copy.headline), { fontSize: "heading", fontRole: "heading", weight: "bold", width: "fill", role: "headline" }),
            T("Subtitle", ctx.copy.subheadline, { fontSize: "body", color: "palette.subtle", width: "fill", role: "subheadline" }),
          ]),
          S("Form", { direction: "vertical", gap: "md", width: "fill" }, [
            C("Email", "input", { label: "Email", placeholder: "you@example.com" }),
            C("Password", "input", { label: "Password", placeholder: "••••••••" }),
            T("Forgot Password", "Forgot password?", { fontSize: "label", weight: "medium", color: "palette.primary", role: "link" }),
          ]),
          C("Sign In", "button", { label: ctx.copy.cta, variant: "primary", size: "lg" }, { width: "fill" }),
          C("Create Account", "button", { label: "Create an account", variant: "outline", size: "lg" }, { width: "fill" }),
          { type: "spacer" },
          T("Legal", "By continuing you agree to our Terms and Privacy Policy.", { fontSize: "caption", color: "palette.subtle", width: "fill", textAlign: "center", role: "caption" }),
        ]),
      ])],
    };
  },
};

const mobileHome: TemplateDefinition = {
  id: "mobile-home", name: "Mobile Home Screen", category: "mobile-app",
  description: "App home: app bar, greeting, search, KPI tiles, featured card, activity list and bottom tab bar.",
  defaultSize: { width: 390, height: 844, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    const rows = items(ctx, ["Morning run", "Team sync", "Grocery order"]);
    return {
      ...base(ctx, `${ctx.copy.brand} – Home`, w, h, units, "mobile"),
      autoLayout: [S("Screen", { direction: "vertical", width: "fill", height: "fill" }, [
        C("Status Bar", "status-bar"),
        C("App Bar", "app-bar", { title: ctx.copy.brand, leading: "menu", trailing: "avatar" }),
        S("Content", { direction: "vertical", gap: "lg", padding: { x: "md", top: "sm" }, width: "fill", height: "fill" }, [
          S("Greeting", { direction: "vertical", gap: "xxs", width: "fill" }, [
            T("Greeting Eyebrow", ctx.copy.tagline, { fontSize: "label", color: "palette.subtle", role: "eyebrow" }),
            T("Greeting Title", heading(ctx, ctx.copy.headline), { fontSize: "heading", fontRole: "heading", weight: "bold", width: "fill", role: "headline" }),
          ]),
          S("Stats", { direction: "horizontal", gap: "sm", width: "fill" }, [
            C("Stat 1", "stat", { label: "Today", value: "8,240", delta: "+12%" }, { width: "fill" }),
            C("Stat 2", "stat", { label: "This week", value: "42.6k", delta: "+4%" }, { width: "fill" }),
          ]),
          C("Featured", "card", { meta: "Featured", title: ctx.copy.subheadline, body: ctx.copy.body.slice(0, 90), action: ctx.copy.cta }),
          C("Activity Header", "section-header", { title: "Recent activity", action: "See all" }),
          S("Activity", { direction: "vertical", width: "fill" }, rows.slice(0, 2).map((r, i) => C(`Activity ${i + 1}`, "list-item", { title: r, subtitle: ["2 min ago", "1 h ago", "Yesterday"][i] ?? "", trailing: "›" }))),
        ]),
        C("Tab Bar", "tab-bar", { items: ["Home", "Explore", "Inbox", "Profile"], active: 0 }),
      ])],
    };
  },
};

const mobileSettings: TemplateDefinition = {
  id: "mobile-settings", name: "Mobile Settings Screen", category: "mobile-app",
  description: "Settings: profile row, grouped toggles and navigation rows, destructive action.",
  defaultSize: { width: 390, height: 844, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    const toggles = items(ctx, ["Push notifications", "Dark mode", "Location services"]);
    return {
      ...base(ctx, `${ctx.copy.brand} – Settings`, w, h, units, "mobile"),
      autoLayout: [S("Screen", { direction: "vertical", width: "fill", height: "fill" }, [
        C("Status Bar", "status-bar"),
        C("App Bar", "app-bar", { title: "Settings", leading: "back" }),
        S("Content", { direction: "vertical", gap: "lg", padding: { x: "md", top: "sm" }, width: "fill", height: "fill" }, [
          S("Profile", { direction: "horizontal", align: "center", gap: "md", padding: "md", width: "fill", radius: "lg", fill: "palette.surface", role: "card" }, [
            C("Profile Avatar", "avatar", { initials: "AM", size: 56 }),
            S("Profile Text", { direction: "vertical", gap: "xxs", width: "fill" }, [
              T("Profile Name", ctx.copy.headline, { fontSize: "title", fontRole: "heading", weight: "semibold", width: "fill", role: "headline" }),
              T("Profile Email", "alex@example.com", { fontSize: "label", color: "palette.subtle" }),
            ]),
          ]),
          T("Preferences Title", "PREFERENCES", { fontSize: "caption", fontRole: "accent", weight: "semibold", color: "palette.subtle", tracking: 100, role: "eyebrow" }),
          S("Preferences", { direction: "vertical", gap: "xs", padding: { x: "md", y: "sm" }, width: "fill", radius: "lg", fill: "palette.surface" },
            toggles.slice(0, 4).map((t, i) => C(`Toggle ${i + 1}`, "toggle", { label: t, on: i !== 1 }))),
          T("Account Title", "ACCOUNT", { fontSize: "caption", fontRole: "accent", weight: "semibold", color: "palette.subtle", tracking: 100, role: "eyebrow" }),
          S("Account", { direction: "vertical", padding: { x: "md" }, width: "fill", radius: "lg", fill: "palette.surface" },
            ["Privacy", "Payment methods", "Help & support"].map((t, i) => C(`Account Row ${i + 1}`, "list-item", { title: t, avatar: false }))),
          { type: "spacer" },
          C("Sign Out", "button", { label: "Sign out", variant: "ghost" }, { width: "fill" }),
        ]),
      ])],
    };
  },
};

const landing: TemplateDefinition = {
  id: "landing-page", name: "Landing Page (Desktop)", category: "landing-page",
  description: "Website hero: navbar, headline, subcopy, dual CTAs, product visual, three feature cards.",
  defaultSize: { width: 1440, height: 1024, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    const features = items(ctx, ["Fast setup", "Real-time sync", "Enterprise security"]);
    return {
      ...base(ctx, `${ctx.copy.brand} – Landing`, w, h, units, "web"),
      autoLayout: [S("Page", { direction: "vertical", width: "fill", height: "fill" }, [
        C("Navbar", "navbar", { brand: ctx.copy.brand, links: ["Product", "Solutions", "Pricing", "Resources"], cta: ctx.copy.cta }),
        S("Hero", { direction: "horizontal", align: "center", gap: "xxl", padding: { x: 120, y: "xxl" }, width: "fill" }, [
          S("Hero Copy", { direction: "vertical", gap: "lg", width: "fill" }, [
            C("Hero Badge", "badge", { label: ctx.copy.tagline, tone: "accent" }),
            T("Hero Headline", heading(ctx, ctx.copy.headline), { fontSize: "hero", fontRole: "heading", weight: "bold", width: "fill", leading: 76, role: "headline" }),
            T("Hero Subheadline", ctx.copy.body, { fontSize: "title", color: "palette.subtle", width: "fill", role: "subheadline" }),
            S("Hero Actions", { direction: "horizontal", gap: "sm" }, [
              C("Primary CTA", "button", { label: ctx.copy.cta, size: "lg" }),
              C("Secondary CTA", "button", { label: "Book a demo", variant: "outline", size: "lg" }),
            ]),
          ]),
          C("Hero Visual", "image", { label: "PRODUCT VISUAL", path: ctx.imagePath }, { width: "fill", height: 420 }),
        ]),
        S("Features", { direction: "horizontal", gap: "lg", padding: { x: 120 }, width: "fill" },
          features.slice(0, 3).map((f, i) => C(`Feature ${i + 1}`, "card", { meta: `0${i + 1}`, title: f, body: "Short benefit statement that explains why this matters to your customers." }, { width: "fill" }))),
      ])],
    };
  },
};

const dashboard: TemplateDefinition = {
  id: "web-dashboard", name: "Web Dashboard", category: "web-dashboard",
  description: "Admin dashboard: sidebar navigation, header with search, KPI row, bar chart and recent activity list.",
  defaultSize: { width: 1440, height: 900, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    const nav = items(ctx, ["Overview", "Analytics", "Customers", "Orders", "Settings"]);
    return {
      ...base(ctx, `${ctx.copy.brand} – Dashboard`, w, h, units, "web"),
      autoLayout: [S("App", { direction: "horizontal", width: "fill", height: "fill" }, [
        S("Sidebar", { direction: "vertical", gap: "xs", padding: "lg", width: 248, height: "fill", fill: "palette.surface", role: "navigation" }, [
          T("Sidebar Brand", ctx.copy.brand, { fontSize: "title", fontRole: "heading", weight: "bold", role: "logo" }),
          { type: "spacer", size: "lg" },
          ...nav.slice(0, 7).map((n, i) => C(`Nav ${i + 1}`, "sidebar-item", { label: n, active: i === 0 })),
        ]),
        S("Main", { direction: "vertical", gap: "lg", padding: "xl", width: "fill", height: "fill" }, [
          S("Header", { direction: "horizontal", align: "center", gap: "md", width: "fill" }, [
            S("Header Text", { direction: "vertical", gap: "xxs", width: "fill" }, [
              T("Page Title", heading(ctx, ctx.copy.headline), { fontSize: "heading", fontRole: "heading", weight: "bold", role: "headline" }),
              T("Page Subtitle", ctx.copy.subheadline, { fontSize: "label", color: "palette.subtle", role: "subheadline" }),
            ]),
            C("Search", "search", { placeholder: "Search…" }, { width: 280 }),
            C("Header Avatar", "avatar", { initials: "AM", size: 40 }),
          ]),
          S("KPIs", { direction: "horizontal", gap: "md", width: "fill" }, [
            ["Revenue", "$84.2k", "+8.1%"], ["Active users", "12,480", "+3.4%"], ["Conversion", "4.6%", "+0.4 pt"], ["Churn", "1.2%", "−0.3 pt"],
          ].map(([l, v, d], i) => C(`KPI ${i + 1}`, "stat", { label: l, value: v, delta: d }, { width: "fill" }))),
          S("Panels", { direction: "horizontal", gap: "md", width: "fill", height: "fill" }, [
            C("Revenue Chart", "chart", { title: "Revenue", values: [0.35, 0.5, 0.42, 0.6, 0.55, 0.72, 0.68, 0.85, 0.8, 0.95] }, { width: "65%", height: 420 }),
            S("Activity Panel", { direction: "vertical", gap: "xs", padding: "lg", width: "fill", height: 420, radius: "lg", fill: "palette.surface", role: "card" }, [
              C("Activity Header", "section-header", { title: "Recent orders", action: "View all" }),
              ...["Maya Chen", "Leo Park", "Ana Silva", "Sam Reed"].map((n, i) => C(`Order ${i + 1}`, "list-item", { title: n, subtitle: `Order #10${42 + i}`, trailing: ["$120", "$86", "$240", "$64"][i] })),
            ]),
          ]),
        ]),
      ])],
    };
  },
};

const uiKit: TemplateDefinition = {
  id: "ui-kit", name: "UI Kit / Design System Sheet", category: "ui-kit",
  description: "Design-system sheet: color tokens, type scale, buttons, inputs, controls, cards and navigation components.",
  defaultSize: { width: 1440, height: 1100, units: "px" },
  build(ctx, { width: w, height: h, units }) {
    const roles = Object.keys(ctx.palette.colors) as (keyof typeof ctx.palette.colors)[];
    const t = tokensFor(ctx.style, "web");
    const section = (title: string, children: Raw[], o: Raw = {}) => S(`${title} Section`, { direction: "vertical", gap: "md", width: "fill", ...o }, [
      T(`${title} Title`, title.toUpperCase(), { fontSize: "caption", fontRole: "accent", weight: "semibold", color: "palette.subtle", tracking: 120, role: "eyebrow" }),
      ...children,
    ]);
    return {
      ...base(ctx, `${ctx.copy.brand} – UI Kit`, w, h, units, "web"),
      autoLayout: [S("Sheet", { direction: "vertical", gap: "xl", padding: 64, width: "fill", height: "fill" }, [
        S("Sheet Header", { direction: "vertical", gap: "xs", width: "fill" }, [
          T("Kit Title", `${ctx.copy.brand} Design System`, { fontSize: "display", fontRole: "heading", weight: "bold", role: "headline" }),
          T("Kit Subtitle", `${ctx.style} style · ${ctx.palette.name} palette · 8-pt spacing grid`, { fontSize: "body", color: "palette.subtle", role: "subheadline" }),
        ]),
        section("Color", [S("Swatches", { direction: "horizontal", gap: "md", width: "fill" }, roles.map((r) =>
          S(`Swatch ${r}`, { direction: "vertical", gap: "xs", width: "fill" }, [
            { type: "rect", name: `Swatch ${r} / Chip`, width: "fill", height: 72, radius: "md", fill: `palette.${r}`, stroke: { color: "palette.muted", width: 0.5 }, role: "swatch" },
            T(`Swatch ${r} / Name`, r, { fontSize: "label", weight: "semibold" }),
            T(`Swatch ${r} / Hex`, ctx.palette.colors[r], { fontSize: "caption", color: "palette.subtle" }),
          ])))]),
        S("Middle Row", { direction: "horizontal", gap: "xxl", width: "fill" }, [
          section("Typography", (["display", "heading", "title", "body", "label", "caption"] as const).map((k) =>
            T(`Type ${k}`, `${k[0]!.toUpperCase()}${k.slice(1)} · ${t.fontSize[k]}`, { fontSize: k, fontRole: ["display", "heading", "title"].includes(k) ? "heading" : "body", weight: ["display", "heading"].includes(k) ? "bold" : "regular" }))),
          section("Buttons & Inputs", [
            S("Buttons Row", { direction: "horizontal", gap: "sm" }, [
              C("Button Primary", "button", { label: "Primary" }), C("Button Secondary", "button", { label: "Secondary", variant: "secondary" }),
              C("Button Outline", "button", { label: "Outline", variant: "outline" }), C("Button Ghost", "button", { label: "Ghost", variant: "ghost" }),
            ]),
            C("Input Example", "input", { label: "Email", placeholder: "you@example.com" }, { width: 360 }),
            C("Search Example", "search", { placeholder: "Search components" }, { width: 360 }),
            S("Controls Row", { direction: "horizontal", align: "center", gap: "lg" }, [
              C("Checkbox Example", "checkbox", { label: "Remember me" }), C("Badge Example", "badge", { label: "New", tone: "accent" }),
              C("Avatar Example", "avatar", { initials: "AM" }), C("Toggle Example", "toggle", { label: "Notifications" }, { width: 220 }),
            ]),
            C("Progress Example", "progress", { value: 0.65 }, { width: 360 }),
          ], { width: "fill" }),
        ]),
        section("Components", [S("Components Row", { direction: "horizontal", gap: "lg", width: "fill" }, [
          C("Card Example", "card", { image: true, imageHeight: 120, meta: "Card", title: "Card title", body: "Supporting text for a content card.", action: "Action" }, { width: "fill" }),
          C("Stat Example", "stat", { label: "Revenue", value: "$84.2k", delta: "+8.1%" }, { width: "fill" }),
          S("List Example", { direction: "vertical", padding: { x: "md" }, width: "fill", radius: "lg", fill: "palette.surface" }, [
            C("List Row 1", "list-item", { title: "Maya Chen", subtitle: "Designer" }), C("List Row 2", "list-item", { title: "Leo Park", subtitle: "Engineer" }),
          ]),
        ])]),
      ])],
    };
  },
};

export const UI_TEMPLATES: TemplateDefinition[] = [mobileHome, mobileLogin, mobileSettings, landing, dashboard, uiKit];
