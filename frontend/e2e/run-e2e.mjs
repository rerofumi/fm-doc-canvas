/**
 * WP-0 / Core E2E orchestrator.
 * Starts Wails dev with isolated temp root, waits for ready URL + binding health,
 * runs Playwright, then cleans up the process tree on success or failure.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(frontendDir, "..");

const PORT = Number(process.env.FM_E2E_PORT || 34115);
const BASE_URL = process.env.FM_E2E_BASE_URL || `http://127.0.0.1:${PORT}`;
const READY_TIMEOUT_MS = Number(process.env.FM_E2E_READY_TIMEOUT_MS || 180_000);
const BROWSER_CHANNEL = process.env.FM_E2E_BROWSER_CHANNEL || "msedge";

function log(msg) {
  console.log(`[e2e] ${msg}`);
}

function fail(msg, code = 1) {
  console.error(`[e2e] ${msg}`);
  process.exitCode = code;
}

async function pathExists(p) {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpGet(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 500, status: res.statusCode });
    });
    req.on("error", () => resolve({ ok: false, status: 0 }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: 0 });
    });
  });
}

async function waitForReady(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await httpGet(url);
    if (r.ok) return true;
    await sleep(1000);
  }
  return false;
}

function spawnTracked(command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: false,
  });
  child.stdout.on("data", (d) => process.stdout.write(d));
  child.stderr.on("data", (d) => process.stderr.write(d));
  return child;
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawnTracked(command, args, {
      cwd: options.cwd || repoRoot,
      env: options.env || process.env,
      shell: true,
    });
    const pids = new Set();
    if (child.pid) pids.add(child.pid);
    child.on("exit", (code, signal) => {
      resolve({ code: code ?? (signal ? 1 : 0), child, pids });
    });
  });
}

async function killTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
        shell: true,
      });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* ignore */
    }
  }
}

async function snapshotAppDataMeta(appDataDir) {
  if (!(await pathExists(appDataDir))) {
    return { exists: false };
  }
  const st = await fs.promises.stat(appDataDir);
  return { exists: true, mtimeMs: st.mtimeMs, size: st.size };
}

async function main() {
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "fm-doc-canvas-e2e-"));
  const marker = path.join(tempRoot, "e2e-marker.txt");
  await fs.promises.writeFile(marker, `e2e ${new Date().toISOString()}\n`, "utf8");
  await fs.promises.mkdir(path.join(tempRoot, "save"), { recursive: true });
  await fs.promises.mkdir(path.join(tempRoot, "fixtures"), { recursive: true });
  await fs.promises.mkdir(path.join(tempRoot, "Image"), { recursive: true });
  await fs.promises.writeFile(
    path.join(tempRoot, "fixtures", "workspace.json"),
    JSON.stringify({ version: "1.3", metadata: { workspaceId: "seed", rootCanvasId: "root", currentCanvasId: "root" }, canvases: [{ id: "root", name: "Workspace" }], nodes: [], relations: [] }, null, 2),
    "utf8",
  );

  const realAppData = process.env.APPDATA
    ? path.join(process.env.APPDATA, "fm-doc-canvas")
    : "";
  const beforeMeta = realAppData ? await snapshotAppDataMeta(realAppData) : null;

  log(`temp root: ${tempRoot}`);
  log(`base URL: ${BASE_URL}`);
  log(`browser channel: ${BROWSER_CHANNEL}`);

  const env = {
    ...process.env,
    FM_E2E: "1",
    FM_E2E_TEMP_ROOT: tempRoot,
    FM_E2E_BASE_URL: BASE_URL,
    FM_E2E_BROWSER_CHANNEL: BROWSER_CHANNEL,
    // Do not pass provider credentials into the child process.
    OPENAI_API_KEY: "",
    OPENROUTER_API_KEY: "",
    GOOGLE_API_KEY: "",
    XAI_API_KEY: "",
    GEMINI_API_KEY: "",
  };

  // Avoid accidental go.mod / frontend install side effects during smoke.
  const wailsArgs = [
    "dev",
    "-m",
    "-nosyncgomod",
    "-noreload",
    "-nogorebuild",
    "-nocolour",
    "-devserver",
    `127.0.0.1:${PORT}`,
    "-viteservertimeout",
    "60",
  ];

  log("starting wails dev...");
  const wails = spawnTracked("mise", ["x", "--", "wails", ...wailsArgs], {
    cwd: repoRoot,
    env,
    shell: true,
  });

  let exitCode = 1;
  try {
    const ready = await waitForReady(BASE_URL, READY_TIMEOUT_MS);
    if (!ready) {
      throw new Error(`Wails dev server not ready at ${BASE_URL} within ${READY_TIMEOUT_MS}ms`);
    }
    log("server ready; running playwright CE2E suite...");

const pw = await run(
      "mise",
      [
        "x",
        "--",
        "npx",
        "playwright",
        "test",
        "-c",
        "playwright.config.ts",
        ".",
      ],
      { cwd: frontendDir, env },
    );
    exitCode = pw.code;
    if (exitCode === 0) {
      log("playwright CE2E suite passed");
    } else {
      fail(`playwright exited with code ${exitCode}`, exitCode);
    }

    if (realAppData && beforeMeta) {
      const afterMeta = await snapshotAppDataMeta(realAppData);
      if (beforeMeta.exists !== afterMeta.exists) {
        fail("real AppData fm-doc-canvas existence changed during e2e", 1);
        exitCode = exitCode || 1;
      } else if (
        beforeMeta.exists &&
        (beforeMeta.mtimeMs !== afterMeta.mtimeMs || beforeMeta.size !== afterMeta.size)
      ) {
        // Directory mtime can change from unrelated activity; only warn for WP-0.
        log(
          "note: real AppData directory metadata changed; inspect manually if unexpected",
        );
      }
    }
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err), 1);
    exitCode = 1;
  } finally {
    log("cleaning up wails process tree...");
    await killTree(wails.pid);
    // Best-effort: also stop stray children that may have detached.
    await sleep(500);
    try {
      // Keep temp root for failure artifacts if requested.
      if (exitCode === 0 && process.env.FM_E2E_KEEP_TEMP !== "1") {
        await fs.promises.rm(tempRoot, { recursive: true, force: true });
        log("temp root removed");
      } else {
        log(`temp root kept: ${tempRoot}`);
      }
    } catch (e) {
      log(`temp cleanup warning: ${e}`);
    }
  }

  process.exit(exitCode);
}

main();

