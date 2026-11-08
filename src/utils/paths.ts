import { existsSync, mkdirSync } from "node:fs";
import { dirname, extname, isAbsolute, normalize, relative, resolve } from "node:path";
import { McpDesignError } from "./errors.js";

/**
 * File-system sandbox. Every path supplied by an MCP client is resolved and must sit inside
 * one of the configured allowed roots. Blocks traversal (..), other drives and UNC shares.
 */
export class PathPolicy {
  private readonly roots: string[];

  constructor(roots: string[]) {
    this.roots = roots.map((r) => normalize(resolve(r)));
    if (this.roots.length === 0) throw new Error("PathPolicy requires at least one allowed root");
  }

  get allowedRoots(): readonly string[] {
    return this.roots;
  }

  /** Resolve a client path. Relative paths resolve against the first allowed root. */
  resolve(input: string, opts: { extensions?: string[]; mustExist?: boolean } = {}): string {
    if (!input || input.includes("\0")) throw new McpDesignError("PATH_NOT_ALLOWED", "Invalid path");
    if (input.startsWith("\\\\") || input.startsWith("//")) {
      throw new McpDesignError("PATH_NOT_ALLOWED", "Network (UNC) paths are not allowed");
    }
    const full = normalize(isAbsolute(input) ? resolve(input) : resolve(this.roots[0]!, input));
    const inside = this.roots.some((root) => {
      const rel = relative(root, full);
      return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
    });
    if (!inside) {
      throw new McpDesignError("PATH_NOT_ALLOWED", `Path is outside the allowed directories: ${full}`, {
        allowedRoots: this.roots,
      });
    }
    if (opts.extensions) {
      const ext = extname(full).toLowerCase();
      if (!opts.extensions.includes(ext)) {
        throw new McpDesignError(
          "VALIDATION_ERROR",
          `File extension ${ext || "(none)"} not allowed; expected ${opts.extensions.join(", ")}`,
        );
      }
    }
    if (opts.mustExist && !existsSync(full)) throw new McpDesignError("FILE_NOT_FOUND", `File not found: ${full}`);
    return full;
  }

  /** Resolve an output path, enforcing the overwrite policy and creating the parent directory. */
  resolveOutput(input: string, opts: { extensions?: string[]; overwrite?: boolean }): string {
    const full = this.resolve(input, { extensions: opts.extensions });
    if (existsSync(full) && !opts.overwrite) {
      throw new McpDesignError("FILE_EXISTS", `File already exists: ${full}. Pass overwrite: true to replace it.`);
    }
    mkdirSync(dirname(full), { recursive: true });
    return full;
  }
}
