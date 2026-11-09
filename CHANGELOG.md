# Changelog

## Unreleased

Figma-AI-style UI design.

- Auto layout: `autoLayout` trees on design plans (stacks with direction, gap, padding, align, justify; hug/fill/percentage sizing; spacers) are measured and flattened into positioned elements before validation. Overflow is reported as a warning.
- UI component library (20 components: button, input, search, card, navbar, app-bar, tab-bar, list-item, avatar, badge, toggle, checkbox, stat, image, chart, progress, divider, status-bar, section-header, sidebar-item) with `<instance> / <part>` naming.
- Design tokens (`tokens`: spacing, radius, fontSize, controlHeight), style-aware; missing UI palette roles are derived, and `palette.subtle` guarantees AA-contrast secondary text.
- 6 UI templates (mobile home, login, settings; landing page; web dashboard; UI kit) and a `wireframe` style. UI briefs are routed automatically.
- 8 tools: `create_app_screen`, `create_landing_page`, `create_web_dashboard`, `create_ui_kit`, `create_ui_design`, `list_ui_components`, `get_design_tokens`, `rename_layers_semantically`.
- Text contrast is validated against the shape beneath the text rather than only the page background.
- Design knowledge from [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT, vendored in `data/ui-ux-pro-max`): 192 product types with palettes and reasoning, 89 UI styles, 74 font pairings, landing patterns, UX/mobile rules and chart guidance.
  - `search_design_knowledge` and `recommend_design_system` tools.
  - UI briefs automatically use the matched product's palette and font pairing (opt out with `designSystem: false`, or by giving a style or base color); `create_ui_design` takes `product`.
  - New derived palette roles `onPrimary`, `onAccent` and `link` keep text readable on any palette; all 192 product palettes pass the contrast check.

## 0.1.0 — 2026-11-08

Initial implementation.

- MCP server (official TypeScript SDK 1.32.2) with stdio and Streamable HTTP transports; bearer-token and secret-path auth; loopback-by-default.
- 114 tools: document, vector, typography, appearance, objects, layout, layers, export, assets, and AI design engine.
- Design engine: brief analysis, 20 templates, 14 style systems (palettes + typography), strict design-plan schema with semantic validation, compiler, composition analyzer, targeted revisions with versioned plans, variations.
- Illustrator bridge: allowlisted ExtendScript operations, serial queue, timeouts, typed errors, COM adapter via PowerShell, mock adapter for tests.
- PowerShell scripts: install, dependency check, build, launch, diagnostics, bridge test, integration test, token generator.
- 61 automated tests. Real-Illustrator integration suite included; **not yet executed against Illustrator** (see docs/TESTING.md).
