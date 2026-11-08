import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { DetectionResult, IllustratorInstall } from "./types.js";

const run = promisify(execFile);

const VERSION_NAMES: Record<string, string> = {
  "2020": "24", "2021": "25", "2022": "26", "2023": "27", "2024": "28", "2025": "29", "2026": "30", "2027": "31",
};

export function findInstalls(roots: string[] = [process.env.ProgramFiles ?? "C:\\Program Files"]): IllustratorInstall[] {
  const installs: IllustratorInstall[] = [];
  for (const root of roots) {
    const adobe = join(root, "Adobe");
    if (!existsSync(adobe)) continue;
    for (const dir of readdirSync(adobe)) {
      if (!/^Adobe Illustrator/i.test(dir)) continue;
      const exe = join(adobe, dir, "Support Files", "Contents", "Windows", "Illustrator.exe");
      if (!existsSync(exe)) continue;
      const year = /(\d{4})/.exec(dir)?.[1];
      const cc = /CC\s*(\d{4})?/i.test(dir);
      installs.push({
        version: year ? `${year} (v${VERSION_NAMES[year] ?? "?"})` : cc ? "CC" : dir.replace(/^Adobe Illustrator\s*/i, "") || "unknown",
        path: join(adobe, dir),
        executable: exe,
      });
    }
  }
  return installs.sort((a, b) => b.version.localeCompare(a.version));
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
  if (process.platform !== "win32") {
    return {
      platform: process.platform, installs: [], comRegistered: false, running: false,
      notes: ["The COM bridge supports Windows only. macOS would need an AppleScript adapter (not implemented)."],
    };
  }
  const installs = findInstalls(
    [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter((p): p is string => Boolean(p)),
  );
  const com = await comRegistration();
  const running = await isIllustratorRunning();
  if (installs.length === 0) notes.push("No Illustrator installation found under Program Files\\Adobe.");
  if (!com.registered) notes.push("COM class Illustrator.Application is not registered; scripting cannot start Illustrator.");
  return { platform: process.platform, installs, comRegistered: com.registered, comProgId: com.progId, running, notes };
}
