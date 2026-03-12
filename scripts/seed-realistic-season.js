/**
 * seed-realistic-season.js
 * Hyper-realistic NCAA D2 basketball season — Team Ri8kpStgWp9yymtS71tb
 * Oct 1 2025 → Mar 10 2026 | 12 athletes | V3 schema (1-100)
 *
 * V3 metrics (all 1-100, high=good except cardioLoad where high=bad):
 *   tankLevel, cardioLoad, legBounce, motorControl, tacticalSharpness, teamChemistry
 *
 * Uses Firestore REST API with OAuth token from firebase-tools configstore.
 * Set RESET_BEFORE_SEED = true to delete existing training docs first.
 */

const https = require('https');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const RESET_BEFORE_SEED = true;
const CFG_PATH  = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const PROJECT   = 'championtrackpro';
const TEAM_ID   = 'Ri8kpStgWp9yymtS71tb';
const BASE_PATH = `/v1/projects/${PROJECT}/databases/(default)/documents`;

// ─── Auth ─────────────────────────────────────────────────────────────────────
function getToken() {
  try {
    return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')).tokens.access_token;
  } catch {
    console.error('❌  Run: firebase login');
    process.exit(1);
  }
}

// ─── REST helpers ─────────────────────────────────────────────────────────────
function restRequest(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: urlPath,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
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

function batchWrite(ops, token) {
  return restRequest('POST', `${BASE_PATH}:commit`, { writes: ops }, token);
}

// List all docs in a collection (returns array of doc names)
async function listDocs(collectionPath, token) {
  const names = [];
  let pageToken = null;
  do {
    const url = `${BASE_PATH}/${collectionPath}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await restRequest('GET', url, null, token);
    if (res.documents) {
      for (const d of res.documents) names.push(d.name);
    }
    pageToken = res.nextPageToken || null;
  } while (pageToken);
  return names;
}

// ─── Firestore encoders ───────────────────────────────────────────────────────
const fStr  = v   => ({ stringValue: String(v) });
const fBool = v   => ({ booleanValue: Boolean(v) });
const fInt  = v   => ({ integerValue: String(Math.round(v)) });
const fTs   = ms  => ({ timestampValue: new Date(ms).toISOString() });
const fNull = ()  => ({ nullValue: 'NULL_VALUE' });
const fArr  = arr => ({ arrayValue: { values: arr.map(fStr) } });
const fMap  = obj => ({ mapValue: { fields: obj } });

function docPath(collection, id = '') {
  return `projects/${PROJECT}/databases/(default)/documents/${collection}${id ? '/' + id : ''}`;
}

function encodeDoc(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) { fields[k] = fNull(); continue; }
    if (typeof v === 'string')  { fields[k] = fStr(v);  continue; }
    if (typeof v === 'boolean') { fields[k] = fBool(v); continue; }
    if (typeof v === 'number')  { fields[k] = fInt(v);  continue; }
    if (v instanceof Date)      { fields[k] = fTs(v.getTime()); continue; }
    if (Array.isArray(v))       { fields[k] = fArr(v);  continue; }
    if (typeof v === 'object')  { fields[k] = fMap(encodeDoc(v)); continue; }
  }
  return fields;
}

function writeOp(collectionPath, docId, data) {
  return { update: { name: docPath(collectionPath, docId), fields: encodeDoc(data) } };
}

function deleteOp(fullName) {
  return { delete: fullName };
}

// ─── Batch queue ──────────────────────────────────────────────────────────────
let queue    = [];
let totalOps = 0;
let batchNum = 0;

async function flush(token, force = false) {
  if (!force && queue.length < 499) return;
  while (queue.length > 0) {
    const chunk = queue.splice(0, 499);
    batchNum++;
    await batchWrite(chunk, token);
    totalOps += chunk.length;
    process.stdout.write(`   ✅  Batch ${batchNum} — ${chunk.length} ops (${totalOps} total)\n`);
  }
}

// ─── Math helpers ─────────────────────────────────────────────────────────────
const clamp   = (v, lo = 1, hi = 100) => Math.min(hi, Math.max(lo, Math.round(v)));
const rand    = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const gauss   = (mean, sd) => {
  // Box-Muller
  const u1 = 1 - Math.random(), u2 = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// ─── UTC date helpers ─────────────────────────────────────────────────────────
function utcDate(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
function isoDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

// ─── Season bounds ────────────────────────────────────────────────────────────
const SEASON_START = utcDate(2025, 10, 1);
const SEASON_END   = utcDate(2026, 3, 10);

// ─── Athletes (V3 — full biological profiles) ─────────────────────────────────
// baseline: { tank, cardio, legBounce, motor, tactical, teamChem } all in 1-100
// variance: daily noise SD (tight=5, normal=10, high=18)
// injuryWindow: null | [startDate, endDate] — forced low values during injury
// frictionProne: higher hasFriction probability
const athletes = [
  {
    uid: 'athlete_pg_01', name: 'Marcus Johnson',  position: 'PG', jersey: 1,
    baseline: { tank:72, cardio:45, legBounce:70, motor:68, tactical:78, teamChem:74 },
    variance: 10, frictionProne: false, injuryWindow: null,
  },
  {
    uid: 'athlete_sg_02', name: 'Tyler Williams',  position: 'SG', jersey: 2,
    baseline: { tank:68, cardio:50, legBounce:65, motor:65, tactical:70, teamChem:72 },
    variance: 10, frictionProne: false, injuryWindow: null,
  },
  {
    uid: 'athlete_sf_03', name: 'Darius Brown',    position: 'SF', jersey: 3,
    baseline: { tank:65, cardio:55, legBounce:62, motor:60, tactical:63, teamChem:68 },
    variance: 12, frictionProne: false,
    injuryWindow: [utcDate(2025, 10, 18), utcDate(2025, 10, 28)], // late preseason tweak
  },
  {
    uid: 'athlete_pf_04', name: 'Jordan Davis',    position: 'PF', jersey: 4,
    baseline: { tank:60, cardio:62, legBounce:58, motor:62, tactical:60, teamChem:65 },
    variance: 10, frictionProne: false, injuryWindow: null,
  },
  {
    uid: 'athlete_c_05',  name: 'Andre Thompson',  position: 'C',  jersey: 5,
    baseline: { tank:55, cardio:68, legBounce:55, motor:60, tactical:58, teamChem:66 },
    variance: 8, frictionProne: false, injuryWindow: null,
  },
  {
    uid: 'athlete_pg_06', name: 'Kevin Martinez',  position: 'PG', jersey: 6,
    baseline: { tank:58, cardio:60, legBounce:55, motor:55, tactical:60, teamChem:52 },
    variance: 18, frictionProne: true, injuryWindow: null,
  },
  {
    uid: 'athlete_sg_07', name: 'Chris Anderson',  position: 'SG', jersey: 7,
    baseline: { tank:74, cardio:42, legBounce:72, motor:70, tactical:68, teamChem:76 },
    variance: 5, frictionProne: false, injuryWindow: null,
  },
  {
    uid: 'athlete_sf_08', name: 'DeShawn Wilson',  position: 'SF', jersey: 8,
    baseline: { tank:70, cardio:48, legBounce:68, motor:65, tactical:65, teamChem:70 },
    variance: 10, frictionProne: false,
    injuryWindow: [utcDate(2026, 1, 28), utcDate(2026, 2, 7)],   // mid-conf ankle
  },
  {
    uid: 'athlete_pf_09', name: 'Isaiah Thomas',   position: 'PF', jersey: 9,
    baseline: { tank:62, cardio:58, legBounce:60, motor:58, tactical:62, teamChem:65 },
    variance: 18, frictionProne: true, injuryWindow: null,
  },
  {
    uid: 'athlete_c_10',  name: 'Malik Robinson',  position: 'C',  jersey: 10,
    baseline: { tank:66, cardio:64, legBounce:63, motor:64, tactical:62, teamChem:71 },
    variance: 8, frictionProne: false, injuryWindow: null,
  },
  {
    uid: 'athlete_sg_11', name: 'Jamal Foster',    position: 'SG', jersey: 11,
    baseline: { tank:64, cardio:52, legBounce:63, motor:62, tactical:64, teamChem:63 },
    variance: 14, frictionProne: true, injuryWindow: null,
  },
  {
    uid: 'athlete_sf_12', name: 'Brandon Cooper',  position: 'SF', jersey: 12,
    baseline: { tank:68, cardio:50, legBounce:66, motor:66, tactical:67, teamChem:70 },
    variance: 10, frictionProne: false, injuryWindow: null,
  },
];

// ─── Game schedule ────────────────────────────────────────────────────────────
// true = win, false = loss
const GAMES = [
  // Non-conference (10)
  { date: utcDate(2025, 11,  1), win: true,  type: 'game' },
  { date: utcDate(2025, 11,  5), win: true,  type: 'game' },
  { date: utcDate(2025, 11,  8), win: false, type: 'game' },
  { date: utcDate(2025, 11, 12), win: true,  type: 'game' },
  { date: utcDate(2025, 11, 15), win: true,  type: 'game' },
  { date: utcDate(2025, 11, 19), win: false, type: 'game' },
  { date: utcDate(2025, 11, 22), win: true,  type: 'game' },
  { date: utcDate(2025, 12,  3), win: true,  type: 'game' },
  { date: utcDate(2025, 12,  6), win: false, type: 'game' },
  { date: utcDate(2025, 12, 13), win: true,  type: 'game' },
  // Conference (16)
  { date: utcDate(2026,  1,  7), win: true,  type: 'conference' },
  { date: utcDate(2026,  1, 10), win: true,  type: 'conference' },
  { date: utcDate(2026,  1, 14), win: false, type: 'conference' },
  { date: utcDate(2026,  1, 17), win: true,  type: 'conference' },
  { date: utcDate(2026,  1, 21), win: true,  type: 'conference' },
  { date: utcDate(2026,  1, 24), win: false, type: 'conference' },
  { date: utcDate(2026,  1, 28), win: true,  type: 'conference' },
  { date: utcDate(2026,  1, 31), win: true,  type: 'conference' },
  { date: utcDate(2026,  2,  4), win: true,  type: 'conference' },
  { date: utcDate(2026,  2,  7), win: false, type: 'conference' },
  { date: utcDate(2026,  2, 11), win: true,  type: 'conference' },
  { date: utcDate(2026,  2, 14), win: true,  type: 'conference' },
  { date: utcDate(2026,  2, 18), win: false, type: 'conference' },
  { date: utcDate(2026,  2, 21), win: true,  type: 'conference' },
  { date: utcDate(2026,  2, 25), win: true,  type: 'conference' },
  { date: utcDate(2026,  3,  4), win: true,  type: 'conference' },
  // Tournament (3 — semifinal win, final win = champion)
  { date: utcDate(2026,  3,  6), win: true,  type: 'tournament' },
  { date: utcDate(2026,  3,  8), win: true,  type: 'tournament' },
  { date: utcDate(2026,  3, 10), win: true,  type: 'tournament' },
];

const GAME_DATES = new Map(GAMES.map(g => [isoDate(g.date), g]));

// ─── Period helpers ───────────────────────────────────────────────────────────
function getPeriod(date) {
  const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1, d = date.getUTCDate();
  if (y === 2025 && m === 10)                                          return 'preseason';
  if (y === 2025 && m >= 11 && !(m === 12 && d >= 21))                return 'nonconference';
  if ((y === 2025 && m === 12 && d >= 21) || (y === 2026 && m === 1 && d <= 4)) return 'holiday';
  if ((y === 2026 && m === 1 && d >= 5) || (y === 2026 && m <= 3 && !(m === 3 && d >= 6))) return 'conference';
  if (y === 2026 && m === 3 && d >= 6)                                 return 'tournament';
  return 'conference';
}

// Weeks into conference phase (0-indexed)
function confWeek(date) {
  const start = utcDate(2026, 1, 5);
  return Math.floor((date.getTime() - start.getTime()) / (7 * 86400000));
}

// ─── Session type per day ─────────────────────────────────────────────────────
function getSessionConfig(date) {
  const iso = isoDate(date);
  const game = GAME_DATES.get(iso);
  if (game) return { sessionType: game.type === 'tournament' ? 'tournament_game' : 'game', duration: 40, rpeMin: 8, rpeMax: 10, isGame: true };

  const period = getPeriod(date);
  const dow = date.getUTCDay(); // 0=Sun

  if (period === 'preseason') {
    if (dow === 0) return null; // Sunday off
    if (dow === 6) return { sessionType: 'scrimmage',    duration: 50, rpeMin: 8, rpeMax: 9 };
    if (dow === 5) return { sessionType: 'recovery',     duration: 45, rpeMin: 3, rpeMax: 5 };
    return { sessionType: 'conditioning', duration: randInt(90, 120), rpeMin: 7, rpeMax: 9 };
  }

  if (period === 'nonconference') {
    if (dow === 0 || dow === 5) return null;
    if (dow === 6) return { sessionType: 'shoot_around',  duration: 45, rpeMin: 4, rpeMax: 6 };
    if (dow === 2 || dow === 4) return { sessionType: 'skill',        duration: 90, rpeMin: 6, rpeMax: 7 };
    return { sessionType: 'conditioning', duration: randInt(75, 90), rpeMin: 5, rpeMax: 7 };
  }

  if (period === 'holiday') {
    if (dow === 0 || dow === 5 || dow === 6) return null;
    return { sessionType: 'conditioning', duration: randInt(60, 75), rpeMin: 4, rpeMax: 6 };
  }

  if (period === 'conference') {
    if (dow === 0 || dow === 5) return null;
    if (dow === 6) return { sessionType: 'shoot_around', duration: 40, rpeMin: 4, rpeMax: 6 };
    if (dow === 3) return { sessionType: 'recovery',     duration: 50, rpeMin: 3, rpeMax: 5 };
    if (dow === 2 || dow === 4) return { sessionType: 'skill', duration: 85, rpeMin: 6, rpeMax: 7 };
    return { sessionType: 'conditioning', duration: 80, rpeMin: 5, rpeMax: 6 };
  }

  if (period === 'tournament') {
    // Off-days around tournament games
    return null;
  }

  return null;
}

// ─── Metric generation (V3: 1-100) ───────────────────────────────────────────
const PERIOD_MOD = {
  preseason:     { tank: -8,  cardio: +12, legBounce: -10, motor: -5,  tactical: -8,  teamChem: -5  },
  nonconference: { tank: +2,  cardio: +5,  legBounce: +2,  motor: +2,  tactical: +5,  teamChem: +3  },
  holiday:       { tank: +10, cardio: -15, legBounce: +12, motor: +5,  tactical: -5,  teamChem: +5  },
  conference:    { tank: -5,  cardio: +8,  legBounce: -5,  motor: +3,  tactical: +8,  teamChem: +5  },
  tournament:    { tank: -3,  cardio: +10, legBounce: -8,  motor: +5,  tactical: +12, teamChem: +8  },
};

// Day-of-week pattern (Mon=fresh start, Thu=accumulated fatigue, Sat=pre-game peak)
const DOW_MOD = {
  0: { tank:  5, cardio: -5, legBounce:  8 },  // Sunday (rest)
  1: { tank:  3, cardio: -3, legBounce:  5 },  // Monday
  2: { tank:  0, cardio:  2, legBounce:  0 },  // Tuesday
  3: { tank: -3, cardio:  5, legBounce: -3 },  // Wednesday
  4: { tank: -5, cardio:  7, legBounce: -5 },  // Thursday
  5: { tank: -2, cardio:  3, legBounce: -2 },  // Friday
  6: { tank:  2, cardio:  2, legBounce:  2 },  // Saturday
};

function generateV3Metrics(athlete, date, period, sessionType, gameDayEffect, lossStreakEffect, injuryActive) {
  const b   = athlete.baseline;
  const pm  = PERIOD_MOD[period] || {};
  const dm  = DOW_MOD[date.getUTCDay()] || {};
  const sd  = athlete.variance;

  // Conference progressive fatigue
  let confFatigue = 0;
  if (period === 'conference') {
    const wk = Math.max(0, confWeek(date));
    confFatigue = Math.min(wk * 0.875, 7); // max -7 at week 8
  }

  // Tournament compression — values regress toward 55 (excitement + fatigue mix)
  const compress = (v) => period === 'tournament' ? v + (55 - v) * 0.30 : v;

  let tank     = clamp(gauss(compress(b.tank     + (pm.tank     ||0) + (dm.tank     ||0)), sd));
  let cardio   = clamp(gauss(compress(b.cardio   + (pm.cardio   ||0) + (dm.cardio   ||0) + confFatigue), sd));
  let legBounce= clamp(gauss(compress(b.legBounce+ (pm.legBounce||0) + (dm.legBounce||0) - confFatigue*0.5), sd));
  let motor    = clamp(gauss(compress(b.motor    + (pm.motor    ||0)), sd));
  let tactical = clamp(gauss(compress(b.tactical + (pm.tactical ||0)), sd));
  let teamChem = clamp(gauss(compress(b.teamChem + (pm.teamChem ||0)), sd));

  // Game-day: elevated effort, potential soreness day after
  if (gameDayEffect === 'gameday') {
    cardio   = clamp(cardio   + randInt(8, 15));
    legBounce= clamp(legBounce - randInt(5, 10));
    tank     = clamp(tank     - randInt(3, 8));
    tactical = clamp(tactical + randInt(3, 8));   // locked in
  } else if (gameDayEffect === 'recovery') {
    cardio   = clamp(cardio   + randInt(5, 12));
    legBounce= clamp(legBounce - randInt(8, 18));
    tank     = clamp(tank     - randInt(5, 12));
    motor    = clamp(motor    - randInt(3, 8));
  }

  // Loss streak: teamChemistry tanks, tactical drops
  if (lossStreakEffect >= 2) {
    const streakDrag = Math.min(lossStreakEffect * 4, 16);
    teamChem = clamp(teamChem - streakDrag);
    tactical = clamp(tactical - streakDrag * 0.5);
    tank     = clamp(tank     - streakDrag * 0.4);
  }

  // Injury window: forced low values
  if (injuryActive) {
    tank     = clamp(gauss(35, 8));
    legBounce= clamp(gauss(28, 8));
    motor    = clamp(gauss(35, 8));
    cardio   = clamp(gauss(72, 8));
  }

  // Session-type modifiers
  if (sessionType === 'recovery') {
    cardio   = clamp(cardio   - randInt(5, 10));
    legBounce= clamp(legBounce + randInt(3, 8));
  }
  if (sessionType === 'shoot_around') {
    cardio = clamp(cardio - randInt(8, 15));
    legBounce = clamp(legBounce + randInt(2, 6));
  }

  return {
    tankLevel:        tank,
    cardioLoad:       cardio,
    legBounce:        legBounce,
    motorControl:     motor,
    tacticalSharpness:tactical,
    teamChemistry:    teamChem,
  };
}

// V3 readiness formula
function calcReadiness(m) {
  return clamp(
    m.tankLevel         * 0.20 +
    (101 - m.cardioLoad)* 0.20 +
    m.legBounce         * 0.20 +
    m.motorControl      * 0.15 +
    m.tacticalSharpness * 0.15 +
    m.teamChemistry     * 0.10,
    1, 100
  );
}

// V2 backward-compat aliases (scale: V3 native 1-100)
function v2Aliases(m) {
  return {
    neuroLoad:        m.legBounce,
    stressLevel:      101 - m.teamChemistry,
    sleepQuality:     m.tankLevel,
    tacticalLucidity: m.tacticalSharpness,
  };
}

// ─── Friction ─────────────────────────────────────────────────────────────────
const FRICTION_TYPES = ['Physical Fatigue', 'Academic/Life Stress', 'Mental/Emotional', 'Court Confusion'];

function genFriction(athlete, period, gameDayEffect, injuryActive) {
  let baseProb = athlete.frictionProne ? 0.28 : 0.14;
  if (period === 'conference') baseProb += 0.08;
  if (period === 'tournament') baseProb += 0.12;
  if (gameDayEffect === 'recovery') baseProb += 0.10;
  if (injuryActive) baseProb += 0.20;

  const hasFriction = Math.random() < baseProb;
  if (!hasFriction) return { hasFriction: false };

  // Pick 1-2 friction types
  const shuffled = [...FRICTION_TYPES].sort(() => Math.random() - 0.5);
  const count = Math.random() < 0.35 ? 2 : 1;
  const frictionType = shuffled.slice(0, count);

  const worryLevel = clamp(gauss(injuryActive ? 72 : 55, 15));
  const worryFlag  = worryLevel > 70;

  return { hasFriction: true, frictionType, worryLevel, worryFlag };
}

// ─── Submission timing ────────────────────────────────────────────────────────
function submittedAtDate(trainingDate, isGameDay) {
  const base = new Date(trainingDate);
  if (isGameDay) {
    // Questionnaire filled next morning 6am-10am UTC
    base.setUTCDate(base.getUTCDate() + 1);
    base.setUTCHours(randInt(6, 10), randInt(0, 59), 0, 0);
  } else {
    // Same day 6am-10am
    base.setUTCHours(randInt(6, 10), randInt(0, 59), 0, 0);
  }
  return base;
}

// ─── Submission rate ──────────────────────────────────────────────────────────
function shouldSubmit(period, isGameDay, injuryActive) {
  if (injuryActive && Math.random() < 0.40) return false; // injured athletes skip more
  if (isGameDay)           return Math.random() < 0.92;
  if (period === 'holiday') return Math.random() < 0.62;
  if (period === 'tournament') return Math.random() < 0.95;
  return Math.random() < 0.87;
}

// ─── Summary accumulators ─────────────────────────────────────────────────────
const summary = {
  byAthlete: Object.fromEntries(athletes.map(a => [a.uid, { submitted: 0, missed: 0, readinessSum: 0, worryFlags: 0 }])),
  byPeriod:  { preseason: { count:0, readinessSum:0 }, nonconference: { count:0, readinessSum:0 }, holiday: { count:0, readinessSum:0 }, conference: { count:0, readinessSum:0 }, tournament: { count:0, readinessSum:0 } },
  games:     { total: GAMES.length, wins: GAMES.filter(g => g.win).length, losses: GAMES.filter(g => !g.win).length },
};

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🏀  NCAA D2 Season Seed — ChampionTrackPro (V3)');
  console.log(`    Team    : ${TEAM_ID}`);
  console.log(`    Season  : Oct 1 2025 → Mar 10 2026`);
  console.log(`    Athletes: ${athletes.length}`);
  console.log(`    Games   : ${summary.games.wins}W – ${summary.games.losses}L\n`);

  const token = getToken();
  const now   = new Date();

  // ── 0) Reset ───────────────────────────────────────────────────────────────
  if (RESET_BEFORE_SEED) {
    console.log('🗑️   RESET_BEFORE_SEED — deleting existing docs...');

    // Delete trainings (list top-level, then delete with subcollection responses)
    const trainingNames = await listDocs(`teams/${TEAM_ID}/trainings`, token);
    console.log(`    Found ${trainingNames.length} existing training docs`);

    for (const tName of trainingNames) {
      const tId = tName.split('/').pop();
      // Delete responses first
      const respNames = await listDocs(`teams/${TEAM_ID}/trainings/${tId}/responses`, token);
      for (const rName of respNames) queue.push(deleteOp(rName));
      queue.push(deleteOp(tName));
      if (queue.length >= 400) await flush(token, true);
    }

    // Delete existing member docs for seeded athletes
    for (const a of athletes) {
      const uName = `projects/${PROJECT}/databases/(default)/documents/users/${a.uid}`;
      const mName = `projects/${PROJECT}/databases/(default)/documents/teams/${TEAM_ID}/members/${a.uid}`;
      queue.push(deleteOp(uName));
      queue.push(deleteOp(mName));
    }

    await flush(token, true);
    console.log('   ✅  Reset complete\n');
  }

  // ── 1) User + member docs ──────────────────────────────────────────────────
  console.log('👥  Writing athlete docs...');
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
  await flush(token, true);
  console.log(`   ✅  ${athletes.length} athletes written\n`);

  // ── 2) Build calendar + trainings + responses ──────────────────────────────
  console.log('📅  Generating season...\n');

  let trainingCount = 0;
  let responseCount = 0;

  // Rolling game results for loss-streak tracking (last 5 results)
  const recentResults = [];

  const cur = new Date(SEASON_START);
  while (cur <= SEASON_END) {
    const iso    = isoDate(cur);
    const period = getPeriod(cur);
    const game   = GAME_DATES.get(iso);
    const cfg    = game
      ? { sessionType: game.type === 'tournament' ? 'tournament_game' : 'game', duration: 40, rpeMin: 8, rpeMax: 10, isGame: true }
      : getSessionConfig(cur);

    if (cfg) {
      const isGameDay = cfg.isGame === true;

      // Update recent results for loss-streak
      if (isGameDay && game) {
        recentResults.push(game.win);
        if (recentResults.length > 5) recentResults.shift();
      }
      const lossStreak = (() => {
        let streak = 0;
        for (let i = recentResults.length - 1; i >= 0; i--) {
          if (!recentResults[i]) streak++;
          else break;
        }
        return streak;
      })();

      // Day-after-game detection
      const yesterday = addDays(cur, -1);
      const twoDaysAgo = addDays(cur, -2);
      const dayAfterGame = GAME_DATES.has(isoDate(yesterday));
      const twoDayRecovery = cur.getUTCDay() === 1 && GAME_DATES.has(isoDate(twoDaysAgo));
      const gameDayEffect  = isGameDay ? 'gameday' : (dayAfterGame || twoDayRecovery) ? 'recovery' : 'normal';

      const trainingId = `training_${iso}`;
      const startDate = new Date(cur);
      startDate.setUTCHours(isGameDay ? 19 : (cur.getUTCDay() === 6 ? 10 : 18), 0, 0, 0);
      const endDate = new Date(startDate.getTime() + cfg.duration * 60000);

      queue.push(writeOp(`teams/${TEAM_ID}/trainings`, trainingId, {
        teamId:        TEAM_ID,
        sessionType:   cfg.sessionType,
        date:          cur,
        startUtc:      startDate,
        endUtc:        endDate,
        duration:      cfg.duration,
        isTestSession: false,
        period,
        createdAt:     now,
      }));

      for (const athlete of athletes) {
        const injuryActive = athlete.injuryWindow !== null &&
          cur >= athlete.injuryWindow[0] && cur <= athlete.injuryWindow[1];

        if (!shouldSubmit(period, isGameDay, injuryActive)) {
          summary.byAthlete[athlete.uid].missed++;
          continue;
        }

        const m    = generateV3Metrics(athlete, cur, period, cfg.sessionType, gameDayEffect, lossStreak, injuryActive);
        const rpe  = clamp(gauss(isGameDay ? 8.5 : (cfg.rpeMin + cfg.rpeMax) / 2, 1.0), 1, 10);
        const workloadAU = Math.round(rpe * cfg.duration);
        const readiness  = calcReadiness(m);
        const friction   = genFriction(athlete, period, gameDayEffect, injuryActive);
        const aliases    = v2Aliases(m);
        const submitDate = submittedAtDate(cur, isGameDay);

        const responseData = {
          userId:        athlete.uid,
          teamId:        TEAM_ID,
          trainingId,
          sessionType:   cfg.sessionType,
          sessionRPE:    Math.round(rpe),
          duration:      cfg.duration,
          workloadAU,
          metrics: {
            // V3 native
            tankLevel:         m.tankLevel,
            cardioLoad:        m.cardioLoad,
            legBounce:         m.legBounce,
            motorControl:      m.motorControl,
            tacticalSharpness: m.tacticalSharpness,
            teamChemistry:     m.teamChemistry,
            // V2 aliases for backward compat
            neuroLoad:         aliases.neuroLoad,
            stressLevel:       aliases.stressLevel,
            sleepQuality:      aliases.sleepQuality,
            tacticalLucidity:  aliases.tacticalLucidity,
          },
          readinessScore: readiness,
          hasFriction:    friction.hasFriction,
          ...(friction.hasFriction ? {
            frictionType: friction.frictionType,
            worryLevel:   friction.worryLevel,
            worryFlag:    friction.worryFlag,
          } : {}),
          status:      'completed',
          isTest:      false,
          period,
          submittedAt: submitDate,
          createdAt:   submitDate,
        };

        queue.push(writeOp(
          `teams/${TEAM_ID}/trainings/${trainingId}/responses`,
          athlete.uid,
          responseData,
        ));
        responseCount++;

        // Summary accumulators
        summary.byAthlete[athlete.uid].submitted++;
        summary.byAthlete[athlete.uid].readinessSum += readiness;
        if (friction.worryFlag) summary.byAthlete[athlete.uid].worryFlags++;
        if (summary.byPeriod[period]) {
          summary.byPeriod[period].count++;
          summary.byPeriod[period].readinessSum += readiness;
        }
      }

      trainingCount++;
      if (trainingCount % 15 === 0) {
        const pct = Math.round((cur - SEASON_START) / (SEASON_END - SEASON_START) * 100);
        process.stdout.write(`   📊  ${iso}  ${period.padEnd(14)}  ${pct}%  [${responseCount} responses queued]\n`);
        await flush(token);
      }
    }

    // Advance day
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  await flush(token, true);

  // ── 3) Summary report ──────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('📊  SEASON SUMMARY');
  console.log('─'.repeat(60));
  console.log(`\n  Trainings : ${trainingCount}`);
  console.log(`  Responses : ${responseCount}`);
  console.log(`  Firestore : ${totalOps} ops in ${batchNum} batches`);
  console.log(`\n  Record    : ${summary.games.wins}W – ${summary.games.losses}L (${GAMES.length} games)\n`);

  console.log('  PERIOD AVG READINESS:');
  for (const [period, data] of Object.entries(summary.byPeriod)) {
    if (data.count === 0) continue;
    const avg = Math.round(data.readinessSum / data.count);
    console.log(`    ${period.padEnd(16)}  ${avg}/100  (${data.count} responses)`);
  }

  console.log('\n  ATHLETE REPORT:');
  console.log('  ' + 'Name'.padEnd(20) + 'Submitted  Missed  AvgReady  WorryFlags');
  console.log('  ' + '─'.repeat(58));
  for (const a of athletes) {
    const s = summary.byAthlete[a.uid];
    const total = s.submitted + s.missed;
    const rate  = total > 0 ? Math.round(s.submitted / total * 100) : 0;
    const avg   = s.submitted > 0 ? Math.round(s.readinessSum / s.submitted) : '-';
    console.log(
      `  ${a.name.padEnd(20)}${String(s.submitted).padStart(4)} (${String(rate).padStart(2)}%)` +
      `  ${String(s.missed).padStart(5)}  ${String(avg).padStart(7)}/100  ${s.worryFlags}`
    );
  }

  console.log('\n🏆  Season seed complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err.message || err);
  process.exit(1);
});
