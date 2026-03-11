/**
 * seed-realistic-season.js
 * NCAA D2 basketball realistic season — Team Ri8kpStgWp9yymtS71tb
 * Nov 1 2025 → Feb 28 2026 | 12 athletes | ~1320 response docs
 *
 * Uses Firestore REST API with OAuth token from firebase-tools configstore
 * (same auth method as fix-coach-role.js / check-responses.js)
 */

const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

const CFG_PATH  = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const PROJECT   = 'championtrackpro';
const TEAM_ID   = 'Ri8kpStgWp9yymtS71tb';
const BASE_URL  = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// ─────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────
function getToken() {
  try {
    return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')).tokens.access_token;
  } catch (e) {
    console.error('❌ Could not read firebase-tools token. Run: firebase login');
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────
// REST helpers
// ─────────────────────────────────────────────────────────
function restRequest(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'firestore.googleapis.com',
      path:     urlPath,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString());
          if (parsed.error) return reject(new Error(`${parsed.error.code}: ${parsed.error.message}`));
          resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Firestore batch write (commitRequest)
// ops = array of { update: { name, fields } }
function batchWrite(ops, token) {
  const body = { writes: ops };
  return restRequest('POST', `/v1/projects/${PROJECT}/databases/(default)/documents:commit`, body, token);
}

// ─────────────────────────────────────────────────────────
// Firestore value encoders
// ─────────────────────────────────────────────────────────
const fStr  = v  => ({ stringValue: String(v) });
const fBool = v  => ({ booleanValue: Boolean(v) });
const fInt  = v  => ({ integerValue: String(Math.round(v)) });
const fTs   = ms => ({ timestampValue: new Date(ms).toISOString() });
const fMap  = obj => ({ mapValue: { fields: Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, v])) } });

function docPath(collection, id = '') {
  return `projects/${PROJECT}/databases/(default)/documents/${collection}${id ? '/' + id : ''}`;
}

// Encode a full document fields object
function encodeDoc(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string')  { fields[k] = fStr(v);  continue; }
    if (typeof v === 'boolean') { fields[k] = fBool(v); continue; }
    if (typeof v === 'number')  { fields[k] = fInt(v);  continue; }
    if (v instanceof Date)      { fields[k] = fTs(v.getTime()); continue; }
    if (typeof v === 'object' && !Array.isArray(v)) {
      // nested map (e.g. metrics)
      fields[k] = fMap(encodeDoc(v));
      continue;
    }
  }
  return fields;
}

// Build a write op for batchWrite
function writeOp(collectionPath, docId, data) {
  return {
    update: {
      name:   docPath(collectionPath, docId),
      fields: encodeDoc(data),
    },
  };
}

// ─────────────────────────────────────────────────────────
// Athletes
// ─────────────────────────────────────────────────────────
const athletes = [
  { uid: 'athlete_pg_01', name: 'Marcus Johnson',  position: 'PG', jersey: 1  },
  { uid: 'athlete_sg_02', name: 'Tyler Williams',  position: 'SG', jersey: 2  },
  { uid: 'athlete_sf_03', name: 'Darius Brown',    position: 'SF', jersey: 3  },
  { uid: 'athlete_pf_04', name: 'Jordan Davis',    position: 'PF', jersey: 4  },
  { uid: 'athlete_c_05',  name: 'Andre Thompson',  position: 'C',  jersey: 5  },
  { uid: 'athlete_pg_06', name: 'Kevin Martinez',  position: 'PG', jersey: 6  },
  { uid: 'athlete_sg_07', name: 'Chris Anderson',  position: 'SG', jersey: 7  },
  { uid: 'athlete_sf_08', name: 'DeShawn Wilson',  position: 'SF', jersey: 8  },
  { uid: 'athlete_pf_09', name: 'Isaiah Thomas',   position: 'PF', jersey: 9  },
  { uid: 'athlete_c_10',  name: 'Malik Robinson',  position: 'C',  jersey: 10 },
  { uid: 'athlete_sg_11', name: 'Jamal Foster',    position: 'SG', jersey: 11 },
  { uid: 'athlete_sf_12', name: 'Brandon Cooper',  position: 'SF', jersey: 12 },
];

// ─────────────────────────────────────────────────────────
// Math helpers
// ─────────────────────────────────────────────────────────
const clamp   = (v, lo = 1, hi = 10) => Math.min(hi, Math.max(lo, Math.round(v)));
const metric  = (min, max)  => clamp(min + Math.random() * (max - min));
const randInt = (min, max)  => Math.floor(min + Math.random() * (max - min + 1));

// ─────────────────────────────────────────────────────────
// Season / period helpers
// ─────────────────────────────────────────────────────────
const SEASON_START = new Date(2025, 10, 1);
const SEASON_END   = new Date(2026,  1, 28);

function getPeriod(date) {
  const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
  if (y === 2025 && m === 10 && d <= 14)                              return 'preseason';
  if (y === 2025 && ((m === 10 && d >= 15) || (m === 11 && d <= 20))) return 'nonconference';
  if ((y === 2025 && m === 11 && d >= 21) || (y === 2026 && m === 0 && d <= 4)) return 'holiday';
  if (y === 2026 && ((m === 0 && d >= 5) || m === 1))                return 'conference';
  return null;
}

function getSessionConfig(date) {
  const period = getPeriod(date);
  const dow = date.getDay();
  if (dow === 0) return null;  // Sunday OFF

  if (period === 'preseason') {
    return { sessionType: 'conditioning', duration: randInt(90, 120), rpeMin: 7, rpeMax: 9 };
  }
  if (period === 'nonconference') {
    if (dow === 6) return { sessionType: 'scrimmage',    duration: 40,            rpeMin: 8, rpeMax: 9  };
    if (dow === 5) return { sessionType: 'conditioning', duration: randInt(75,90), rpeMin: 5, rpeMax: 6  };
    if (dow === 2 || dow === 4) return { sessionType: 'skill', duration: randInt(90,105), rpeMin: 6, rpeMax: 7 };
    return             { sessionType: 'conditioning', duration: randInt(90,105), rpeMin: 6, rpeMax: 8 };
  }
  if (period === 'holiday') {
    if (dow === 5 || dow === 6) return null;
    return { sessionType: 'conditioning', duration: randInt(60, 75), rpeMin: 5, rpeMax: 7 };
  }
  if (period === 'conference') {
    if (dow === 5) return null;
    if (dow === 6) return { sessionType: 'scrimmage',    duration: 40, rpeMin: 8, rpeMax: 10 };
    if (dow === 2 || dow === 4) return { sessionType: 'skill', duration: 90, rpeMin: 6, rpeMax: 7 };
    return             { sessionType: 'conditioning', duration: 90, rpeMin: 6, rpeMax: 7 };
  }
  return null;
}

// ─────────────────────────────────────────────────────────
// Metric generation
// ─────────────────────────────────────────────────────────
const PERIOD_BASES = {
  preseason:     { cardio:[6,9], neuro:[6,8], sleep:[5,7], stress:[5,7], motor:[5,7], tactical:[5,7] },
  nonconference: { cardio:[5,8], neuro:[5,7], sleep:[6,8], stress:[4,6], motor:[4,7], tactical:[4,7] },
  holiday:       { cardio:[4,6], neuro:[3,5], sleep:[7,9], stress:[2,4], motor:[3,5], tactical:[3,5] },
  conference:    { cardio:[5,7], neuro:[5,7], sleep:[6,8], stress:[5,7], motor:[5,7], tactical:[5,7] },
};
const POS_DELTA = {
  C:  { cardio: +1 },
  PF: { cardio: +1 },
  PG: { neuro: +1, tactical: +1 },
  SG: {},
  SF: {},
};
const PLAYER_DELTA = {
  athlete_pg_01: { stress: +1, sleep: +1 },
  athlete_c_05:  { cardio: +2 },
  athlete_pg_06: { cardio: -1, neuro: -1, sleep: -1, stress: -1, motor: -1, tactical: -1 },
  athlete_c_10:  { cardio: +1, sleep: +1 },
};
const FRICTION_TYPES   = ['Physical Fatigue', 'Academic/Life Stress', 'Mental/Emotional', 'Court Confusion'];
const FRICTION_WEIGHTS = [0.40, 0.30, 0.20, 0.10];

function pickFriction() {
  let r = Math.random(), cum = 0;
  for (let i = 0; i < FRICTION_TYPES.length; i++) {
    cum += FRICTION_WEIGHTS[i];
    if (r < cum) return FRICTION_TYPES[i];
  }
  return FRICTION_TYPES[0];
}

function generateMetrics(athlete, period, sessionType, isRecovery) {
  const b  = PERIOD_BASES[period];
  const pd = POS_DELTA[athlete.position]  || {};
  const ad = PLAYER_DELTA[athlete.uid]    || {};
  const mc = (athlete.uid === 'athlete_c_10' && period === 'conference') ? 1 : 0;

  let cardio   = metric(b.cardio[0],   b.cardio[1])   + (pd.cardio   || 0) + (ad.cardio   || 0) + mc;
  let neuro    = metric(b.neuro[0],    b.neuro[1])    + (pd.neuro    || 0) + (ad.neuro    || 0);
  let sleep    = metric(b.sleep[0],    b.sleep[1])                         + (ad.sleep    || 0) + mc;
  let stress   = metric(b.stress[0],   b.stress[1])                        + (ad.stress   || 0);
  let motor    = metric(b.motor[0],    b.motor[1])    + (pd.neuro    || 0) + (ad.motor    || 0);
  let tactical = metric(b.tactical[0], b.tactical[1]) + (pd.tactical || 0) + (ad.tactical || 0);

  if (sessionType === 'scrimmage') {
    cardio = metric(8, 10); neuro = metric(7, 9); stress = metric(6, 8);
    motor  = metric(7, 9);  tactical = metric(6, 8);
  }
  if (isRecovery) {
    cardio -= 2; neuro -= 2; sleep -= 1; stress -= 2; motor -= 2; tactical -= 2;
  }

  return {
    cardioLoad:       clamp(cardio),
    neuroLoad:        clamp(neuro),
    sleepQuality:     clamp(sleep),
    stressLevel:      clamp(stress),
    motorControl:     clamp(motor),
    tacticalLucidity: clamp(tactical),
  };
}

function calcReadiness(m) {
  return Math.round(
    ((10 - m.cardioLoad) * 0.20 + (10 - m.neuroLoad)        * 0.25 +
     (10 - m.sleepQuality) * 0.20 + (10 - m.stressLevel)    * 0.15 +
     (10 - m.motorControl) * 0.10 + (10 - m.tacticalLucidity) * 0.10) * 10
  );
}

// ─────────────────────────────────────────────────────────
// Batch queue — flush every 499 write ops
// ─────────────────────────────────────────────────────────
let queue    = [];
let totalOps = 0;
let batchNum = 0;
const MAX_OPS = 499;

async function flush(token, force = false) {
  if (!force && queue.length < MAX_OPS) return;
  while (queue.length > 0) {
    const chunk = queue.splice(0, MAX_OPS);
    batchNum++;
    await batchWrite(chunk, token);
    totalOps += chunk.length;
    process.stdout.write(`   ✅ Batch ${batchNum} committed (${chunk.length} ops, ${totalOps} total)\n`);
  }
}

// ─────────────────────────────────────────────────────────
// Unique ID generator (mimics Firestore auto-ID)
// ─────────────────────────────────────────────────────────
function autoId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ─────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────
async function seed() {
  console.log('🏀  NCAA D2 Season Seed — ChampionTrackPro');
  console.log(`    Team    : ${TEAM_ID}`);
  console.log(`    Season  : Nov 1 2025 → Feb 28 2026`);
  console.log(`    Athletes: ${athletes.length}\n`);

  const token = getToken();
  const now   = new Date();

  // ── 1) User + member docs ─────────────────────────────
  console.log('👥  Queueing athlete docs...');
  for (const a of athletes) {
    queue.push(writeOp('users', a.uid, {
      role: 'athlete', teamId: TEAM_ID,
      displayName: a.name, position: a.position,
      jerseyNumber: a.jersey, onboardingComplete: true,
      email: `${a.uid}@ctpro.dev`, createdAt: now, updatedAt: now,
    }));
    queue.push(writeOp(`teams/${TEAM_ID}/members`, a.uid, {
      uid: a.uid, role: 'athlete', name: a.name,
      position: a.position, jerseyNumber: a.jersey, addedAt: now,
    }));
  }
  await flush(token);
  console.log(`   ✅ ${athletes.length} athletes done\n`);

  // ── 2) Build training calendar ────────────────────────
  const gameDays     = new Set();
  const trainingPlan = [];

  const cur = new Date(SEASON_START);
  while (cur <= SEASON_END) {
    const cfg = getSessionConfig(new Date(cur));
    if (cfg) {
      trainingPlan.push({ date: new Date(cur), config: cfg });
      if (cfg.sessionType === 'scrimmage') gameDays.add(cur.toDateString());
    }
    cur.setDate(cur.getDate() + 1);
  }

  console.log(`📅  ${trainingPlan.length} training days planned`);
  console.log(`🏆  ${gameDays.size} game/scrimmage days`);
  console.log(`📊  Expected: ${trainingPlan.length * athletes.length} responses\n`);

  // ── 3) Trainings + responses ──────────────────────────
  let trainingCount = 0;
  let responseCount = 0;

  for (const { date, config } of trainingPlan) {
    const period    = getPeriod(date);
    const dow       = date.getDay();
    const isWeekend = dow === 6;

    const yesterday  = new Date(date.getTime() - 86400000);
    const twoDaysAgo = new Date(date.getTime() - 2 * 86400000);
    const isRecovery = gameDays.has(yesterday.toDateString()) ||
                       (dow === 1 && gameDays.has(twoDaysAgo.toDateString()));

    const startHour = isWeekend ? 10 : 18;
    const startMin  = isWeekend ?  0 : 30;
    const startDate = new Date(date);
    startDate.setHours(startHour, startMin, 0, 0);

    const effectiveDuration = isRecovery ? 60 : config.duration;
    const endDate = new Date(startDate.getTime() + effectiveDuration * 60000);

    const trainingId = autoId();

    queue.push(writeOp(`teams/${TEAM_ID}/trainings`, trainingId, {
      teamId:        TEAM_ID,
      sessionType:   config.sessionType,
      date:          date,
      startUtc:      startDate,
      endUtc:        endDate,
      duration:      effectiveDuration,
      isTestSession: false,
      createdAt:     now,
    }));

    const frictionProb = period === 'conference' ? 0.25 : 0.15;

    for (const athlete of athletes) {
      const m          = generateMetrics(athlete, period, config.sessionType, isRecovery);
      const sessionRPE = isRecovery ? metric(4, 5) : metric(config.rpeMin, config.rpeMax);
      const workloadAU = Math.round(sessionRPE * effectiveDuration);
      const readiness  = calcReadiness(m);
      const hasFriction = Math.random() < frictionProb;
      const submitDate  = new Date(endDate.getTime() + randInt(0, 30) * 60000);

      const responseData = {
        userId: athlete.uid, teamId: TEAM_ID,
        trainingId, sessionType: config.sessionType,
        sessionRPE: clamp(sessionRPE),
        duration: effectiveDuration, workloadAU,
        metrics: m, readinessScore: readiness,
        hasFriction,
        ...(hasFriction ? { frictionType: pickFriction() } : {}),
        isTest: false,
        submittedAt: submitDate, createdAt: submitDate,
      };

      queue.push(writeOp(
        `teams/${TEAM_ID}/trainings/${trainingId}/responses`,
        athlete.uid,
        responseData,
      ));
      responseCount++;
    }

    trainingCount++;
    if (trainingCount % 10 === 0) {
      const pct = Math.round(trainingCount / trainingPlan.length * 100);
      process.stdout.write(`   📊 ${trainingCount}/${trainingPlan.length} (${pct}%) — ${responseCount} responses queued\n`);
      await flush(token);
    }
  }

  await flush(token, true);  // flush remainder

  console.log(`\n✅  Generated: ${trainingCount} trainings, ${responseCount} responses`);
  console.log(`    Total Firestore ops: ${totalOps}`);
  console.log('\n🎉  Season seed complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err.message || err);
  process.exit(1);
});
