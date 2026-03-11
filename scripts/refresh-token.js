/**
 * refresh-token.js — refreshes the firebase-tools OAuth token and saves it back.
 */
const https = require("https");
const fs    = require("path");
const os    = require("os");

const CFG_PATH = require("path").join(os.homedir(), ".config", "configstore", "firebase-tools.json");
const cfg = JSON.parse(require("fs").readFileSync(CFG_PATH, "utf8"));
const refresh = cfg.tokens.refresh_token;

const body = [
  "client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
  "client_secret=j9iVZfS8kkCEFUPaAeJV0sAi",
  "grant_type=refresh_token",
  "refresh_token=" + encodeURIComponent(refresh),
].join("&");

const opts = {
  hostname: "oauth2.googleapis.com",
  path: "/token",
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "Content-Length": Buffer.byteLength(body),
  },
};

const req = https.request(opts, (res) => {
  const chunks = [];
  res.on("data", c => chunks.push(c));
  res.on("end", () => {
    const d = JSON.parse(Buffer.concat(chunks).toString());
    if (d.access_token) {
      cfg.tokens.access_token = d.access_token;
      cfg.tokens.expires_at = Date.now() + d.expires_in * 1000;
      require("fs").writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2));
      console.log("✔ Token refreshed. Expires in", d.expires_in, "s");
      console.log("  New token prefix:", d.access_token.slice(0, 30));
    } else {
      console.error("Refresh failed:", JSON.stringify(d).slice(0, 300));
      process.exit(1);
    }
  });
});
req.on("error", err => { console.error(err.message); process.exit(1); });
req.write(body);
req.end();
