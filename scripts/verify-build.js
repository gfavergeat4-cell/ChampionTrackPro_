const fs = require("fs");
const path = require("path");

function ok(msg) { console.log("[VERIFY] ✅ " + msg); }
function fail(msg) { console.error("[VERIFY] ❌ " + msg); process.exitCode = 1; }

function mustExist(p) {
  if (!fs.existsSync(p)) fail("Missing file: " + p);
  else ok(p + " - " + fs.statSync(p).size + " bytes");
}

console.log("[VERIFY] ===== Verifying Build Artifacts (ESM ONLY) =====");

const distRoot = path.join(process.cwd(), "web", "dist");

// Required files for Vercel static hosting (no local Firebase SDK; SW uses gstatic)
const required = [
  path.join(distRoot, "index.html"),
  path.join(distRoot, "firebase-messaging-sw.js"),
  path.join(distRoot, "manifest.json"),
];

required.forEach(mustExist);

// Validate SW content (must be ESM, must not be compat/importScripts)
const swPath = path.join(distRoot, "firebase-messaging-sw.js");
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, "utf8");

  if (sw.includes("importScripts")) fail("Service worker must NOT use importScripts (ESM only).");
  else ok("SW has no importScripts");

  if (sw.includes("compat")) fail("Service worker must NOT reference compat.");
  else ok("SW has no compat references");

  if (sw.includes("import {") || sw.includes('type: "module"')) ok("SW uses ESM (import { or type: module)");
  else fail("Service worker SHOULD use ESM imports (e.g. import {).");
}

// Ensure no compat script files exist (we use ESM-only; SDK bundles may contain "compat" in package names)
const firebaseDir = path.join(distRoot, "firebase");
if (fs.existsSync(firebaseDir)) {
  const files = fs.readdirSync(firebaseDir);
  const compatFiles = files.filter((f) => f.endsWith("-compat.js"));
  if (compatFiles.length > 0) fail("No *-compat.js files allowed in web/dist/firebase: " + compatFiles.join(", "));
  else ok("No compat script files in firebase/ (ESM only)");
}

if (process.exitCode) {
  console.error("[VERIFY] ❌ BUILD VERIFICATION FAILED");
  process.exit(1);
} else {
  console.log("[VERIFY] ✅ BUILD VERIFICATION PASSED");
}
