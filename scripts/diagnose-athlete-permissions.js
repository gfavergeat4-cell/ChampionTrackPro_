/**
 * Script de diagnostic pour vérifier les permissions d'un athlète
 * 
 * Usage: node scripts/diagnose-athlete-permissions.js <uid>
 * 
 * Ce script vérifie:
 * 1. Si users/{uid} existe et contient teamId
 * 2. Si teams/{teamId}/members/{uid} existe
 * 3. Si teams/{teamId}/trainings existe et contient des documents
 * 4. Si les règles Firestore permettent la lecture
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialiser Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'championtrackpro'
  });
}

const db = admin.firestore();

async function diagnoseAthletePermissions(uid) {
  console.log(`\n🔍 Diagnostic des permissions pour l'athlète: ${uid}\n`);
  
  try {
    // 1. Vérifier users/{uid}
    console.log('1️⃣ Vérification de users/{uid}...');
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      console.error('❌ users/{uid} n\'existe pas');
      return;
    }
    
    const userData = userSnap.data();
    const teamId = userData?.teamId;
    console.log('✅ users/{uid} existe');
    console.log(`   - teamId: ${teamId || 'NON DÉFINI'}`);
    console.log(`   - role: ${userData?.role || 'NON DÉFINI'}`);
    console.log(`   - email: ${userData?.email || 'NON DÉFINI'}`);
    
    if (!teamId) {
      console.error('❌ teamId non défini dans users/{uid}');
      return;
    }
    
    // 2. Vérifier teams/{teamId}/members/{uid}
    console.log(`\n2️⃣ Vérification de teams/${teamId}/members/${uid}...`);
    const memberRef = db.doc(`teams/${teamId}/members/${uid}`);
    const memberSnap = await memberRef.get();
    
    if (!memberSnap.exists) {
      console.error('❌ teams/{teamId}/members/{uid} n\'existe pas');
      console.log('   → Le membership doit être créé pour permettre la lecture des trainings');
    } else {
      console.log('✅ teams/{teamId}/members/{uid} existe');
      const memberData = memberSnap.data();
      console.log(`   - role: ${memberData?.role || 'NON DÉFINI'}`);
      console.log(`   - joinedAt: ${memberData?.joinedAt?.toDate?.() || 'NON DÉFINI'}`);
    }
    
    // 3. Vérifier teams/{teamId}
    console.log(`\n3️⃣ Vérification de teams/${teamId}...`);
    const teamRef = db.doc(`teams/${teamId}`);
    const teamSnap = await teamRef.get();
    
    if (!teamSnap.exists) {
      console.error(`❌ teams/${teamId} n'existe pas`);
      return;
    }
    
    const teamData = teamSnap.data();
    console.log('✅ teams/{teamId} existe');
    console.log(`   - name: ${teamData?.name || 'NON DÉFINI'}`);
    console.log(`   - calendarImported: ${teamData?.calendarImported || false}`);
    console.log(`   - members: ${teamData?.members || 0}`);
    
    // 4. Vérifier teams/{teamId}/trainings
    console.log(`\n4️⃣ Vérification de teams/${teamId}/trainings...`);
    const trainingsRef = teamRef.collection('trainings');
    const trainingsSnapshot = await trainingsRef.limit(5).get();
    
    console.log(`✅ teams/{teamId}/trainings existe`);
    console.log(`   - Nombre de documents: ${trainingsSnapshot.size}`);
    
    if (trainingsSnapshot.empty) {
      console.warn('⚠️ Aucun training trouvé dans teams/{teamId}/trainings');
    } else {
      console.log('\n   📋 Exemples de trainings:');
      trainingsSnapshot.docs.slice(0, 3).forEach((docSnap, index) => {
        const data = docSnap.data();
        const startUtc = data.startUtc;
        const startMillis = startUtc?.toMillis?.() || startUtc || null;
        console.log(`   ${index + 1}. ${docSnap.id}:`);
        console.log(`      - title: ${data.title || 'NON DÉFINI'}`);
        console.log(`      - startUtc: ${startUtc ? (startUtc.toMillis ? startUtc.toMillis() : startUtc) : 'NON DÉFINI'}`);
        console.log(`      - displayTz: ${data.displayTz || 'NON DÉFINI'}`);
        console.log(`      - teamId: ${data.teamId || 'NON DÉFINI'}`);
      });
    }
    
    // 5. Résumé
    console.log(`\n📊 Résumé:`);
    console.log(`   - users/{uid} existe: ✅`);
    console.log(`   - users/{uid}.teamId: ${teamId ? '✅' : '❌'}`);
    console.log(`   - teams/{teamId}/members/{uid} existe: ${memberSnap.exists ? '✅' : '❌'}`);
    console.log(`   - teams/{teamId}/trainings contient des documents: ${trainingsSnapshot.size > 0 ? '✅' : '❌'}`);
    
    if (!memberSnap.exists) {
      console.log(`\n⚠️ ACTION REQUISE: Créer teams/${teamId}/members/${uid}`);
      console.log(`   Le membership manquant empêche la lecture des trainings selon les règles Firestore.`);
    }
    
    if (trainingsSnapshot.empty) {
      console.log(`\n⚠️ ACTION REQUISE: Importer un calendrier ICS pour teams/${teamId}`);
      console.log(`   Aucun training trouvé dans teams/{teamId}/trainings.`);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  }
}

// Récupérer l'UID depuis les arguments de la ligne de commande
const uid = process.argv[2];

if (!uid) {
  console.error('❌ Usage: node scripts/diagnose-athlete-permissions.js <uid>');
  process.exit(1);
}

diagnoseAthletePermissions(uid)
  .then(() => {
    console.log('\n✅ Diagnostic terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });


