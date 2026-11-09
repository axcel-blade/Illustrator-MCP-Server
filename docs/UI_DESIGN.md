# UI design (Figma-AI-style workflow)

The server can design app and web UI the way Figma's AI features do: generate a first-draft screen from a prompt,
lay it out with **auto layout**, build it from **components** themed by **design tokens**, and clean up generic
layer names. Everything ends up as editable Illustrator vectors and live text.

## Tools

| Tool | Use it for |
|---|---|
| `create_app_screen` | Prompt → mobile screen. Home/dashboard by default; "login", "sign up" or "settings" in the brief pick those screens |
| `create_landing_page` | Prompt → desktop landing page (navbar, hero, CTAs, feature cards) |
| `create_web_dashboard` | Prompt → admin dashboard (sidebar, header, KPI tiles, chart, activity list) |
| `create_ui_kit` | Design-system sheet: color tokens, type scale and every component, themed by style/palette |
| `create_ui_design` | Your own screen as an auto-layout tree (the AI decides the structure; the server does the geometry) |
| `list_ui_components` | Component catalog with props, node reference, device frame presets, default tokens |
| `get_design_tokens` | Palette roles, typography roles, spacing/radius/type-size tokens for a style |
| `recommend_design_system` | Product brief → palette, font pairing, style, landing pattern, anti-patterns (UI/UX Pro Max) |
| `search_design_knowledge` | Search styles, product palettes, font pairings, landing patterns, UX/mobile rules, chart guidance |
| `rename_layers_semantically` | Rename `<Path>`, `Rectangle 3`, unnamed text… to `Background`, `Button / Sign in`, `Heading / …` |

`generate_design` also routes UI briefs ("mobile app", "landing page", "dashboard", "ui kit", "wireframe") to these
templates. The `wireframe` style gives a grayscale low-fidelity look.

## Design knowledge (UI/UX Pro Max)

The server ships the design data of [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
(MIT) in `data/`. For UI briefs, the planner matches the business described in the brief
("fintech", "telemedicine", "recipe app") to one of 192 product types. It then uses that product's color
palette and font pairing and adds its reasoning (key considerations, recommended style, what to avoid) to the
plan's rationale. Words that describe the deliverable ("login screen", "dashboard") are ignored when matching,
so a brief with no business in it keeps the style palette.

The knowledge is used when no `style` or `baseColor` is given. Pass `designSystem: false` to turn it off, or
`designSystem: true` to apply it together with a style. `create_ui_design` takes `product: "…"` for the same
effect. Font pairings are Google Fonts; when one isn't installed, Illustrator falls back to Segoe UI/Arial or
Georgia, and the font check warns about it.

## Auto layout

`create_ui_design.layout` (or `autoLayout` on any design plan) is a tree of nodes. Before validation the server
measures the tree and flattens it into ordinary positioned elements, so revisions, critique and `improve_design`
work on the result like on any other design.

```json
{ "type": "stack", "name": "Screen", "direction": "vertical", "width": "fill", "height": "fill",
  "padding": { "x": "lg", "top": "xl" }, "gap": "md", "children": [
    { "type": "component", "name": "Status Bar", "component": "status-bar" },
    { "type": "text", "name": "Title", "content": "Checkout", "fontSize": "heading", "weight": "bold" },
    { "type": "component", "name": "Card Number", "component": "input", "props": { "label": "Card number", "placeholder": "1234 5678 9012 3456" } },
    { "type": "spacer" },
    { "type": "component", "name": "Pay", "component": "button", "props": { "label": "Pay $42.00" }, "width": "fill" }
] }
```

| Node | Fields |
|---|---|
| `stack` | `direction` (`vertical`/`horizontal`), `gap`, `padding` (number, token or `{x,y,top,right,bottom,left}`), `align` (`start center end stretch`, cross axis), `justify` (`start center end space-between`, main axis), `width`, `height`, `fill?`, `stroke?`, `radius?`, `effects?`, `children` |
| `text` | `content`, `fontSize` (pt or token), `fontRole`, `weight`, `color`, `textAlign?`, `width` (`hug` = point text, `fill`/number = wrapped area text) |
| `rect` / `ellipse` / `circle` / `image` | Leaf shapes; `rect` takes `radius` |
| `spacer` | With `size`: fixed gap. Without: absorbs leftover space (pushes siblings apart, e.g. a tab bar to the bottom) |
| `component` | `component`, `props`, optional `width`/`height` |

**Sizing** per axis: a number (fixed), `"hug"` (fit content, default), `"fill"` (share the parent's remaining space)
or `"40%"` (share of the parent's inner size). A stack with paint (`fill`, `stroke` or `effects`) is drawn as a
rectangle named after the stack. Overflowing content is reported as a validation warning.

Text is measured with estimated glyph widths (real metrics exist only inside Illustrator), so labels are anchored to
their slot (left / center / right) to stay aligned when the actual font is wider or narrower.

## Components

`button`, `input`, `search`, `card`, `navbar`, `app-bar`, `tab-bar`, `list-item`, `avatar`, `badge`, `toggle`,
`checkbox`, `stat`, `image`, `chart`, `progress`, `divider`, `status-bar`, `section-header`, `sidebar-item`.
Parts are named `<instance> / <part>` (for example `Pay / Label`), so `revise_design` can target any of them.

## Design tokens

Plans carry `tokens` (spacing, radius, fontSize, controlHeight). Nodes reference them by key: `gap: "md"`,
`radius: "full"`, `fontSize: "title"`. Styles change the tokens: `brutalist` has square corners, `playful` and
`organic` have rounder ones, and web frames get larger display sizes.

Colors use palette roles. When a role that components need is missing (`surface`, `muted`, `secondary`), it is
derived from the palette, and three roles are always derived: `subtle` (secondary text, at least 4.6:1 against the
background), `link` (primary-colored text that reads at 4.5:1 on both the page and cards) and
`onPrimary`/`onAccent` (text on primary/accent fills). The validator checks text contrast against the shape *under* the text,
not just the page background.

## Device frames

`iphone-15` 393×852 · `iphone-se` 375×667 · `android` 412×915 · `ipad` 820×1180 · `laptop` 1280×832 · `desktop` 1440×1024 (px).
