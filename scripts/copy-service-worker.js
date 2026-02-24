const fs = require("fs");
const path = require("path");

function copy(src, dst) {
  if (!fs.existsSync(src)) {
    console.error("❌ Missing:", src);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log("✅ Copied:", src, "->", dst);
}

// Vercel serves web/dist (outputDirectory)
const distRoot = path.join(process.cwd(), "web", "dist");

// Service worker
const srcSw = path.join(process.cwd(), "public", "firebase-messaging-sw.js");
const dstSw = path.join(distRoot, "firebase-messaging-sw.js");
copy(srcSw, dstSw);

// PWA manifest and icons (so /manifest.json and /icons/* are served)
const srcManifest = path.join(process.cwd(), "public", "manifest.json");
const dstManifest = path.join(distRoot, "manifest.json");
if (fs.existsSync(srcManifest)) {
  fs.mkdirSync(path.dirname(dstManifest), { recursive: true });
  fs.copyFileSync(srcManifest, dstManifest);
  console.log("✅ Copied:", srcManifest, "->", dstManifest);
}
const srcIcons = path.join(process.cwd(), "public", "icons");
const dstIcons = path.join(distRoot, "icons");
if (fs.existsSync(srcIcons)) {
  fs.mkdirSync(dstIcons, { recursive: true });
  fs.readdirSync(srcIcons).forEach((f) => {
    const s = path.join(srcIcons, f);
    const d = path.join(dstIcons, f);
    if (fs.statSync(s).isFile()) {
      fs.copyFileSync(s, d);
      console.log("✅ Copied:", s, "->", d);
    }
  });
}

// Quick sanity check: ensure SW is ESM (no importScripts)
const swTxt = fs.readFileSync(dstSw, "utf8");
if (swTxt.includes("importScripts")) {
  console.error("❌ SW in dist still contains importScripts (should be ESM).");
  process.exit(1);
}
console.log("✅ SW in dist is ESM (no importScripts).");
