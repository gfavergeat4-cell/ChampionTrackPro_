/**
 * fix-coach-role.js
 * Reads current user doc and sets role: "coach" + teamId.
 * Uses Firestore REST API (no service-account.json in this project).
 */
const https = require("https");
const fs    = require("fs");
const os    = require("os");
const path  = require("path");

const CFG = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
const PROJECT  = "championtrackpro";
const COACH_UID = "fqXEQa0rjPdQcsCEcORWefOSzWw1";
const TEAM_ID   = "Ri8kpStgWp9yymtS71tb";

function getToken() {
  return JSON.parse(fs.readFileSync(CFG, "utf8")).tokens.access_token;
}

function restGet(token, path) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: "firestore.googleapis.com", path, method: "GET",
      headers: { Authorization: "Bearer " + token } };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch(e) { reject(e); } });
    });
    req.on("error", reject);
    req.end();
  });
}

function restPatch(token, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: "firestore.googleapis.com", path, method: "PATCH",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch(e) { reject(e); } });
    });
    req.on("error", reject);
    req.write(data); req.end();
  });
}

async function fix() {
  const token = getToken();
  const docPath = `/v1/projects/${PROJECT}/databases/(default)/documents/users/${COACH_UID}`;

  // Read current state
  const doc = await restGet(token, docPath);
  const f = doc.fields || {};
  console.log("Current user doc:");
  Object.keys(f).forEach(k => {
    const v = f[k];
    const val = v.stringValue ?? v.booleanValue ?? v.integerValue ?? v.timestampValue ?? JSON.stringify(v);
    console.log(`  ${k}: ${val}`);
  });

  const currentRole = (f.role || {}).stringValue;
  console.log("\n>>> Current role:", currentRole);

  if (currentRole === "coach") {
    console.log("✅ Role is already 'coach' — no change needed.");
  } else {
    console.log("⚠️  Role is '" + currentRole + "' — fixing to 'coach'...");
    // PATCH with updateMask to only touch role + teamId
    const updated = await restPatch(token,
      docPath + "?updateMask.fieldPaths=role&updateMask.fieldPaths=teamId",
      {
        fields: {
          role:   { stringValue: "coach" },
          teamId: { stringValue: TEAM_ID },
        }
      }
    );
    const uf = updated.fields || {};
    console.log("✅ role set to:", (uf.role || {}).stringValue);
    console.log("✅ teamId set to:", (uf.teamId || {}).stringValue);
  }

  // Final verify
  const verify = await restGet(token, docPath);
  const vf = verify.fields || {};
  console.log("\nVerification:");
  console.log("  role:", (vf.role || {}).stringValue);
  console.log("  teamId:", (vf.teamId || {}).stringValue);
}

fix().catch(err => { console.error("ERROR:", err.message || err); process.exit(1); });
