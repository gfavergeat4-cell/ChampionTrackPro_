import { db, app } from "./firebaseConfig";
import {
  doc, setDoc, getDoc, addDoc, collection,
  serverTimestamp, query, where, getDocs
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// Crée une équipe et génère des codes coach/athlète
export async function createTeam(teamName) {
  const code = () => Math.random().toString(36).slice(2, 8).toUpperCase();
  const coachCode = "C-" + code();
  const athleteCode = "A-" + code();
  const ref = await addDoc(collection(db, "teams"), {
    name: teamName,
    createdAt: serverTimestamp(),
    codes: { coach: coachCode, athlete: athleteCode }
  });
  return { id: ref.id, coachCode, athleteCode };
}

// Vérifie code coach -> renvoie teamId si ok (via lookupTeamByCode CF)
export async function verifyCoachCode(codeStr) {
  try {
    const fns = getFunctions(app);
    const lookup = httpsCallable(fns, "lookupTeamByCode");
    const result = await lookup({ code: codeStr });
    if (result.data.role !== "coach") return null;
    return result.data.teamId;
  } catch {
    return null;
  }
}

// Vérifie code athlète -> renvoie teamId si ok (via lookupTeamByCode CF)
export async function verifyAthleteCode(codeStr) {
  try {
    const fns = getFunctions(app);
    const lookup = httpsCallable(fns, "lookupTeamByCode");
    const result = await lookup({ code: codeStr });
    if (result.data.role !== "athlete") return null;
    return result.data.teamId;
  } catch {
    return null;
  }
}

// Assigne un rôle + teamId à l'utilisateur
export async function setUserRoleAndTeam(uid, role, teamId = null) {
  const ref = doc(db, "users", uid);
  const prev = await getDoc(ref);
  const base = prev.exists() ? prev.data() : {};
  await setDoc(ref, {
    ...base,
    role,
    teamId: teamId ?? base.teamId ?? null,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// Métadonnées utilisateur
export async function getUserMeta(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// Admin = users/{uid}.role === "admin"
export async function isAdminUser(uid) {
  try {
    const u = await getDoc(doc(db, "users", uid));
    return u.exists() && u.data()?.role === "admin";
  } catch {
    return false;
  }
}
