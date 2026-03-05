'use strict';
/**
 * seedTestData.js
 * Generates realistic fake questionnaire responses in Firestore for testing
 * the Performance Dashboard.
 *
 * Usage: node scripts/seedTestData.js
 *
 * Uses the Firebase CLI access token (no service account needed).
 * Token is read from ~/.config/configstore/firebase-tools.json.
 * If expired, run `npx firebase login` first.
 */

const https = require('https');
const os    = require('os');
const path  = require('path');
const fs    = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────
const PROJECT_ID = 'championtrackpro';
const TEAM_ID    = 'Ri8kpStgWp9yymtS71tb';

// Use the 1 known real member + 2 fake athletes for variety
const ATHLETES = [
  { uid: 'kHc8EeLA7KOYMZEBITrOlEdIySj2', physBase: 70, mentalBase: 65, techBase: 75 },
  { uid: 'test_athlete_2',               physBase: 65, mentalBase: 78, techBase: 68 },
  { uid: 'test_athlete_3',               physBase: 74, mentalBase: 66, techBase: 72 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function clamp(v, lo = 20, hi = 95) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** Sine-wave fatigue cycle: peaks around day 7 of each 14-day block. */
function fatiguePeak(dayIdx) {
  return Math.sin((dayIdx % 14) / 14 * Math.PI); // 0 → 1 → 0
}

/** Uniform random noise in [-range, +range]. */
function jitter(range) {
  return (Math.random() - 0.5) * 2 * range;
}

/**
 * Generates a single indicator value.
 * @param {number} base        - Athlete baseline for this category
 * @param {boolean} riseWithLoad - true = value goes UP with fatigue (effort/pain metrics)
 *                                false = value goes DOWN with fatigue (recovery/mood metrics)
 * @param {number} dayIdx      - Day index from start of period
 */
function genValue(base, riseWithLoad, dayIdx) {
  const load = fatiguePeak(dayIdx);          // 0..1
  const badDay = Math.random() < 0.06;       // ~6% chance of a rough session
  const delta = riseWithLoad ? load * 22 : -load * 18;
  let val = base + delta + jitter(9);
  if (badDay) val -= 28;
  return clamp(val);
}

// ── Firestore REST field value helpers ───────────────────────────────────────
const fStr  = v => ({ stringValue: String(v) });
const fInt  = v => ({ integerValue: String(Math.round(v)) });
const fBool = v => ({ booleanValue: !!v });
const fTs   = d => ({ timestampValue: d.toISOString() });

// ── Document builders ─────────────────────────────────────────────────────────
function buildTraining(trainingId, startDate, endDate) {
  return {
    name: `projects/${PROJECT_ID}/databases/(default)/documents/teams/${TEAM_ID}/trainings/${trainingId}`,
    fields: {
      title:                  fStr('Training Session'),
      startUtc:               fTs(startDate),
      endUtc:                 fTs(endDate),
      teamId:                 fStr(TEAM_ID),
      status:                 fStr('CONFIRMED'),
      questionnaireNotified:  fBool(true),
    },
  };
}

function buildResponse(trainingId, athlete, dayIdx, submittedAt) {
  const { uid, physBase, mentalBase, techBase } = athlete;

  const vals = {
    // Physical — rise with load
    intensiteMoyenne:  genValue(physBase,      true,  dayIdx),
    hautesIntensites:  genValue(physBase - 4,  true,  dayIdx),
    impactCardiaque:   genValue(physBase + 6,  true,  dayIdx),
    impactMusculaire:  genValue(physBase + 2,  true,  dayIdx),
    fatigue:           genValue(physBase + 10, true,  dayIdx),
    // Mental — fall with load (recovery metrics)
    concentration:     genValue(mentalBase,     false, dayIdx),
    confiance:         genValue(mentalBase + 6, false, dayIdx),
    bienEtre:          genValue(mentalBase - 4, false, dayIdx),
    nervosite:         genValue(mentalBase - 8, true,  dayIdx), // rises with load
    sommeil:           genValue(mentalBase + 8, false, dayIdx),
    // Technical — slightly correlated with wellbeing
    technique:         genValue(techBase,       false, dayIdx),
    tactique:          genValue(techBase - 2,   false, dayIdx),
    dynamisme:         genValue(techBase + 4,   false, dayIdx),
  };

  const fields = {
    userId:      fStr(uid),
    teamId:      fStr(TEAM_ID),
    trainingId:  fStr(trainingId),
    status:      fStr('completed'),
    submittedAt: fTs(submittedAt),
  };
  for (const [k, v] of Object.entries(vals)) fields[k] = fInt(v);

  return {
    name: `projects/${PROJECT_ID}/databases/(default)/documents/teams/${TEAM_ID}/trainings/${trainingId}/responses/${uid}`,
    fields,
  };
}

// ── Firestore batchWrite ──────────────────────────────────────────────────────
function batchWrite(token, writes) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ writes });
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`,
      method: 'POST',
      headers: {
        Authorization:   `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(data));
        else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 400)}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Token helpers ─────────────────────────────────────────────────────────────
function readTokenConfig() {
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

/** Refresh the access token using the stored refresh_token. */
function refreshAccessToken(refreshToken) {
  return new Promise((resolve, reject) => {
    // Firebase CLI uses Google OAuth2 client credentials
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8pio8EmAFuGRFlB',
    }).toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(data).access_token);
        else reject(new Error(`Token refresh failed HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getValidToken() {
  const cfg = readTokenConfig();
  let token = cfg.tokens?.access_token;

  // Quick liveness check — try a lightweight Firestore read
  const checkOk = await new Promise((resolve) => {
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/teams/${TEAM_ID}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    };
    const req = https.request(options, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.end();
  });

  if (!checkOk) {
    console.log('⚠️  Access token expired — refreshing...');
    const refreshToken = cfg.tokens?.refresh_token;
    if (!refreshToken) throw new Error('No refresh_token found. Run: npx firebase login');
    token = await refreshAccessToken(refreshToken);
    console.log('✅ Token refreshed.');
  }

  return token;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding Firestore with test data...');
  console.log(`   Team:     ${TEAM_ID}`);
  console.log(`   Athletes: ${ATHLETES.map(a => a.uid).join(', ')}\n`);

  const token = await getValidToken();

  // Generate training sessions: last 90 days, every 2-3 days
  const sessions = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 90);
  cursor.setHours(10, 0, 0, 0);

  let dayIdx = 0;
  const now = new Date();
  while (cursor < now) {
    const startDate = new Date(cursor);
    const endDate   = new Date(cursor.getTime() + 60 * 60 * 1000); // +1 h
    const trainingId = `seed_${startDate.toISOString().slice(0, 10)}_d${dayIdx}`;
    sessions.push({ trainingId, startDate, endDate, dayIdx });

    const gap = 2 + Math.floor(Math.random() * 2); // 2 or 3 days
    cursor.setDate(cursor.getDate() + gap);
    dayIdx += gap;
  }

  // Build write operations
  const writes = [];
  for (const { trainingId, startDate, endDate, dayIdx } of sessions) {
    writes.push({ update: buildTraining(trainingId, startDate, endDate) });
    for (const athlete of ATHLETES) {
      // Response submitted 0-3 h after training end
      const submittedAt = new Date(endDate.getTime() + Math.random() * 3 * 60 * 60 * 1000);
      writes.push({ update: buildResponse(trainingId, athlete, dayIdx, submittedAt) });
    }
  }

  console.log(`📦 ${sessions.length} training sessions × ${ATHLETES.length} athletes`);
  console.log(`📝 Total writes: ${writes.length}\n`);

  // Send in batches of 500 (Firestore limit)
  const BATCH = 500;
  let done = 0;
  for (let i = 0; i < writes.length; i += BATCH) {
    await batchWrite(token, writes.slice(i, i + BATCH));
    done += Math.min(BATCH, writes.length - i);
    process.stdout.write(`\r   ✓ ${done}/${writes.length} documents written`);
  }

  console.log('\n');
  console.log('✅ Seed complete!');
  console.log(`   Training documents : ${sessions.length}`);
  console.log(`   Response documents : ${sessions.length * ATHLETES.length}`);
  console.log(`   Total documents    : ${writes.length}`);
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
