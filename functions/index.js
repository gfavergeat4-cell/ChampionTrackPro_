/* Cloud Functions – Sync ICS (CRON + callable)
 * - Lit teams/{teamId}.icsUrl
 * - Parse ICS (node-ical), expansion récurrences + EXDATE
 * - Upsert vers teams/{teamId}/events/{eventId}
 * - Champs: cancelled, lastSeenAt, updatedAt, hash (sha256 du payload utile)
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const ical = require("node-ical");
const fetch = require("node-fetch"); // v2 CJS
const crypto = require("crypto");

try { admin.app(); } catch { admin.initializeApp(); }
const db = admin.firestore();

const REGION = "us-central1";   // adapte si besoin
const CRON   = "every 10 minutes";
const EXPANSION_DAYS = 180;     // 6 mois

function makeHash(ev) {
  const json = JSON.stringify({
    title: ev.title || "",
    description: ev.description || "",
    location: ev.location || "",
    start: ev.start && ev.start.toISOString ? ev.start.toISOString() : (ev.start || ""),
    end: ev.end && ev.end.toISOString ? ev.end.toISOString() : (ev.end || ""),
    status: ev.status || "",
    allDay: !!ev.allDay,
    cancelled: !!ev.cancelled,
  });
  return crypto.createHash("sha256").update(json).digest("hex");
}

function eventDocId(uid, start) {
  const key = (uid || "NOUID") + "_" + (+start);
  return crypto.createHash("sha1").update(key).digest("hex");
}

function expandEvents(parsed, windowStart, windowEnd) {
  const out = [];

  for (const k in parsed) {
    const item = parsed[k];
    if (!item || item.type !== "VEVENT") continue;

    const base = {
      uid: item.uid || null,
      title: item.summary || "",
      description: item.description || "",
      location: item.location || "",
      status: (item.status || "CONFIRMED").toUpperCase(),
      source: "ics",
    };

    const isAllDay =
      (item.datetype && item.datetype === "date") ||
      (item.start && typeof item.start.toISOString !== "function");

    const durationMs = item.duration
      ? item.duration.asSeconds() * 1000
      : (item.end && item.start ? (new Date(item.end) - new Date(item.start)) : 0);

    if (item.rrule) {
      const ex = new Set();
      if (item.exdate) {
        Object.values(item.exdate).forEach(d => ex.add(+new Date(d)));
      }
      const dates = item.rrule.between(windowStart, windowEnd, true);
      dates.forEach(function(dt) {
        const start = new Date(dt);
        if (ex.has(+start)) return;
        const end = new Date(+start + (durationMs || 0));
        out.push({
          ...base,
          start: start,
          end: end,
          allDay: !!isAllDay,
          cancelled: base.status === "CANCELLED",
        });
      });
    } else if (item.recurrences) {
      for (const rk in item.recurrences) {
        const inst = item.recurrences[rk];
        if (inst && inst.exdate) continue;
        const start = new Date(inst.start);
        const end = new Date(inst.end);
        if (start >= windowStart && start <= windowEnd) {
          out.push({
            ...base,
            start: start,
            end: end,
            allDay: !!isAllDay,
            cancelled: base.status === "CANCELLED",
          });
        }
      }
    } else {
      if (!item.start || !item.end) continue;
      const start = new Date(item.start);
      const end = new Date(item.end);
      if (start >= windowStart && start <= windowEnd) {
        out.push({
          ...base,
          start: start,
          end: end,
          allDay: !!isAllDay,
          cancelled: base.status === "CANCELLED",
        });
      }
    }
  }

  return out;
}

async function syncTeam(teamId) {
  const tRef = db.collection("teams").doc(teamId);
  const tSnap = await tRef.get();
  if (!tSnap.exists) throw new Error("Team " + teamId + " introuvable");
  const t = tSnap.data() || {};
  const icsUrl = t.icsUrl;
  if (!icsUrl) return { seen: 0, created: 0, updated: 0, cancelled: 0, note: "no icsUrl" };

  const now = new Date();
  const windowStart = new Date();
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + EXPANSION_DAYS);

  const res = await fetch(icsUrl);
  if (!res.ok) throw new Error("Fetch ICS HTTP " + res.status);
  const icsText = await res.text();
  const parsed = ical.sync.parseICS(icsText);

  const instances = expandEvents(parsed, windowStart, windowEnd);

  let seen = 0, created = 0, updated = 0, cancelled = 0;
  const evCol = tRef.collection("events");
  const batch = db.batch();

  for (const ev of instances) {
    seen++;
    const id = eventDocId(ev.uid, ev.start);
    const ref = evCol.doc(id);

    const payload = {
      title: ev.title,
      description: ev.description || "",
      location: ev.location || "",
      start: admin.firestore.Timestamp.fromDate(ev.start),
      end: admin.firestore.Timestamp.fromDate(ev.end),
      allDay: !!ev.allDay,
      uid: ev.uid || null,
      status: ev.status || "CONFIRMED",
      source: "ics",
      cancelled: !!ev.cancelled,
      hash: makeHash(ev),
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const cur = await ref.get();
    if (!cur.exists) {
      batch.set(ref, payload, { merge: true });
      if (payload.cancelled) cancelled++;
      else created++;
    } else {
      const prev = cur.data() || {};
      if (prev.hash !== payload.hash || prev.cancelled !== payload.cancelled) {
        batch.set(ref, payload, { merge: true });
        if (payload.cancelled && !prev.cancelled) cancelled++;
        else updated++;
      } else {
        batch.set(ref, { lastSeenAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }
    }
  }

  await batch.commit();
  await tRef.set({ lastIcsSyncAt: admin.firestore.Timestamp.fromDate(now) }, { merge: true });

  return { seen: seen, created: created, updated: updated, cancelled: cancelled };
}

exports.syncIcsNow = functions.region(REGION).https.onCall(async (data, context) => {
  const teamId = data && data.teamId ? data.teamId : null;
  if (!teamId) {
    throw new functions.https.HttpsError("invalid-argument", "teamId requis");
  }
  // TODO: vérifier context.auth + rôle (admin/coach)
  const result = await syncTeam(teamId);
  return result;
});

exports.syncIcsEvery10min = functions
  .region(REGION)
  .pubsub.schedule(CRON)
  .onRun(async () => {
    const snap = await db.collection("teams").where("icsUrl", ">", "").get();
    let totals = { seen: 0, created: 0, updated: 0, cancelled: 0 };
    for (const doc of snap.docs) {
      try {
        const t = await syncTeam(doc.id);
        totals.seen += t.seen;
        totals.created += t.created;
        totals.updated += t.updated;
        totals.cancelled += t.cancelled;
      } catch (e) {
        console.error("sync error team:", doc.id, e.message);
      }
    }
    console.log("ICS sync done:", totals);
    return null;
  });

/**
 * Cloud Function callable pour créer un membership athlète
 * Utilise l'Admin SDK pour contourner les règles Firestore si nécessaire
 */
exports.createMembership = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Auth required");
  }

  const uid = context.auth.uid;
  const { teamId, email, name } = data || {};

  if (!teamId) {
    throw new functions.https.HttpsError("invalid-argument", "teamId required");
  }

  return db.runTransaction(async (tx) => {
    const teamRef = db.doc(`teams/${teamId}`);
    const teamSnap = await tx.get(teamRef);

    if (!teamSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Team not found");
    }

    const memberRef = teamRef.collection("members").doc(uid);
    const userRef = db.doc(`users/${uid}`);
    const displayName = (name && String(name).trim()) || (email ? email.split("@")[0] : uid);

    // 1) Créer/mettre à jour le membership
    tx.set(
      memberRef,
      {
        uid,
        name: displayName,
        email: email || "",
        role: "athlete",
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 2) Mettre à jour l'utilisateur
    tx.set(
      userRef,
      {
        teamId,
        role: "athlete",
        email: email || "",
        displayName: displayName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 3) Incrémenter le compteur de membres
    const current = (teamSnap.data()?.members ?? 0);
    tx.update(teamRef, { members: current + 1 });

    return { ok: true };
  });
});

/**
 * Cloud Function planifiée : envoie une notification "questionnaire disponible"
 * pour les trainings qui viennent de se terminer et qui n'ont pas encore envoyé de notification.
 * 
 * S'exécute toutes les 5 minutes et vérifie les trainings terminés dans les 30 dernières minutes.
 */
exports.sendQuestionnaireAvailableNotifications = functions
  .region(REGION)
  .pubsub.schedule("every 5 minutes")
  .timeZone("Europe/Paris")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const nowMs = now.toMillis();

    // Fenêtre : trainings terminés il y a 0-30 minutes
    const minEnd = admin.firestore.Timestamp.fromMillis(nowMs - 30 * 60 * 1000);
    const maxEnd = admin.firestore.Timestamp.fromMillis(nowMs + 2 * 60 * 1000);

    console.log("[NOTIF][CRON] Checking trainings between", minEnd.toDate(), "and", maxEnd.toDate());

    // Les trainings sont dans teams/{teamId}/trainings
    // On doit itérer sur toutes les équipes ou utiliser une collection group query
    // Pour l'instant, on itère sur les équipes qui ont des trainings
    const teamsSnap = await db.collection("teams").get();
    
    let allTrainings = [];
    
    // Parcourir toutes les équipes et chercher les trainings
    for (const teamDoc of teamsSnap.docs) {
      const teamId = teamDoc.id;
      const trainingsSnap = await db
        .collection("teams")
        .doc(teamId)
        .collection("trainings")
        .where("endUtc", ">=", minEnd)
        .where("endUtc", "<=", maxEnd)
        .where("questionnaireNotified", "==", false)
        .get();
      
      trainingsSnap.docs.forEach(doc => {
        allTrainings.push({
          doc: doc,
          teamId: teamId,
          data: doc.data()
        });
      });
    }
    
    const snap = {
      size: allTrainings.length,
      docs: allTrainings.map(t => t.doc)
    };

    console.log("[NOTIF][CRON] Found", snap.size, "trainings to notify");

    const batch = db.batch();
    let notificationsSent = 0;

    for (let i = 0; i < snap.docs.length; i++) {
      const docSnap = snap.docs[i];
      const trainingInfo = allTrainings[i];
      const training = docSnap.data();
      const trainingId = docSnap.id;
      const teamId = trainingInfo.teamId;
      const title = training.title || training.summary || "Training session";
      const endTime = training.endUtc?.toDate?.() ?? null;
      
      if (!teamId) {
        console.warn("[NOTIF][CRON] Training", trainingId, "has no teamId");
        continue;
      }

      // Récupérer les membres de l'équipe (athlètes)
      const membersSnap = await db
        .collection("teams")
        .doc(teamId)
        .collection("members")
        .where("role", "==", "athlete")
        .get();

      if (membersSnap.empty) {
        console.log("[NOTIF][CRON] No athletes found for team", teamId);
        batch.update(docSnap.ref, {
          questionnaireNotified: true,
          questionnaireNotifiedAt: now,
        });
        continue;
      }

      // URL de deep-link vers l'app web + questionnaire
      const clickAction = `https://championtrackpro.vercel.app/?sessionId=${trainingId}&openQuestionnaire=1`;

      // Envoyer une notification à chaque athlète
      for (const memberDoc of membersSnap.docs) {
        const uid = memberDoc.id;
        const userDoc = await db.collection("users").doc(uid).get();
        
        if (!userDoc.exists) {
          console.warn("[NOTIF][CRON] User", uid, "not found");
          continue;
        }

        const userData = userDoc.data() || {};
        const tokens = userData.fcmWebTokens || [];

        if (tokens.length === 0) {
          console.log("[NOTIF][CRON] No FCM tokens for user", uid);
          continue;
        }

        const message = {
          tokens,
          data: {
            title: "Questionnaire available",
            body: `Rate your session: ${title}`,
            clickAction,
            trainingId,
            teamId,
          },
          notification: {
            title: "Questionnaire available",
            body: `Rate your session: ${title}`,
          },
          webpush: {
            fcmOptions: {
              link: clickAction,
            },
          },
        };

        try {
          const resp = await admin.messaging().sendMulticast(message);
          console.log(
            `[NOTIF][FCM] training ${trainingId}, user ${uid}, success ${resp.successCount}, failure ${resp.failureCount}`
          );
          
          // Nettoyer les tokens invalides
          if (resp.failureCount > 0) {
            const invalidTokens = [];
            resp.responses.forEach((resp, idx) => {
              if (!resp.success) {
                if (resp.error?.code === "messaging/invalid-registration-token" ||
                    resp.error?.code === "messaging/registration-token-not-registered") {
                  invalidTokens.push(tokens[idx]);
                }
              }
            });
            
            if (invalidTokens.length > 0) {
              const userRef = db.collection("users").doc(uid);
              const currentTokens = userData.fcmWebTokens || [];
              const updatedTokens = currentTokens.filter(t => !invalidTokens.includes(t));
              await userRef.update({ fcmWebTokens: updatedTokens });
              console.log(`[NOTIF][FCM] Removed ${invalidTokens.length} invalid tokens for user ${uid}`);
            }
          }
          
          notificationsSent += resp.successCount;
        } catch (err) {
          console.error("[NOTIF][FCM] Error sending notification", err);
        }
      }

      // Marquer le training comme notifié
      // Utiliser la référence correcte avec le teamId
      const trainingRef = db
        .collection("teams")
        .doc(teamId)
        .collection("trainings")
        .doc(trainingId);
      
      batch.update(trainingRef, {
        questionnaireNotified: true,
        questionnaireNotifiedAt: now,
      });
    }

    await batch.commit();
    console.log("[NOTIF][CRON] Sent", notificationsSent, "notifications total");
    return null;
  });