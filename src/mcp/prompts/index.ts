import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const user = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

export function registerPrompts(server: McpServer): void {
  server.registerPrompt("design_from_brief", {
    title: "Design from brief",
    description: "Plan, execute, inspect and iterate a design from a natural-language brief.",
    argsSchema: { brief: z.string(), iterations: z.string().optional() },
  }, ({ brief, iterations }) => user(
    `Design brief: ${brief}

Workflow:
1. Call plan_design with the brief. Review the plan's hierarchy, palette and typography; adjust if the brief demands it.
2. Call execute_design_plan with the planId. Check verification.missing and warnings (missing fonts/images).
3. Call critique_design. Base visual judgements ONLY on the attached preview image, and keep them separate from verifiedAnalysis.
4. Apply targeted changes with revise_design (by element name) or improve_design. Repeat up to ${iterations ?? "2"} times.
5. Save with save_document_as and export with export_multiple_formats if requested.
Never state that something was created or looks a certain way unless a tool result or preview image shows it.`,
  ));

  server.registerPrompt("critique_active_document", {
    title: "Critique active document",
    description: "Structured critique of the open Illustrator document using design principles.",
    argsSchema: { goals: z.string().optional() },
  }, ({ goals }) => user(
    `Critique the active Illustrator document${goals ? ` against these goals: ${goals}` : ""}.
Call critique_design. Report (a) verified findings from document properties, (b) your visual assessment of the attached preview — clearly labelled — covering alignment, contrast, balance, hierarchy, proximity, repetition, negative space, typography and color. Then propose specific revise_design or improve_design calls.`,
  ));

  server.registerPrompt("brand_identity_kit", {
    title: "Brand identity kit",
    description: "Logo, palette board, business card and social graphic for one brand.",
    argsSchema: { brand: z.string(), description: z.string(), style: z.string().optional() },
  }, ({ brand, description, style }) => user(
    `Create a brand identity kit for "${brand}" (${description})${style ? ` in a ${style} style` : ""}.
Use the same baseColor and style for every piece: create_logo, create_brand_identity, create_business_card, create_social_media_graphic (copy.brand = "${brand}"). Save each as .ai in the output directory and summarise the files produced.`,
  ));
}
