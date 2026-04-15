/**
 * diagnose-dashboard.js
 * Authenticates as coach, queries Firestore, diagnoses empty chart root cause.
 */
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const {
  getFirestore, collection, collectionGroup,
  query, where, getDocs, Timestamp, doc, getDoc,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDwslrK0lbuqsBl61C_l3gjVDGF8ZqTZ5o",
  authDomain: "championtrackpro.firebaseapp.com",
  projectId: "championtrackpro",
  storageBucket: "championtrackpro.firebasestorage.app",
  messagingSenderId: "308674968497",
  appId: "1:308674968497:web:5f8d10b09ee98717a81b90",
};

const TEAM_ID = 'Ri8kpStgWp9yymtS71tb';

async function diagnose() {
  console.log('🔍 ChampionTrackPro Dashboard Diagnosis\n');

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // ── 1) Auth ───────────────────────────────────────────────────────────────
  console.log('1) Authenticating as coach (coachgabtest@gmail.com)...');
  const { user } = await signInWithEmailAndPassword(auth, 'coachgabtest@gmail.com', 'aznee366');
  console.log(`   ✅ uid: ${user.uid}\n`);

  // ── 2) User doc ───────────────────────────────────────────────────────────
  console.log('2) Reading coach user doc...');
  const userSnap = await getDoc(doc(db, 'users', user.uid));
  if (userSnap.exists()) {
    const ud = userSnap.data();
    console.log(`   role: ${ud.role}`);
    console.log(`   teamId: ${ud.teamId}`);
    console.log(`   ✅ User doc OK\n`);
  } else {
    console.log('   ❌ User doc does NOT exist!\n');
  }

  // ── 3) Coach in members subcollection? ────────────────────────────────────
  console.log(`3) Checking if coach is in teams/${TEAM_ID}/members/${user.uid}...`);
  try {
    const memberSnap = await getDoc(doc(db, 'teams', TEAM_ID, 'members', user.uid));
    if (memberSnap.exists()) {
      console.log(`   ✅ Coach IS in members: ${JSON.stringify(memberSnap.data())}\n`);
    } else {
      console.log(`   ❌ Coach is NOT in members subcollection!\n`);
      console.log(`   → This causes isCoachOfTeam() to return false\n`);
      console.log(`   → collectionGroup("responses") queries WILL FAIL or return empty\n`);
    }
  } catch (e) {
    console.log(`   ❌ Error reading member doc: ${e.message}\n`);
  }

  // ── 4) Team members list ──────────────────────────────────────────────────
  console.log(`4) Loading team members...`);
  try {
    const memSnap = await getDocs(collection(db, 'teams', TEAM_ID, 'members'));
    console.log(`   ${memSnap.size} member docs found`);
    memSnap.docs.slice(0, 3).forEach(d => {
      const data = d.data();
      console.log(`   - ${d.id}: role=${data.role}, name=${data.name || data.displayName}`);
    });
    if (memSnap.size > 3) console.log(`   ... and ${memSnap.size - 3} more\n`);
    else console.log();
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}\n`);
  }

  // ── 5) collectionGroup responses — no date filter ─────────────────────────
  console.log(`5) collectionGroup("responses") where teamId == ${TEAM_ID} (no date filter)...`);
  try {
    const qAll = query(collectionGroup(db, 'responses'), where('teamId', '==', TEAM_ID));
    const snapAll = await getDocs(qAll);
    console.log(`   Total responses: ${snapAll.size}`);
    if (snapAll.size > 0) {
      const sample = snapAll.docs[0].data();
      console.log(`   Sample keys: ${Object.keys(sample).join(', ')}`);
      console.log(`   Sample.userId: ${sample.userId}`);
      console.log(`   Sample.trainingId: ${sample.trainingId}`);
      console.log(`   Sample.submittedAt: ${JSON.stringify(sample.submittedAt)}`);
      console.log(`   Sample.isTest: ${sample.isTest}`);
      console.log(`   Sample.metrics: ${JSON.stringify(sample.metrics)}`);
      console.log(`   Sample.readinessScore: ${sample.readinessScore}`);
    } else {
      console.log(`   ⚠️ 0 responses found — data may not be seeded or query is blocked`);
    }
    console.log();
  } catch (e) {
    console.log(`   ❌ Permission error: ${e.message}\n`);
  }

  // ── 6) Date-filtered query (last 30d) ─────────────────────────────────────
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  console.log(`6) Date-filtered query: ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`);
  try {
    const qDate = query(
      collectionGroup(db, 'responses'),
      where('teamId', '==', TEAM_ID),
      where('submittedAt', '>=', Timestamp.fromDate(start)),
      where('submittedAt', '<=', Timestamp.fromDate(end)),
    );
    const snapDate = await getDocs(qDate);
    console.log(`   Responses in last 30d: ${snapDate.size}`);
    if (snapDate.size > 0) {
      const sample = snapDate.docs[0].data();
      console.log(`   First submittedAt: ${sample.submittedAt?.toDate?.()?.toISOString()}`);
      console.log(`   ✅ Data is accessible for date range\n`);
    } else {
      console.log(`   ⚠️ 0 results — season data may be outside this range\n`);

      // Try full season range
      console.log(`   Retrying with full season (Oct 1 2025 → Mar 20 2026)...`);
      const seasonStart = new Date('2025-10-01T00:00:00Z');
      const seasonEnd = new Date('2026-03-20T23:59:59Z');
      const qSeason = query(
        collectionGroup(db, 'responses'),
        where('teamId', '==', TEAM_ID),
        where('submittedAt', '>=', Timestamp.fromDate(seasonStart)),
        where('submittedAt', '<=', Timestamp.fromDate(seasonEnd)),
      );
      const snapSeason = await getDocs(qSeason);
      console.log(`   Full season responses: ${snapSeason.size}`);
      if (snapSeason.size > 0) {
        const s = snapSeason.docs[0].data();
        console.log(`   First doc submittedAt: ${s.submittedAt?.toDate?.()?.toISOString()}`);
        console.log(`   First doc userId: ${s.userId}`);
        console.log(`   First doc trainingId: ${s.trainingId}`);
      }
      console.log();
    }
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}\n`);
  }

  // ── 7) Direct path read (bypass collectionGroup) ──────────────────────────
  console.log(`7) Listing trainings directly...`);
  try {
    const trainSnap = await getDocs(collection(db, 'teams', TEAM_ID, 'trainings'));
    console.log(`   Training docs: ${trainSnap.size}`);
    if (trainSnap.size > 0) {
      const t = trainSnap.docs[0];
      const td = t.data();
      console.log(`   First training: ${t.id} — sessionType=${td.sessionType}`);

      // Read responses for this training
      const respSnap = await getDocs(collection(db, 'teams', TEAM_ID, 'trainings', t.id, 'responses'));
      console.log(`   Responses in first training: ${respSnap.size}`);
      if (respSnap.size > 0) {
        const r = respSnap.docs[0].data();
        console.log(`   Sample response userId: ${r.userId}`);
        console.log(`   Sample response metrics: ${JSON.stringify(r.metrics)}`);
      }
    }
    console.log();
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}\n`);
  }

  console.log('✅ Diagnosis complete');
  process.exit(0);
}

diagnose().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
