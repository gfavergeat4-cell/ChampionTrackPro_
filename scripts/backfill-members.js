/**
 * Script de backfill pour créer les documents membership manquants
 * 
 * Usage:
 *   node scripts/backfill-members.js
 * 
 * Prérequis:
 *   - GOOGLE_APPLICATION_CREDENTIALS doit pointer vers la clé Admin SDK
 *   - firebase-admin doit être installé: npm install firebase-admin
 */

const admin = require("firebase-admin");

// Initialiser Firebase Admin
try {
  admin.app();
} catch {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: "championtrackpro", // Ajuster si nécessaire
  });
}

const db = admin.firestore();

(async () => {
  console.log("[BACKFILL] Démarrage...");

  try {
    // Récupérer tous les utilisateurs avec role=athlete et teamId défini
    const usersSnapshot = await db
      .collection("users")
      .where("role", "==", "athlete")
      .get();

    console.log(`[BACKFILL] ${usersSnapshot.size} athlètes trouvés`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const userDoc of usersSnapshot.docs) {
      const { teamId, email, displayName, fullName } = userDoc.data();
      const uid = userDoc.id;

      if (!teamId) {
        console.log(`[BACKFILL] ⚠️  ${uid}: pas de teamId, ignoré`);
        skipped++;
        continue;
      }

      // Vérifier si le membership existe déjà
      const memberRef = db.doc(`teams/${teamId}/members/${uid}`);
      const memberSnap = await memberRef.get();

      if (memberSnap.exists) {
        console.log(`[BACKFILL] ✓ ${uid}: membership existe déjà`);
        skipped++;
        continue;
      }

      // Créer le membership
      const name = fullName?.trim() || displayName?.trim() || (email ? email.split("@")[0] : uid);

      try {
        await memberRef.set(
          {
            uid,
            name,
            email: email || "",
            role: "athlete",
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log(`[BACKFILL] ✓ ${uid}: membership créé pour team ${teamId}`);
        created++;
      } catch (err) {
        console.error(`[BACKFILL] ✗ ${uid}: erreur`, err.message);
        errors++;
      }
    }

    console.log("\n[BACKFILL] Résumé:");
    console.log(`  - Créés: ${created}`);
    console.log(`  - Ignorés: ${skipped}`);
    console.log(`  - Erreurs: ${errors}`);
    console.log("[BACKFILL] Terminé.");

    process.exit(0);
  } catch (err) {
    console.error("[BACKFILL] Erreur fatale:", err);
    process.exit(1);
  }
})();


