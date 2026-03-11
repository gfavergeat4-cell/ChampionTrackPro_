/**
 * check-responses.js
 * Diagnoses collectionGroup("responses") zero-result issue.
 * Uses Firestore REST API (no service-account.json in this project —
 * functions use admin.initializeApp() with ADC; credentials come from
 * firebase-tools OAuth session for local scripts).
 */
const https = require("https");
const fs    = require("fs");
const path  = require("path");

const CFG_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME,
  ".config", "configstore", "firebase-tools.json"
);
const PROJECT = "championtrackpro";
const TEAM_ID = "Ri8kpStgWp9yymtS71tb";

function getToken() {
  return JSON.parse(fs.readFileSync(CFG_PATH, "utf8")).tokens.access_token;
}

function runQuery(token, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: "firestore.googleapis.com",
      path: `/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString());
          resolve(Array.isArray(parsed) ? parsed.filter(r => r.document) : []);
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function fieldVal(fields, key) {
  if (!fields[key]) return undefined;
  const f = fields[key];
  if (f.stringValue  !== undefined) return f.stringValue;
  if (f.booleanValue !== undefined) return f.booleanValue;
  if (f.nullValue    !== undefined) return null;
  if (f.integerValue !== undefined) return parseInt(f.integerValue, 10);
  return f;
}

async function check() {
  const token = getToken();

  // ── Test 1: no filter ───────────────────────────────────────────────────
  const r1 = await runQuery(token, {
    structuredQuery: {
      from: [{ collectionId: "responses", allDescendants: true }],
      limit: 10,
    },
  });
  console.log("1. Total responses no filter:", r1.length);
  r1.forEach(({ document: doc }) => {
    const f = doc.fields || {};
    const teamId = fieldVal(f, "teamId");
    const isTest = fieldVal(f, "isTest");
    console.log("   path:", doc.name.split("/documents/")[1]);
    console.log("   teamId:", teamId !== undefined ? teamId : "MISSING");
    console.log("   isTest:", isTest !== undefined ? isTest : "MISSING");
    console.log("   submittedAt:", (f.submittedAt || {}).timestampValue || "MISSING");
  });

  // ── Test 2: teamId filter ────────────────────────────────────────────────
  const r2 = await runQuery(token, {
    structuredQuery: {
      from: [{ collectionId: "responses", allDescendants: true }],
      where: {
        fieldFilter: {
          field: { fieldPath: "teamId" },
          op: "EQUAL",
          value: { stringValue: TEAM_ID },
        },
      },
      limit: 5,
    },
  });
  console.log("2. Responses with teamId:", r2.length);

  // ── Test 3: teamId + isTest == false ─────────────────────────────────────
  const r3 = await runQuery(token, {
    structuredQuery: {
      from: [{ collectionId: "responses", allDescendants: true }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "teamId" }, op: "EQUAL", value: { stringValue: TEAM_ID } } },
            { fieldFilter: { field: { fieldPath: "isTest" }, op: "EQUAL", value: { booleanValue: false } } },
          ],
        },
      },
      limit: 5,
    },
  });
  console.log("3. Responses isTest==false:", r3.length);

  // ── Test 4: teamId + isTest in [false, null] ──────────────────────────────
  const r4 = await runQuery(token, {
    structuredQuery: {
      from: [{ collectionId: "responses", allDescendants: true }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "teamId" }, op: "EQUAL", value: { stringValue: TEAM_ID } } },
            { fieldFilter: {
              field: { fieldPath: "isTest" },
              op: "IN",
              value: { arrayValue: { values: [{ booleanValue: false }, { nullValue: "NULL_VALUE" }] } },
            }},
          ],
        },
      },
      limit: 5,
    },
  });
  console.log("4. Responses isTest in [false,null]:", r4.length);

  // ── Diagnosis ─────────────────────────────────────────────────────────────
  console.log("\n=== DIAGNOSIS ===");
  if (r1.length === 0) {
    console.log("CASE A: No responses at all — seed data needed.");
  } else if (r2.length === 0) {
    // Check if teamId is actually missing
    const missingTeamId = r1.filter(({ document: doc }) => {
      const f = doc.fields || {};
      return fieldVal(f, "teamId") === undefined;
    });
    if (missingTeamId.length === r1.length) {
      console.log("CASE B: teamId field MISSING on all docs — migration needed.");
    } else {
      console.log("CASE D: teamId present but filter returns 0 — INDEX MISSING or still building.");
      console.log("        Run: firebase deploy --only firestore:indexes");
      console.log("        Wait ~1-2 min for index to build.");
    }
  } else if (r2.length > 0 && r3.length === 0 && r4.length === 0) {
    console.log("CASE C: Responses exist with teamId but isTest field MISSING.");
    console.log("        Fix: remove .where('isTest','==',false) from dashboard query.");
  } else {
    console.log("Data looks correct. Check date range in dashboard (default 30d).");
  }
}

check().catch(err => {
  console.error("ERROR:", err.message || err);
  process.exit(1);
});
