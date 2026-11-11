import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { DetectionResult, IllustratorInstall } from "./types.js";

const run = promisify(execFile);

const VERSION_NAMES: Record<string, string> = {
  "2020": "24", "2021": "25", "2022": "26", "2023": "27", "2024": "28", "2025": "29", "2026": "30", "2027": "31",
};

function versionLabel(dir: string): string {
  const year = /(\d{4})/.exec(dir)?.[1];
  const cc = /CC\s*(\d{4})?/i.test(dir);
  if (year) return `${year} (v${VERSION_NAMES[year] ?? "?"})`;
  if (cc) return "CC";
  return dir.replace(/^Adobe Illustrator\s*/i, "").replace(/\.app$/i, "") || "unknown";
}

/** Windows: Program Files\Adobe\Adobe Illustrator *\...\Illustrator.exe */
export function findWindowsInstalls(roots: string[] = [process.env.ProgramFiles ?? "C:\\Program Files"]): IllustratorInstall[] {
  const installs: IllustratorInstall[] = [];
  for (const root of roots) {
    const adobe = join(root, "Adobe");
    if (!existsSync(adobe)) continue;
    for (const dir of readdirSync(adobe)) {
      if (!/^Adobe Illustrator/i.test(dir)) continue;
      const exe = join(adobe, dir, "Support Files", "Contents", "Windows", "Illustrator.exe");
      if (!existsSync(exe)) continue;
      installs.push({ version: versionLabel(dir), path: join(adobe, dir), executable: exe });
    }
  }
  return installs.sort((a, b) => b.version.localeCompare(a.version));
}

/** macOS: Adobe Illustrator.app under /Applications or ~/Applications. */
export function findMacInstalls(roots: string[] = ["/Applications", join(homedir(), "Applications")]): IllustratorInstall[] {
  const installs: IllustratorInstall[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root)) {
      if (!/^Adobe Illustrator/i.test(dir)) continue;
      const folder = join(root, dir);
      const app = dir.endsWith(".app") ? folder : join(folder, "Adobe Illustrator.app");
      if (!existsSync(app)) continue;
      installs.push({ version: versionLabel(dir), path: folder, executable: app });
    }
  }
  return installs.sort((a, b) => b.version.localeCompare(a.version));
}

/** @deprecated Prefer findWindowsInstalls / findMacInstalls; kept for existing imports. */
export function findInstalls(roots?: string[]): IllustratorInstall[] {
  if (process.platform === "darwin") return findMacInstalls(roots);
  return findWindowsInstalls(roots);
}

async function comRegistration(): Promise<{ registered: boolean; progId?: string }> {
  try {
    const { stdout } = await run("reg", ["query", "HKCR\\Illustrator.Application\\CurVer"], { windowsHide: true, timeout: 5000 });
    const progId = /REG_SZ\s+(\S+)/.exec(stdout)?.[1];
    return { registered: true, progId };
  } catch {
    try {
      await run("reg", ["query", "HKCR\\Illustrator.Application"], { windowsHide: true, timeout: 5000 });
      return { registered: true };
    } catch {
      return { registered: false };
    }
  }
}

export async function isIllustratorRunning(): Promise<boolean> {
  if (process.platform === "darwin") {
    try {
      await run("pgrep", ["-x", "Adobe Illustrator"], { timeout: 5000 });
      return true;
    } catch {
      try {
        const { stdout } = await run("pgrep", ["-if", "Adobe Illustrator"], { timeout: 5000 });
        return stdout.trim().length > 0;
      } catch {
        return false;
      }
    }
  }
  if (process.platform !== "win32") return false;
  try {
    const { stdout } = await run("tasklist", ["/FI", "IMAGENAME eq Illustrator.exe", "/FO", "CSV", "/NH"], {
      windowsHide: true,
      timeout: 5000,
    });
    return /Illustrator\.exe/i.test(stdout);
  } catch {
    return false;
  }
}

export async function detectIllustrator(): Promise<DetectionResult> {
  const notes: string[] = [];
  const running = await isIllustratorRunning();

  if (process.platform === "darwin") {
    const installs = findMacInstalls();
    const automationAvailable = installs.length > 0;
    if (installs.length === 0) notes.push("No Illustrator.app found under /Applications or ~/Applications.");
    else notes.push("macOS bridge uses AppleScript (application id com.adobe.illustrator → do javascript file).");
    if (!running && automationAvailable) notes.push("Illustrator is installed but not running; the first call may launch it unless ILLUSTRATOR_AUTO_LAUNCH=false.");
    return {
      platform: process.platform,
      installs,
      comRegistered: false,
      automationAvailable,
      bridge: "applescript",
      running,
      notes,
    };
  }

  if (process.platform !== "win32") {
    return {
      platform: process.platform,
      installs: [],
      comRegistered: false,
      automationAvailable: false,
      running: false,
      notes: [`Unsupported platform "${process.platform}". This MCP supports Windows (COM) and macOS (AppleScript).`],
    };
  }

  const installs = findWindowsInstalls(
    [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter((p): p is string => Boolean(p)),
  );
  const com = await comRegistration();
  if (installs.length === 0) notes.push("No Illustrator installation found under Program Files\\Adobe.");
  if (!com.registered) notes.push("COM class Illustrator.Application is not registered; scripting cannot start Illustrator.");
  else notes.push("Windows bridge uses COM (Illustrator.Application.DoJavaScriptFile).");
  return {
    platform: process.platform,
    installs,
    comRegistered: com.registered,
    comProgId: com.progId,
    automationAvailable: com.registered,
    bridge: "com",
    running,
    notes,
  };
}
