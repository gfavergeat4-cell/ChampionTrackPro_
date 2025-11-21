// src/services/webNotifications.ts
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, arrayUnion, getDoc } from "firebase/firestore";
import { auth, db, app } from "../../web/firebaseConfig.web";
import { getMessaging, isSupported } from "firebase/messaging";
import { Platform } from "react-native";

const VAPID_KEY = process.env.EXPO_PUBLIC_FCM_VAPID_KEY || process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

/**
 * Fonction de débogage pour vérifier l'état des notifications et service workers
 */
export function debugWebPushStatus(): void {
  if (typeof window === "undefined" || Platform.OS !== "web") {
    return;
  }

  console.log("[WEB PUSH][DEBUG] ===== Web Push Debug Info =====");
  console.log("[WEB PUSH][DEBUG] Notification permission:", Notification.permission);
  console.log("[WEB PUSH][DEBUG] Service Worker support:", "serviceWorker" in navigator);
  console.log("[WEB PUSH][DEBUG] VAPID key present:", !!VAPID_KEY);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      console.log("[WEB PUSH][DEBUG] Active service workers:", registrations.length);
      registrations.forEach((registration, index) => {
        console.log(`[WEB PUSH][DEBUG] SW #${index + 1}:`, {
          scope: registration.scope,
          active: !!registration.active,
          waiting: !!registration.waiting,
          installing: !!registration.installing,
        });
      });
    }).catch((err) => {
      console.error("[WEB PUSH][DEBUG] Error getting SW registrations:", err);
    });
  }

  console.log("[WEB PUSH][DEBUG] =================================");
}

/**
 * Enregistre le service worker et récupère le token FCM pour l'utilisateur actuel
 * Demande la permission de notification si nécessaire
 * IMPORTANT: Uniquement pour le web, pas pour iOS/Android
 */
export async function registerWebPushTokenForCurrentUser(): Promise<void> {
  // Vérifier que nous sommes sur le web
  if (typeof window === "undefined" || Platform.OS !== "web") {
    console.log("[WEB PUSH] Not on web platform, skipping FCM registration");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    console.log("[WEB PUSH] No authenticated user, skipping FCM registration");
    return;
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.warn("[WEB PUSH] Browser does not support notifications or service workers");
    return;
  }

  if (!VAPID_KEY) {
    console.warn("[WEB PUSH] VAPID key missing. Set EXPO_PUBLIC_FCM_VAPID_KEY or NEXT_PUBLIC_FCM_VAPID_KEY");
    return;
  }

  // Afficher l'état de débogage
  debugWebPushStatus();

  // Demander la permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.log("[WEB PUSH] Notification permission not granted:", permission);
    return;
  }

  console.log("[WEB PUSH] Notification permission granted");

  try {
    // Enregistrer le service worker AVANT d'appeler getToken
    // IMPORTANT: Le path doit être exactement '/firebase-messaging-sw.js' (root)
    const swPath = '/firebase-messaging-sw.js';
    console.log('[WEB PUSH] Registering service worker at:', swPath);
    
    const registration = await navigator.serviceWorker.register(swPath, {
      scope: '/',
    });
    
    console.log('[WEB PUSH] Service worker registered successfully:', {
      scope: registration.scope,
      active: !!registration.active,
      installing: !!registration.installing,
      waiting: !!registration.waiting,
    });

    // Attendre que le service worker soit actif
    await navigator.serviceWorker.ready;
    console.log('[WEB PUSH] Service worker is ready');

    // Vérifier que le navigateur supporte les notifications avant d'initialiser messaging
    const supported = await isSupported();
    if (!supported) {
      console.warn('[WEB PUSH] Messaging not supported in this browser');
      return;
    }

    // Initialiser messaging avec l'instance Firebase app
    const messaging = getMessaging(app);
    console.log('[WEB PUSH] Firebase Messaging initialized');

    // Obtenir le token en passant le serviceWorkerRegistration
    console.log('[WEB PUSH] Requesting FCM token...');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn("[WEB PUSH] No FCM token received");
      return;
    }

    // Log le token (tronqué pour la sécurité)
    const tokenPreview = token.substring(0, 20) + '...' + token.substring(token.length - 10);
    console.log('[WEB PUSH] FCM token obtained:', tokenPreview);
    console.log('[WEB PUSH] Full token length:', token.length);

    // Vérifier si le token existe déjà
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data();
    const existingTokens: string[] = userData?.fcmWebTokens || [];

    if (existingTokens.includes(token)) {
      console.log("[WEB PUSH] Token already registered for user:", user.uid);
      return;
    }

    // Ajouter le token à la liste (append, ne pas overwrite)
    await setDoc(
      doc(db, "users", user.uid),
      {
        fcmWebTokens: arrayUnion(token),
        updatedAt: new Date(),
      },
      { merge: true }
    );

    console.log("[WEB PUSH] FCM token saved to Firestore for user:", user.uid);
    console.log("[WEB PUSH] Total tokens for user:", existingTokens.length + 1);
  } catch (err: any) {
    console.error("[WEB PUSH] Error registering service worker or getting FCM token:", err);
    console.error("[WEB PUSH] Error details:", {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
    });
  }
}

/**
 * Configure le handler pour les messages en foreground (quand l'app est ouverte)
 */
export function setupForegroundMessageHandler(): (() => void) | null {
  if (typeof window === "undefined") return null;

  try {
    const messaging = getMessaging(app);
    
    onMessage(messaging, (payload) => {
      console.log("[NOTIF] Foreground message received:", payload);
      
      const notificationTitle = payload.notification?.title || payload.data?.title || "ChampionTrackPro";
      const notificationBody = payload.notification?.body || payload.data?.body || "Questionnaire available";
      const icon = payload.notification?.icon || payload.data?.icon || "/icons/icon-192.png";
      const clickAction = payload.data?.clickAction;
      
      // Afficher une notification même en foreground
      if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification(notificationTitle, {
          body: notificationBody,
          icon: icon,
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
  } catch (err) {
    console.error("[NOTIF] Error setting up foreground handler", err);
  }

  return null;
}

