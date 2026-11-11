import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/index.js";
import { AppleScriptAdapter } from "../../src/illustrator/bridge/applescript-adapter.js";
import { ComAdapter } from "../../src/illustrator/bridge/com-adapter.js";
import { findInstalls, findMacInstalls, findWindowsInstalls } from "../../src/illustrator/bridge/detect.js";
import { MockAdapter } from "../../src/illustrator/bridge/mock-adapter.js";
import { createAdapter } from "../../src/server.js";

describe("adapter selection", () => {
  it("defaults ILLUSTRATOR_ADAPTER to auto", () => {
    expect(loadConfig({}, []).illustrator.adapter).toBe("auto");
  });

  it("createAdapter picks platform bridge for auto, and honors explicit names", () => {
    expect(createAdapter(loadConfig({ ILLUSTRATOR_ADAPTER: "mock" }, []))).toBeInstanceOf(MockAdapter);
    expect(createAdapter(loadConfig({ ILLUSTRATOR_ADAPTER: "com" }, []))).toBeInstanceOf(ComAdapter);
    expect(createAdapter(loadConfig({ ILLUSTRATOR_ADAPTER: "applescript" }, []))).toBeInstanceOf(AppleScriptAdapter);

    if (process.platform === "win32") {
      expect(createAdapter(loadConfig({ ILLUSTRATOR_ADAPTER: "auto" }, []))).toBeInstanceOf(ComAdapter);
    } else if (process.platform === "darwin") {
      expect(createAdapter(loadConfig({ ILLUSTRATOR_ADAPTER: "auto" }, []))).toBeInstanceOf(AppleScriptAdapter);
    } else {
      expect(() => createAdapter(loadConfig({ ILLUSTRATOR_ADAPTER: "auto" }, []))).toThrow(/No Illustrator bridge/);
    }
  });

  it("COM adapter refuses non-Windows execute; AppleScript refuses non-macOS execute", async () => {
    const req = { op: "status", args: {}, script: "", resultPath: "C:\\tmp\\x.json", timeoutMs: 1000 };
    if (process.platform !== "win32") {
      await expect(new ComAdapter({ autoLaunch: true }).execute(req)).rejects.toMatchObject({ code: "BRIDGE_UNAVAILABLE" });
    }
    if (process.platform !== "darwin") {
      await expect(new AppleScriptAdapter({ autoLaunch: true }).execute({ ...req, resultPath: "/tmp/x.json" })).rejects.toMatchObject({
        code: "BRIDGE_UNAVAILABLE",
      });
    }
  });
});

describe("install detection helpers", () => {
  it("findInstalls delegates by platform and returns an array", () => {
    const installs = findInstalls();
    expect(Array.isArray(installs)).toBe(true);
    if (process.platform === "darwin") expect(findMacInstalls()).toEqual(installs);
    if (process.platform === "win32") expect(findWindowsInstalls()).toEqual(installs);
  });
});
