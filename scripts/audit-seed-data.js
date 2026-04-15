/**
 * audit-seed-data.js — exact queries from the task spec
 */
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const {
  getFirestore, collection, collectionGroup,
  query, where, getDocs, doc, getDoc,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDwslrK0lbuqsBl61C_l3gjVDGF8ZqTZ5o",
  authDomain: "championtrackpro.firebaseapp.com",
  projectId: "championtrackpro",
  storageBucket: "championtrackpro.firebasestorage.app",
  messagingSenderId: "308674968497",
  appId: "1:308674968497:web:5f8d10b09ee98717a81b90",
};

const teamId = 'Ri8kpStgWp9yymtS71tb';

async function run() {
  const app  = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getFirestore(app);

  const { user } = await signInWithEmailAndPassword(auth, 'coachgabtest@gmail.com', 'aznee366');
  console.log('Signed in:', user.uid, '\n');

  // Count members
  const members = await getDocs(collection(db, 'teams', teamId, 'members'));
  console.log('=== MEMBERS ===');
  members.forEach(d => console.log(d.data().displayName || d.data().name, '|', d.data().role));

  // Count trainings
  const trainings = await getDocs(collection(db, 'teams', teamId, 'trainings'));
  console.log('=== TRAININGS ===', trainings.size);
  console.log('Sample training:', JSON.stringify(trainings.docs[0]?.data()));

  // Count responses via collectionGroup
  const responses = await getDocs(query(
    collectionGroup(db, 'responses'),
    where('teamId', '==', teamId)
  ));
  console.log('=== RESPONSES ===', responses.size);
  console.log('Sample response:', JSON.stringify(responses.docs[0]?.data()));
  console.log('All metric keys:', Object.keys(responses.docs[0]?.data()?.metrics || {}));

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
