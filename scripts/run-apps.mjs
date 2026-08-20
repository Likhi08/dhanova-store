import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

const mode = process.argv[2] === "start" ? "start" : "dev";
const npmCli = process.env.npm_execpath || join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const backendHealthUrl = process.env.BACKEND_HEALTH_URL ?? "http://127.0.0.1:4000/api/health";
const children = [];

let stopping = false;

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const { child } of children) {
    if (!child.killed) child.kill();
  }
  process.exitCode = exitCode;
}

function startApplication(name, directory) {
  const child = spawn(process.execPath, [npmCli, "--prefix", directory, "run", mode], {
    stdio: "inherit",
  });

  children.push({ name, child });
  child.on("error", (error) => console.error(`[${name}] failed to start:`, error.message));
  child.on("exit", (code, signal) => {
    if (stopping) return;
    if (signal) console.error(`[${name}] stopped by ${signal}.`);
    else console.error(`[${name}] exited with code ${code ?? 1}.`);
    stopAll(code ?? 1);
  });

  return child;
}

async function waitForBackend(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(backendHealthUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The API may still be binding its port or connecting to MongoDB.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Backend did not become ready at ${backendHealthUrl} within ${timeoutMs / 1_000} seconds.`);
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

try {
  startApplication("backend", "backend");
  await waitForBackend();
  console.log(`[backend] ready at ${backendHealthUrl}`);
  startApplication("frontend", "frontend");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stopAll(1);
}
