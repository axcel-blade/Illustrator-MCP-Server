import type { ZodTypeAny } from "zod";

/**
 * Minimal Zod -> JSON Schema conversion for documentation resources. Tool input schemas are
 * converted by the MCP SDK itself; this is only used to publish the design-plan schema.
 */
export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const def = schema._def as Record<string, unknown> & { typeName: string };
  const d = (s: Record<string, unknown>) => (schema.description ? { ...s, description: schema.description } : s);
  switch (def.typeName) {
    case "ZodString": {
      const checks = (def.checks as { kind: string; regex?: RegExp; value?: number }[]) ?? [];
      const out: Record<string, unknown> = { type: "string" };
      for (const c of checks) {
        if (c.kind === "regex" && c.regex) out.pattern = c.regex.source;
        if (c.kind === "min") out.minLength = c.value;
        if (c.kind === "max") out.maxLength = c.value;
      }
      return d(out);
    }
    case "ZodNumber": {
      const checks = (def.checks as { kind: string; value?: number }[]) ?? [];
      const out: Record<string, unknown> = { type: checks.some((c) => c.kind === "int") ? "integer" : "number" };
      for (const c of checks) {
        if (c.kind === "min") out.minimum = c.value;
        if (c.kind === "max") out.maximum = c.value;
      }
      return d(out);
    }
    case "ZodBoolean": return d({ type: "boolean" });
    case "ZodLiteral": return d({ const: def.value });
    case "ZodEnum": return d({ type: "string", enum: def.values });
    case "ZodArray": return d({ type: "array", items: zodToJsonSchema(def.type as ZodTypeAny) });
    case "ZodTuple": return d({ type: "array", prefixItems: (def.items as ZodTypeAny[]).map(zodToJsonSchema) });
    case "ZodRecord": return d({ type: "object", additionalProperties: zodToJsonSchema(def.valueType as ZodTypeAny) });
    case "ZodOptional": return zodToJsonSchema(def.innerType as ZodTypeAny);
    case "ZodDefault": return { ...zodToJsonSchema(def.innerType as ZodTypeAny), default: (def.defaultValue as () => unknown)() };
    case "ZodEffects": return zodToJsonSchema(def.schema as ZodTypeAny);
    case "ZodUnion": return d({ anyOf: (def.options as ZodTypeAny[]).map(zodToJsonSchema) });
    case "ZodDiscriminatedUnion": return d({ oneOf: [...(def.options as ZodTypeAny[])].map(zodToJsonSchema) });
    case "ZodObject": {
      const shape = (def.shape as () => Record<string, ZodTypeAny>)();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        properties[k] = zodToJsonSchema(v);
        if (!v.isOptional()) required.push(k);
      }
      return d({ type: "object", properties, required, additionalProperties: false });
    }
    default: return {};
  }
}
