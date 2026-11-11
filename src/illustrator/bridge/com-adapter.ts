import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { McpDesignError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { detectIllustrator } from "./detect.js";
import { SCRIPT_DIR } from "./script-builder.js";
import type { BridgeAdapter, DetectionResult, ExecuteRequest } from "./types.js";

/**
 * Windows COM adapter: Node -> powershell.exe -> COM Illustrator.Application.DoJavaScriptFile.
 * DoJavaScriptFile is documented in Adobe's "Illustrator Scripting Reference: VBScript".
 * Each call is a short-lived PowerShell process, so a hung COM call can be killed on timeout
 * without taking the MCP server down.
 */
export class ComAdapter implements BridgeAdapter {
  readonly name = "com" as const;

  constructor(private readonly opts: { autoLaunch: boolean }) {}

  detect(): Promise<DetectionResult> {
    return detectIllustrator();
  }

  async execute(req: ExecuteRequest): Promise<string> {
    if (process.platform !== "win32") {
      throw new McpDesignError("BRIDGE_UNAVAILABLE", "The COM Illustrator bridge only runs on Windows.");
    }
    const scriptPath = req.resultPath.replace(/\.json$/, ".jsx");
    await writeFile(scriptPath, req.script, "utf8");
    const runner = join(SCRIPT_DIR, "run-jsx.ps1");
    const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", runner,
      "-ScriptPath", scriptPath, "-ResultPath", req.resultPath];
    if (!this.opts.autoLaunch) args.push("-NoLaunch");

    await new Promise<void>((resolve, reject) => {
      const child = spawn("powershell.exe", args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
      const timer = setTimeout(() => {
        child.kill();
        reject(
          new McpDesignError(
            "BRIDGE_TIMEOUT",
            `Illustrator did not respond within ${req.timeoutMs} ms. The operation may still complete inside Illustrator; inspect the document before retrying.`,
          ),
        );
      }, req.timeoutMs);
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(new McpDesignError("BRIDGE_UNAVAILABLE", `Could not start PowerShell: ${err.message}`));
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        if (stderr.trim()) logger.warn("PowerShell stderr", { stderr: stderr.trim().slice(0, 2000) });
        if (code !== 0) reject(new McpDesignError("BRIDGE_UNAVAILABLE", `PowerShell runner exited with code ${code}: ${stderr.trim()}`));
        else resolve();
      });
    });

    if (!existsSync(req.resultPath)) {
      throw new McpDesignError("ILLUSTRATOR_SCRIPT_ERROR", "Illustrator produced no result file.");
    }
    return readFileSync(req.resultPath, "utf8").replace(/^\uFEFF/, "");
  }
}
