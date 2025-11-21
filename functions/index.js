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
const cors = require("cors")({ origin: true });

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

function cleanTitle(rawTitle, rawDescription) {
  if (!rawTitle) {
    return rawDescription && rawDescription.trim().length > 0
      ? rawDescription.trim()
      : "Training";
  }

  const t = String(rawTitle).trim();
  const lower = t.toLowerCase();

  if (lower === "busy" || lower === "occupé" || lower === "occupied" || lower === "blocked") {
    if (rawDescription && rawDescription.trim().length > 0) {
      return rawDescription.trim();
    }
    return "Training";
  }

  return t;
}

function expandEvents(parsed, windowStart, windowEnd) {
  const out = [];

  for (const k in parsed) {
    const item = parsed[k];
    if (!item || item.type !== "VEVENT") continue;

    const base = {
      uid: item.uid || null,
      title: cleanTitle(item.summary || "", item.description || ""),
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
  // Use 'trainings' collection instead of 'events' (matching the app structure)
  const evCol = tRef.collection("trainings");
  const batch = db.batch();

  for (const ev of instances) {
    seen++;
    const id = eventDocId(ev.uid, ev.start);
    const ref = evCol.doc(id);

    // Format compatible with app's training structure
    const startTimestamp = admin.firestore.Timestamp.fromDate(ev.start);
    const endTimestamp = admin.firestore.Timestamp.fromDate(ev.end);
    const startUtcMillis = ev.start.getTime();
    const endUtcMillis = ev.end.getTime();

    const cleanedTitle = cleanTitle(ev.title, ev.description || "");
    const payload = {
      teamId: teamId,
      title: cleanedTitle,
      summary: cleanedTitle, // Alias for compatibility
      description: ev.description || "",
      location: ev.location || "",
      startUtc: startTimestamp, // For Firestore queries
      endUtc: endTimestamp, // For Firestore queries
      startUTC: startUtcMillis, // Milliseconds UTC for app
      endUTC: endUtcMillis, // Milliseconds UTC for app
      allDay: !!ev.allDay,
      uid: ev.uid || null,
      status: ev.status || "CONFIRMED",
      source: "ics",
      cancelled: !!ev.cancelled,
      hash: makeHash(ev),
      timeZone: t.timeZone || "Europe/Paris",
      displayTz: t.timeZone || "Europe/Paris",
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      questionnaireNotified: false, // For notification system
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

// Callable function (preferred method with automatic CORS)
exports.syncIcsNow = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: '256MB'
  })
  .https.onCall(async (data, context) => {
    // CORS is automatically handled by onCall functions
    const teamId = data && data.teamId ? data.teamId : null;
    if (!teamId) {
      throw new functions.https.HttpsError("invalid-argument", "teamId requis");
    }
    
    try {
      const result = await syncTeam(teamId);
      return result;
    } catch (error) {
      console.error("[SYNC_ICS] Error:", error);
      throw new functions.https.HttpsError("internal", error.message || "Internal error during sync");
    }
  });

// HTTP function with explicit CORS (fallback if onCall has CORS issues)
exports.syncIcsNowHttp = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: '256MB'
  })
  .https.onRequest((req, res) => {
    // Use cors middleware to handle CORS properly
    cors(req, res, async () => {
      // Only allow POST
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      
      try {
        // Parse JSON body
        let body = req.body;
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
          } catch (e) {
            console.error("[SYNC_ICS][HTTP] Error parsing body:", e);
            res.status(400).json({ error: 'Invalid JSON body' });
            return;
          }
        }
        
        const { teamId } = body || {};
        
        if (!teamId) {
          res.status(400).json({ error: 'teamId requis' });
          return;
        }
        
        console.log("[SYNC_ICS][HTTP] Syncing team:", teamId);
        const result = await syncTeam(teamId);
        console.log("[SYNC_ICS][HTTP] Sync result:", result);
        
        res.status(200).json(result);
      } catch (error) {
        console.error("[SYNC_ICS][HTTP] Error:", error);
        res.status(500).json({ error: error.message || "Internal error during sync" });
      }
    });
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

async function importTeamCalendarCore(teamId, icsUrl) {
  if (!teamId || !icsUrl) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "teamId and icsUrl are required"
    );
  }

  let normalizedUrl = icsUrl.trim();
  try {
    new URL(normalizedUrl);
  } catch (e) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid ICS URL format"
    );
  }

  if (normalizedUrl.includes("calendar.google.com") && !normalizedUrl.includes("/public/basic.ics")) {
    const match = normalizedUrl.match(/calendar\.google\.com\/calendar\/ical\/([^\/\?]+)/);
    if (match && match[1]) {
      const calendarId = match[1];
      normalizedUrl = `https://calendar.google.com/calendar/ical/${calendarId}/public/basic.ics`;
      console.log("[IMPORT_ICS] Normalized Google Calendar URL:", normalizedUrl);
    }
  }

  // Verify team exists
  const teamRef = db.collection("teams").doc(teamId);
  const teamSnap = await teamRef.get();
  if (!teamSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Team not found");
  }
  const team = teamSnap.data() || {};

  console.log("[IMPORT_ICS] Downloading ICS from:", normalizedUrl);
  const response = await fetch(normalizedUrl, {
    method: "GET",
    headers: {
      Accept: "text/calendar, text/plain, */*",
      "User-Agent": "ChampionTrackPro-CloudFunction/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const icsText = await response.text();
  if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
    throw new Error("Invalid ICS content: missing BEGIN:VCALENDAR");
  }

  const teamTimeZone =
    team.timeZone ||
    team.tzid ||
    (team.settings && team.settings.timeZone) ||
    "Europe/Paris";

  const parsed = ical.sync.parseICS(icsText);
  const windowStart = new Date();
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + EXPANSION_DAYS);

  const instances = expandEvents(parsed, windowStart, windowEnd);
  console.log("[IMPORT_ICS] Expanded", instances.length, "event instances");

  const trainingsCol = teamRef.collection("trainings");
  let seen = 0;
  let created = 0;
  let updated = 0;
  let cancelled = 0;
  let batch = db.batch();
  const batchSize = 500;
  let batchCount = 0;

  const existingDocs = new Map();
  const existingSnap = await trainingsCol.get();
  existingSnap.docs.forEach((doc) => {
    existingDocs.set(doc.id, true);
  });

  for (const ev of instances) {
    seen++;
    const eventId = eventDocId(ev.uid, ev.start);
    const trainingRef = trainingsCol.doc(eventId);

    const startTimestamp = admin.firestore.Timestamp.fromDate(ev.start);
    const endTimestamp = admin.firestore.Timestamp.fromDate(ev.end);
    const startUtcMillis = ev.start.getTime();
    const endUtcMillis = ev.end.getTime();

    const trainingData = {
      teamId,
      title: ev.title || "Training",
      summary: ev.title || "Training",
      description: ev.description || "",
      location: ev.location || "",
      startUtc: startTimestamp,
      endUtc: endTimestamp,
      startUTC: startUtcMillis,
      endUTC: endUtcMillis,
      timeZone: teamTimeZone,
      displayTz: teamTimeZone,
      uid: ev.uid || null,
      status: ev.status || "CONFIRMED",
      source: "ics",
      cancelled: !!ev.cancelled,
      questionnaireNotified: false,
      hash: makeHash(ev),
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const exists = existingDocs.has(eventId);
    if (exists) {
      batch.update(trainingRef, trainingData);
      updated++;
    } else {
      batch.set(
        trainingRef,
        {
          ...trainingData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: false }
      );
      created++;
      existingDocs.set(eventId, true);
    }

    if (ev.cancelled) cancelled++;

    batchCount++;
    if (batchCount >= batchSize) {
      await batch.commit();
      batchCount = 0;
      batch = db.batch();
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  await teamRef.update({
    icsUrl: normalizedUrl,
    calendarImported: true,
    calendarImportedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastCalendarImport: {
      at: admin.firestore.FieldValue.serverTimestamp(),
      seen,
      created,
      updated,
      cancelled,
      source: "url",
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    seen,
    created,
    updated,
    cancelled,
    message: `Calendar imported successfully: ${created} created, ${updated} updated`,
  };
}

// NOTE: Deploying these functions (HTTP, callable, Pub/Sub) requires the Firebase project
// to run on the Blaze plan because Cloud Build + Artifact Registry must be enabled.
// On the free Spark plan they will work in local emulators but cannot be deployed.
exports.importTeamCalendarFromUrlCallable = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: "256MB",
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required");
    }
    const { teamId, icsUrl } = data || {};
    try {
      return await importTeamCalendarCore(teamId, icsUrl);
    } catch (error) {
      console.error("[IMPORT_ICS][CALLABLE] Error:", error);
      throw error;
    }
  });

exports.importTeamCalendarFromUrl = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: "256MB",
  })
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (err) {
          res.status(400).json({ error: "Invalid JSON body" });
          return;
        }
      }

      const { teamId, icsUrl } = body || {};

      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing Authorization header" });
        return;
      }

      const idToken = authHeader.replace("Bearer ", "").trim();
      try {
        await admin.auth().verifyIdToken(idToken);
      } catch (err) {
        console.error("[IMPORT_ICS][HTTP] Invalid token:", err);
        res.status(401).json({ error: "Invalid auth token" });
        return;
      }

      try {
        const result = await importTeamCalendarCore(teamId, icsUrl);
        res.status(200).json(result);
      } catch (error) {
        console.error("[IMPORT_ICS][HTTP] Error:", error);
        if (error instanceof functions.https.HttpsError) {
          const statusMap = {
            "invalid-argument": 400,
            "unauthenticated": 401,
            "not-found": 404,
            "permission-denied": 403,
          };
          const status = statusMap[error.code] || 500;
          res.status(status).json({ error: error.message });
        } else {
          res.status(500).json({ error: error.message || "Internal error" });
        }
      }
    });
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