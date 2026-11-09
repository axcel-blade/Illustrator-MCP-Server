import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { HexColorSchema } from "../utils/colors.js";
import { McpDesignError } from "../utils/errors.js";

export const TypeRoleSchema = z.object({
  role: z.string().min(1).max(60),
  font: z.string().min(1).max(200).optional(),
  size: z.number().positive().max(2000).optional(),
  minSize: z.number().min(0).optional(),
  maxSize: z.number().min(0).optional(),
  layer: z.string().optional(),
  nameContains: z.string().optional(),
  tracking: z.number().min(-1000).max(10000).optional(),
  leading: z.number().positive().optional(),
  color: HexColorSchema.optional(),
});
export type TypeRole = z.infer<typeof TypeRoleSchema>;

export const DesignSystemSchema = z.object({
  name: z.string().min(1).max(120).regex(/^[\w .-]+$/, "Use letters, digits, space, dot, dash or underscore"),
  description: z.string().max(2000).optional(),
  palette: z.record(HexColorSchema).refine((p) => Object.keys(p).length > 0, "Palette needs at least one role")
    .describe('Role → hex, e.g. {"primary":"#0B1F3A","accent":"#2F80ED","background":"#FFFFFF"}'),
  typography: z.array(TypeRoleSchema).max(20).default([])
    .describe("Typography roles; matching rules as in apply_typography (minSize/maxSize/layer/nameContains)"),
  spacing: z.array(z.number().positive()).max(20).optional().describe("Spacing scale in pt, e.g. [4,8,12,16,24,32,48]"),
  grid: z.object({ columns: z.number().int().min(1).max(48), gutter: z.number().min(0), margin: z.number().min(0) }).optional(),
  logoVariants: z.array(z.object({ name: z.string(), description: z.string().optional(), file: z.string().optional() })).max(20).optional(),
  guidelines: z.array(z.string().max(500)).max(50).optional(),
});
export type DesignSystem = z.infer<typeof DesignSystemSchema>;

const slug = (name: string) => name.trim().toLowerCase().replace(/[^\w.-]+/g, "-");

/** Design systems as JSON files, independent of any Illustrator document. */
export class DesignSystemStore {
  readonly dir: string;
  constructor(outputDir: string) {
    this.dir = join(outputDir, "design-systems");
  }

  private file(name: string): string {
    return join(this.dir, `${slug(name)}.json`);
  }

  save(system: DesignSystem, overwrite = false): { name: string; path: string; created: boolean } {
    const parsed = DesignSystemSchema.parse(system);
    const path = this.file(parsed.name);
    const exists = existsSync(path);
    if (exists && !overwrite) throw new McpDesignError("FILE_EXISTS", `Design system "${parsed.name}" exists. Pass overwrite: true to replace it.`);
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(path, JSON.stringify({ ...parsed, updatedAt: new Date().toISOString() }, null, 2));
    return { name: parsed.name, path, created: !exists };
  }

  get(name: string): DesignSystem {
    const path = this.file(name);
    if (!existsSync(path)) throw new McpDesignError("OBJECT_NOT_FOUND", `No design system named "${name}". Use list_design_systems.`);
    return DesignSystemSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  }

  list(): { name: string; description?: string; roles: string[] }[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir).filter((f) => f.endsWith(".json")).flatMap((f) => {
      try {
        const s = DesignSystemSchema.parse(JSON.parse(readFileSync(join(this.dir, f), "utf8")));
        return [{ name: s.name, description: s.description, roles: Object.keys(s.palette) }];
      } catch {
        return [];
      }
    });
  }
}
