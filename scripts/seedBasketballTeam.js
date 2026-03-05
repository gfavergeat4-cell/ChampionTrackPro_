'use strict';
/**
 * seedBasketballTeam.js
 *
 * 1. Removes coach from athletes list (deletes member doc)
 * 2. Creates 10 realistic basketball athlete profiles (users + members)
 * 3. Seeds 90 days of training sessions + questionnaire responses
 *
 * Usage: node scripts/seedBasketballTeam.js
 */

const https = require('https');
const os    = require('os');
const path  = require('path');
const fs    = require('fs');

const PROJECT_ID = 'championtrackpro';
const TEAM_ID    = 'Ri8kpStgWp9yymtS71tb';

// Coach UID to remove from member list
const COACH_UID = 'fqXEQa0rjPdQcsCEc0RWef0SzWw1';

// 10 realistic basketball athlete profiles
const ATHLETES = [
  { uid: 'athlete_bkt_001', fullName: 'Marcus Johnson',  jerseyNumber: 1,  position: 'Point Guard',    physBase: 78, mentalBase: 72, techBase: 80 },
  { uid: 'athlete_bkt_002', fullName: 'Darius Williams', jerseyNumber: 3,  position: 'Shooting Guard', physBase: 74, mentalBase: 68, techBase: 76 },
  { uid: 'athlete_bkt_003', fullName: 'Jaylen Carter',   jerseyNumber: 7,  position: 'Small Forward',  physBase: 76, mentalBase: 70, techBase: 74 },
  { uid: 'athlete_bkt_004', fullName: 'Terrell Brooks',  jerseyNumber: 10, position: 'Power Forward',  physBase: 80, mentalBase: 65, techBase: 70 },
  { uid: 'athlete_bkt_005', fullName: 'Andre Mitchell',  jerseyNumber: 14, position: 'Center',         physBase: 82, mentalBase: 62, techBase: 68 },
  { uid: 'athlete_bkt_006', fullName: 'Kevin Thompson',  jerseyNumber: 22, position: 'Point Guard',    physBase: 72, mentalBase: 75, techBase: 78 },
  { uid: 'athlete_bkt_007', fullName: 'Isaiah Reed',     jerseyNumber: 25, position: 'Shooting Guard', physBase: 70, mentalBase: 73, techBase: 75 },
  { uid: 'athlete_bkt_008', fullName: 'DeShawn Harris',  jerseyNumber: 31, position: 'Small Forward',  physBase: 77, mentalBase: 69, techBase: 72 },
  { uid: 'athlete_bkt_009', fullName: 'Malik Foster',    jerseyNumber: 33, position: 'Power Forward',  physBase: 79, mentalBase: 66, techBase: 71 },
  { uid: 'athlete_bkt_010', fullName: 'Jordan Price',    jerseyNumber: 44, position: 'Center',         physBase: 83, mentalBase: 61, techBase: 67 },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function clamp(v, lo = 20, hi = 95) {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function fatiguePeak(dayIdx) {
  return Math.sin((dayIdx % 14) / 14 * Math.PI);
}

function jitter(range) {
  return (Math.random() - 0.5) * 2 * range;
}

function genValue(base, riseWithLoad, dayIdx) {
  const load = fatiguePeak(dayIdx);
  const badDay = Math.random() < 0.06;
  const delta = riseWithLoad ? load * 22 : -load * 18;
  let val = base + delta + jitter(9);
  if (badDay) val -= 28;
  return clamp(val);
}

// ── Firestore REST field value helpers ──────────────────────────────────────
const fStr  = v => ({ stringValue: String(v) });
const fInt  = v => ({ integerValue: String(Math.round(v)) });
const fBool = v => ({ booleanValue: !!v });
const fTs   = d => ({ timestampValue: d.toISOString() });

// ── Document builders ────────────────────────────────────────────────────────
function buildUserDoc(athlete) {
  return {
    name: `projects/${PROJECT_ID}/databases/(default)/documents/users/${athlete.uid}`,
    fields: {
      fullName:      fStr(athlete.fullName),
      displayName:   fStr(athlete.fullName),
      role:          fStr('athlete'),
      teamId:        fStr(TEAM_ID),
      position:      fStr(athlete.position),
      jerseyNumber:  fInt(athlete.jerseyNumber),
    },
  };
}

function buildMemberDoc(athlete) {
  return {
    name: `projects/${PROJECT_ID}/databases/(default)/documents/teams/${TEAM_ID}/members/${athlete.uid}`,
    fields: {
      fullName:      fStr(athlete.fullName),
      displayName:   fStr(athlete.fullName),
      role:          fStr('athlete'),
      position:      fStr(athlete.position),
      jerseyNumber:  fInt(athlete.jerseyNumber),
      teamId:        fStr(TEAM_ID),
    },
  };
}

function buildTraining(trainingId, startDate, endDate) {
  return {
    name: `projects/${PROJECT_ID}/databases/(default)/documents/teams/${TEAM_ID}/trainings/${trainingId}`,
    fields: {
      title:                 fStr('Training Session'),
      startUtc:              fTs(startDate),
      endUtc:                fTs(endDate),
      teamId:                fStr(TEAM_ID),
      status:                fStr('CONFIRMED'),
      questionnaireNotified: fBool(true),
    },
  };
}

function buildResponse(trainingId, athlete, dayIdx, submittedAt) {
  const { uid, physBase, mentalBase, techBase } = athlete;

  const vals = {
    intensiteMoyenne:  genValue(physBase,      true,  dayIdx),
    hautesIntensites:  genValue(physBase - 4,  true,  dayIdx),
    impactCardiaque:   genValue(physBase + 6,  true,  dayIdx),
    impactMusculaire:  genValue(physBase + 2,  true,  dayIdx),
    fatigue:           genValue(physBase + 10, true,  dayIdx),
    concentration:     genValue(mentalBase,     false, dayIdx),
    confiance:         genValue(mentalBase + 6, false, dayIdx),
    bienEtre:          genValue(mentalBase - 4, false, dayIdx),
    nervosite:         genValue(mentalBase - 8, true,  dayIdx),
    sommeil:           genValue(mentalBase + 8, false, dayIdx),
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

// ── Firestore REST helpers ───────────────────────────────────────────────────
function firestoreRequest(token, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'firestore.googleapis.com',
      path: urlPath,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {});
        } else {
          reject(new Error(`HTTP ${res.statusCode} ${method} ${urlPath}: ${data.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function batchWrite(token, writes) {
  return firestoreRequest(
    token,
    'POST',
    `/v1/projects/${PROJECT_ID}/databases/(default)/documents:batchWrite`,
    { writes }
  );
}

function deleteDocument(token, docPath) {
  return firestoreRequest(
    token,
    'DELETE',
    `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`,
    null
  );
}

// ── Token helpers ────────────────────────────────────────────────────────────
function readTokenConfig() {
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function refreshAccessToken(refreshToken) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
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
    console.log('Access token expired — refreshing...');
    const refreshToken = cfg.tokens?.refresh_token;
    if (!refreshToken) throw new Error('No refresh_token found. Run: npx firebase login');
    token = await refreshAccessToken(refreshToken);
    console.log('Token refreshed.');
  }

  return token;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Starting basketball team seed...');
  console.log(`Team: ${TEAM_ID}`);

  const token = await getValidToken();

  // Step 1: Remove coach from members
  console.log(`\nStep 1: Removing coach (${COACH_UID}) from members...`);
  try {
    await deleteDocument(token, `teams/${TEAM_ID}/members/${COACH_UID}`);
    console.log('  Coach member doc deleted.');
  } catch (e) {
    console.log(`  Note: ${e.message} (may not exist)`);
  }

  // Step 2: Create athlete profiles
  console.log('\nStep 2: Creating 10 athlete profiles (users + members)...');
  const profileWrites = [];
  for (const athlete of ATHLETES) {
    profileWrites.push({ update: buildUserDoc(athlete) });
    profileWrites.push({ update: buildMemberDoc(athlete) });
  }
  await batchWrite(token, profileWrites);
  console.log(`  Created ${ATHLETES.length} users + ${ATHLETES.length} member docs.`);

  // Step 3: Generate 90 days of training sessions
  console.log('\nStep 3: Generating 90 days of training + responses...');
  const sessions = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 90);
  cursor.setHours(10, 0, 0, 0);

  let dayIdx = 0;
  const now = new Date();
  while (cursor < now) {
    const startDate = new Date(cursor);
    const endDate   = new Date(cursor.getTime() + 60 * 60 * 1000);
    const trainingId = `bkt_${startDate.toISOString().slice(0, 10)}_d${dayIdx}`;
    sessions.push({ trainingId, startDate, endDate, dayIdx });

    const gap = 2 + Math.floor(Math.random() * 2);
    cursor.setDate(cursor.getDate() + gap);
    dayIdx += gap;
  }
  console.log(`  ${sessions.length} training sessions x ${ATHLETES.length} athletes`);

  const writes = [];
  for (const { trainingId, startDate, endDate, dayIdx: dIdx } of sessions) {
    writes.push({ update: buildTraining(trainingId, startDate, endDate) });
    for (const athlete of ATHLETES) {
      const submittedAt = new Date(endDate.getTime() + Math.random() * 3 * 60 * 60 * 1000);
      writes.push({ update: buildResponse(trainingId, athlete, dIdx, submittedAt) });
    }
  }

  console.log(`  Total response writes: ${writes.length}`);

  const BATCH = 500;
  let done = 0;
  for (let i = 0; i < writes.length; i += BATCH) {
    await batchWrite(token, writes.slice(i, i + BATCH));
    done += Math.min(BATCH, writes.length - i);
    process.stdout.write(`\r  Written: ${done}/${writes.length}`);
  }

  console.log('\n\nSeed complete!');
  console.log(`  Training docs : ${sessions.length}`);
  console.log(`  Response docs : ${sessions.length * ATHLETES.length}`);
  console.log(`  Profile docs  : ${ATHLETES.length * 2} (users + members)`);
}

main().catch(e => { console.error('\nERROR:', e.message); process.exit(1); });
