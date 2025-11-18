// src/services/webNotifications.ts
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, arrayUnion, getDoc } from "firebase/firestore";
import { auth, db, getWebMessaging } from "../../web/firebaseConfig.web";

const VAPID_KEY = process.env.EXPO_PUBLIC_FCM_VAPID_KEY || process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

/**
 * Enregistre le token FCM pour l'utilisateur actuel
 * Demande la permission de notification si nécessaire
 */
export async function registerWebPushTokenForCurrentUser(): Promise<void> {
  if (typeof window === "undefined") {
    console.log("[NOTIF] Server-side, skipping FCM registration");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    console.log("[NOTIF] No authenticated user, skipping FCM registration");
    return;
  }

  if (!("Notification" in window)) {
    console.warn("[NOTIF] Browser does not support notifications");
    return;
  }

  // Demander la permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.log("[NOTIF] Notification permission not granted:", permission);
    return;
  }

  const messaging = await getWebMessaging();
  if (!messaging) {
    console.warn("[NOTIF] Messaging not available");
    return;
  }

  if (!VAPID_KEY) {
    console.warn("[NOTIF] VAPID key missing. Set EXPO_PUBLIC_FCM_VAPID_KEY or NEXT_PUBLIC_FCM_VAPID_KEY");
    return;
  }

  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) {
      console.warn("[NOTIF] No FCM token received");
      return;
    }

    // Vérifier si le token existe déjà
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();
    const existingTokens: string[] = userData?.fcmWebTokens || [];

    if (existingTokens.includes(token)) {
      console.log("[NOTIF] Token already registered for user", user.uid);
      return;
    }

    // Ajouter le token à la liste
    await setDoc(
      doc(db, "users", user.uid),
      {
        fcmWebTokens: arrayUnion(token),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    console.log("[NOTIF] Web FCM token registered for user", user.uid);
  } catch (err) {
    console.error("[NOTIF] Error getting FCM token", err);
  }
}

/**
 * Configure le handler pour les messages en foreground (quand l'app est ouverte)
 */
export function setupForegroundMessageHandler(): (() => void) | null {
  if (typeof window === "undefined") return null;

  getWebMessaging().then((messaging) => {
    if (!messaging) return;

    onMessage(messaging, (payload) => {
      console.log("[NOTIF] Foreground message received:", payload);
      
      const { title, body, icon, clickAction } = payload.data || {};
      
      // Afficher une notification même en foreground
      if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification(title || "ChampionTrackPro", {
          body: body || "Questionnaire available",
          icon: icon || "/icon-192.png",
          data: { clickAction },
        });

        notification.onclick = (event) => {
          event.preventDefault();
          if (clickAction) {
            window.open(clickAction, "_blank");
          }
          notification.close();
        };
      }
    });
  }).catch((err) => {
    console.error("[NOTIF] Error setting up foreground handler", err);
  });

  return null;
}

