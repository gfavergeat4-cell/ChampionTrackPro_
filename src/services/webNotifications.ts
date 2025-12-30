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
    const isProduction = typeof window !== 'undefined' && window.location.protocol === 'https:';
    
    console.log('[WEB PUSH] ===== Service Worker Registration =====');
    console.log('[WEB PUSH] Environment:', isProduction ? 'PRODUCTION (HTTPS)' : 'DEVELOPMENT');
    console.log('[WEB PUSH] Location origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A');
    console.log('[WEB PUSH] Current URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');
    console.log('[WEB PUSH] Is secure context:', typeof window !== 'undefined' ? window.isSecureContext : 'N/A');
    console.log('[WEB PUSH] Protocol:', typeof window !== 'undefined' ? window.location.protocol : 'N/A');
    console.log('[WEB PUSH] Registering service worker at:', swPath);
    console.log('[WEB PUSH] Notification permission:', Notification.permission);
    
    // Lister les service workers existants AVANT l'enregistrement
    const existingRegs = await navigator.serviceWorker.getRegistrations();
    console.log('[WEB PUSH] Existing service worker registrations (before):', existingRegs.length);
    existingRegs.forEach((reg, idx) => {
      console.log(`[WEB PUSH] Existing SW #${idx + 1}:`, {
        scope: reg.scope,
        active: !!reg.active,
        waiting: !!reg.waiting,
        installing: !!reg.installing,
      });
    });
    
    // Vérifier que nous sommes en HTTPS en production
    if (isProduction && window.location.protocol !== 'https:') {
      console.error('[WEB PUSH] ❌ Service workers require HTTPS in production');
      throw new Error('Service workers require HTTPS in production');
    }
    
    // FORCER l'enregistrement explicite du service worker
    console.log('[WEB PUSH] 🔵 FORCING SERVICE WORKER REGISTRATION...');
    console.log('[WEB PUSH] 🔵 Path:', swPath);
    console.log('[WEB PUSH] 🔵 Scope:', '/');
    console.log('[WEB PUSH] 🔵 Calling navigator.serviceWorker.register()...');
    
    const registration = await navigator.serviceWorker.register(swPath, {
      scope: '/',
    });
    
    console.log('[WEB PUSH] ✅✅✅ SERVICE WORKER REGISTERED SUCCESSFULLY ✅✅✅');
    console.log('[WEB PUSH] 🔵 Registration result:', {
      scope: registration.scope,
      active: !!registration.active,
      activeState: registration.active?.state,
      installing: !!registration.installing,
      installingState: registration.installing?.state,
      waiting: !!registration.waiting,
      waitingState: registration.waiting?.state,
      updateViaCache: registration.updateViaCache,
    });
    console.log('[WEB PUSH] 🔵 Registration scope matches origin:', registration.scope === window.location.origin + '/');
    console.log('[WEB PUSH] 🔵 Registration scope:', registration.scope);
    console.log('[WEB PUSH] 🔵 Expected scope:', window.location.origin + '/');

    // Attendre que le service worker soit actif
    // En production, cela peut prendre un peu plus de temps
    if (registration.waiting) {
      console.log('[WEB PUSH] Service worker is waiting, activating...');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // FORCER l'attente que le service worker soit prêt (active)
    // navigator.serviceWorker.ready retourne la registration avec un worker actif
    console.log('[WEB PUSH] 🔵 WAITING FOR navigator.serviceWorker.ready...');
    const readyRegistration = await navigator.serviceWorker.ready;
    console.log('[WEB PUSH] ✅✅✅ SERVICE WORKER IS READY AND ACTIVE ✅✅✅');
    console.log('[WEB PUSH] 🔵 Ready registration details:', {
      scope: readyRegistration.scope,
      active: !!readyRegistration.active,
      activeState: readyRegistration.active?.state,
      activeScriptURL: readyRegistration.active?.scriptURL,
    });
    
    // Vérification finale: s'assurer qu'un service worker est bien actif
    if (!readyRegistration.active) {
      console.error('[WEB PUSH] ❌❌❌ CRITICAL: Service worker registered but NOT active after ready ❌❌❌');
      throw new Error('Service worker registered but not active after ready');
    }
    console.log('[WEB PUSH] ✅✅✅ VERIFIED ACTIVE SERVICE WORKER EXISTS ✅✅✅');
    console.log('[WEB PUSH] 🔵 Active worker state:', readyRegistration.active.state);
    console.log('[WEB PUSH] 🔵 Active worker scriptURL:', readyRegistration.active.scriptURL);
    
    // Lister TOUS les service workers après l'enregistrement
    const allRegsAfter = await navigator.serviceWorker.getRegistrations();
    console.log('[WEB PUSH] All service worker registrations (after):', allRegsAfter.length);
    allRegsAfter.forEach((reg, idx) => {
      console.log(`[WEB PUSH] SW #${idx + 1}:`, {
        scope: reg.scope,
        active: !!reg.active,
        activeState: reg.active?.state,
        activeScriptURL: reg.active?.scriptURL,
        waiting: !!reg.waiting,
        installing: !!reg.installing,
      });
    });

    // Vérifier que le navigateur supporte les notifications avant d'initialiser messaging
    const supported = await isSupported();
    if (!supported) {
      console.warn('[WEB PUSH] Messaging not supported in this browser');
      return;
    }

    // Initialiser messaging avec l'instance Firebase app
    const messaging = getMessaging(app);
    console.log('[WEB PUSH] Firebase Messaging initialized');

    // Obtenir le token en passant le serviceWorkerRegistration explicitement
    // IMPORTANT: Utiliser readyRegistration qui garantit un worker actif
    console.log('[WEB PUSH] Requesting FCM token...');
    console.log('[WEB PUSH] Using service worker registration:', {
      scope: readyRegistration.scope,
      active: !!readyRegistration.active,
      activeState: readyRegistration.active?.state,
    });
    
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: readyRegistration,
    });

    if (!token) {
      console.warn("[WEB PUSH] ❌ No FCM token received");
      console.warn("[WEB PUSH] This usually means:");
      console.warn("[WEB PUSH] 1. Service worker is not active");
      console.warn("[WEB PUSH] 2. VAPID key is incorrect");
      console.warn("[WEB PUSH] 3. Firebase project configuration mismatch");
      return;
    }

    // Log le token (tronqué pour la sécurité) - LOGS TRÈS VISIBLES EN PROD
    const tokenPreview = token.substring(0, 20) + '...' + token.substring(token.length - 10);
    console.log('[WEB PUSH] ✅✅✅ FCM TOKEN OBTAINED SUCCESSFULLY ✅✅✅');
    console.log('[WEB PUSH] 🔵 Token preview:', tokenPreview);
    console.log('[WEB PUSH] 🔵 Full token length:', token.length);
    console.log('[WEB PUSH] 🔵 Token first 50 chars:', token.substring(0, 50));
    console.log('[WEB PUSH] 🔵 Token last 20 chars:', token.substring(token.length - 20));

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
    console.error("[WEB PUSH] ❌ Error registering service worker or getting FCM token:", err);
    console.error("[WEB PUSH] Error details:", {
      message: err?.message,
      code: err?.code,
      name: err?.name,
      stack: err?.stack?.substring(0, 500), // Limiter la stack trace
    });
    
    // Log supplémentaire pour le débogage en production
    if (typeof window !== 'undefined') {
      console.error("[WEB PUSH] Environment info:", {
        protocol: window.location.protocol,
        host: window.location.host,
        pathname: window.location.pathname,
        serviceWorkerSupported: 'serviceWorker' in navigator,
        notificationSupported: 'Notification' in window,
        notificationPermission: Notification.permission,
      });
      
      // Vérifier les service workers existants
      navigator.serviceWorker.getRegistrations().then((regs) => {
        console.error("[WEB PUSH] Existing service worker registrations:", regs.length);
        regs.forEach((reg, idx) => {
          console.error(`[WEB PUSH] SW #${idx}:`, {
            scope: reg.scope,
            active: !!reg.active,
            state: reg.active?.state || 'no active',
          });
        });
      }).catch((swErr) => {
        console.error("[WEB PUSH] Error getting SW registrations:", swErr);
      });
    }
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

