// Quick deploy script — run with: bun run deploy-fix.ts
import { $ } from "bun";

console.log("Killing old server...");
await $`sudo sh -c 'lsof -t -iTCP:3000 -sTCP:LISTEN | xargs -r kill -9'`.nothrow();

console.log("Cleaning dist and db...");
await $`rm -rf dist src/db/behaviortrack.db src/db/behaviortrack.db-shm src/db/behaviortrack.db-wal`.nothrow();

console.log("Building...");
const build = await $`bun run build`.nothrow();
console.log("Build exit:", build.exitCode);

console.log("Starting server...");
const proc = Bun.spawn(["bun", "run", "start"], {
  cwd: "/home/team/shared/site",
  stdout: "pipe",
  stderr: "pipe",
});

// Wait briefly then test
await Bun.sleep(2000);

try {
  const res = await fetch("http://localhost:3000/");
  console.log("Server status:", res.status);
} catch (e) {
  console.log("Server not responding:", e);
}

// Detach
proc.unref();
console.log("Done.");
