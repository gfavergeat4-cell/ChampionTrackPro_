const fs = require("fs");
const path = require("path");

function copy(src, dst) {
  if (!fs.existsSync(src)) {
    console.error("FAIL Missing:", src);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log("OK Copied:", src, "->", dst);
}

const distRoot = path.join(process.cwd(), "web", "dist");

const srcSw = path.join(process.cwd(), "public", "firebase-messaging-sw.js");
const dstSw = path.join(distRoot, "firebase-messaging-sw.js");
copy(srcSw, dstSw);

const srcManifest = path.join(process.cwd(), "public", "manifest.json");
const dstManifest = path.join(distRoot, "manifest.json");
if (fs.existsSync(srcManifest)) {
  fs.mkdirSync(path.dirname(dstManifest), { recursive: true });
  fs.copyFileSync(srcManifest, dstManifest);
  console.log("OK Copied:", srcManifest, "->", dstManifest);
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
      console.log("OK Copied:", s, "->", d);
    }
  });
}

// Validation: SW doit utiliser importScripts (mode classique pour Android/Chrome)
const swTxt = fs.readFileSync(dstSw, "utf8");
if (swTxt.includes("importScripts")) {
  console.log("OK SW uses importScripts (classic mode) - correct for background notifications.");
} else {
  console.error("FAIL SW must use importScripts for background notifications to work.");
  process.exit(1);
}
