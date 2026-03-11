/**
 * fix-coach-membership.js
 * One-time admin script: adds coach to teams/members subcollection.
 * Run: node scripts/fix-coach-membership.js
 */
const admin = require("firebase-admin");

// Uses Application Default Credentials (set via GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "championtrackpro",
});

const db = admin.firestore();

const TEAM_ID  = "Ri8kpStgWp9yymtS71tb";
const COACH_UID = "fqXEQa0rjPdQcsCEcORWefOSzWw1";

async function main() {
  console.log(`Adding coach ${COACH_UID} to team ${TEAM_ID} members subcollection...`);

  const memberRef = db
    .collection("teams")
    .doc(TEAM_ID)
    .collection("members")
    .doc(COACH_UID);

  const existing = await memberRef.get();
  if (existing.exists) {
    console.log("Member doc already exists:", existing.data());
  }

  await memberRef.set({
    role: "coach",
    uid: COACH_UID,
    addedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const verify = await memberRef.get();
  console.log("✔  Member doc written:", verify.data());

  // Also verify the team doc itself
  const teamDoc = await db.collection("teams").doc(TEAM_ID).get();
  if (teamDoc.exists) {
    console.log("Team doc:", { id: teamDoc.id, ...teamDoc.data() });
  } else {
    console.warn("WARNING: team doc does not exist at teams/" + TEAM_ID);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});
