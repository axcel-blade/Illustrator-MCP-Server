import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DesignPlanSchema, type DesignElement, type DesignPlan } from "../schemas/design-plan.js";
import { McpDesignError } from "../utils/errors.js";

export interface StoredPlan {
  id: string;
  version: number;
  plan: DesignPlan;
  createdAt: string;
  note?: string;
  executed?: { documentName?: string; at: string; adapter: string };
}

/** Versioned plan storage on disk (output/plans/<id>/v<n>.json) so revisions can be compared. */
export class PlanStore {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  save(plan: DesignPlan, opts: { id?: string; note?: string } = {}): StoredPlan {
    const id = opts.id ?? randomUUID().slice(0, 8);
    if (!/^[\w-]{1,64}$/.test(id)) throw new McpDesignError("VALIDATION_ERROR", "Invalid plan id");
    const folder = join(this.dir, id);
    mkdirSync(folder, { recursive: true });
    const version = this.versions(id).length + 1;
    const stored: StoredPlan = { id, version, plan, createdAt: new Date().toISOString(), note: opts.note };
    writeFileSync(join(folder, `v${version}.json`), JSON.stringify(stored, null, 2));
    return stored;
  }

  markExecuted(id: string, version: number, info: StoredPlan["executed"]): void {
    const file = join(this.dir, id, `v${version}.json`);
    const stored = this.get(id, version);
    stored.executed = info;
    writeFileSync(file, JSON.stringify(stored, null, 2));
  }

  versions(id: string): number[] {
    const folder = join(this.dir, id);
    if (!existsSync(folder)) return [];
    return readdirSync(folder).map((f) => /^v(\d+)\.json$/.exec(f)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
  }

  get(id: string, version?: number): StoredPlan {
    if (!/^[\w-]{1,64}$/.test(id)) throw new McpDesignError("VALIDATION_ERROR", "Invalid plan id");
    const versions = this.versions(id);
    if (!versions.length) throw new McpDesignError("OBJECT_NOT_FOUND", `No design plan with id ${id}`);
    const v = version ?? versions[versions.length - 1]!;
    const file = join(this.dir, id, `v${v}.json`);
    if (!existsSync(file)) throw new McpDesignError("OBJECT_NOT_FOUND", `Plan ${id} has no version ${v}`);
    const raw = JSON.parse(readFileSync(file, "utf8")) as StoredPlan;
    return { ...raw, plan: DesignPlanSchema.parse(raw.plan) };
  }

  list(): { id: string; versions: number; title?: string }[] {
    return readdirSync(this.dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const versions = this.versions(d.name);
        const title = versions.length ? this.get(d.name).plan.meta.title : undefined;
        return { id: d.name, versions: versions.length, title };
      });
  }
}

export interface PlanDiff {
  added: string[];
  removed: string[];
  changed: { name: string; fields: string[] }[];
  paletteChanged: string[];
  documentChanged: string[];
}

export function diffPlans(a: DesignPlan, b: DesignPlan): PlanDiff {
  const byName = (els: DesignElement[]) => new Map(els.map((e) => [e.name, e]));
  const A = byName(a.elements), B = byName(b.elements);
  const changed: PlanDiff["changed"] = [];
  for (const [name, eb] of B) {
    const ea = A.get(name);
    if (!ea) continue;
    const keys = new Set([...Object.keys(ea), ...Object.keys(eb)]);
    const fields = [...keys].filter((k) => JSON.stringify((ea as Record<string, unknown>)[k]) !== JSON.stringify((eb as Record<string, unknown>)[k]));
    if (fields.length) changed.push({ name, fields });
  }
  const roles = new Set([...Object.keys(a.palette.colors), ...Object.keys(b.palette.colors)]);
  return {
    added: [...B.keys()].filter((k) => !A.has(k)),
    removed: [...A.keys()].filter((k) => !B.has(k)),
    changed,
    paletteChanged: [...roles].filter((r) => a.palette.colors[r] !== b.palette.colors[r]),
    documentChanged: (["width", "height", "units", "colorMode"] as const).filter((k) => a.document[k] !== b.document[k]),
  };
}
