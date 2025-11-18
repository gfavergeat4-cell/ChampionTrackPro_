import { collection, query, where, orderBy, Timestamp, getDocs } from "firebase/firestore";
import { db } from "@/services/firebaseConfig";

/**
 * Récupère tous les entraînements d’une équipe dans une plage donnée.
 * Uniquement depuis teams/{teamId}/trainings (pas d’accès à events/).
 */
export async function getTrainingsInRange(teamId, startMs, endMs) {
  const col = collection(db, "teams", teamId, "trainings");
  const q = query(
    col,
    where("startUtc", ">=", Timestamp.fromMillis(startMs)),
    where("startUtc", "<=", Timestamp.fromMillis(endMs)),
    orderBy("startUtc", "asc")
  );
  console.log("[FS][ATHLETE] get trainings range", { path: `teams/${teamId}/trainings`, startMs, endMs });
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}