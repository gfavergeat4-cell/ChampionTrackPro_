/* public/firebase-messaging-sw.js */
/* Service Worker for Firebase Cloud Messaging - Classic Script */

// Charger les scripts Firebase compat (exposent un objet global firebase)
// IMPORTANT: Utiliser importScripts() pour charger les scripts classiques
// Les fichiers compat exposent firebase via self (pas window)

console.log('[SW] Loading Firebase Service Worker scripts...');

try {
  importScripts('/firebase/firebase-app-compat.js');
  importScripts('/firebase/firebase-messaging-compat.js');
  console.log('[SW] ✅ Firebase Service Worker scripts loaded successfully');
} catch (error) {
  console.error('[SW] ❌ CRITICAL: Failed to load Firebase Service Worker scripts:', error);
  throw new Error('ServiceWorker script evaluation failed: Cannot load Firebase scripts - ' + error.message);
}

// Configuration Firebase (doit correspondre à celle de l'app)
const firebaseConfig = {
  apiKey: 'AIzaSyDwslrK0lbuqsBl61C_l3gjVDGF8ZqTZ5o',
  authDomain: 'championtrackpro.firebaseapp.com',
  projectId: 'championtrackpro',
  storageBucket: 'championtrackpro.appspot.com',
  messagingSenderId: '308674968497',
  appId: '1:308674968497:web:5f8d10b09ee98717a81b90',
};

// Initialiser Firebase (utilise l'objet global firebase exposé par les scripts compat)
firebase.initializeApp(firebaseConfig);
console.log('[SW] ✅ Firebase App initialized');

// Obtenir l'instance messaging
const messaging = firebase.messaging();
console.log('[SW] ✅ Firebase Messaging instance created');

// Gérer les messages en background
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'New session available';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Tap to open your questionnaire.',
    icon: payload.notification?.icon || payload.data?.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
    tag: 'questionnaire-notification',
    requireInteraction: false,
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

console.log('[SW] ✅ Firebase Messaging background handler registered');
console.log('[SW] ✅ Firebase Messaging fully initialized in Service Worker');

// Gérer le clic sur la notification
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event);
  
  event.notification.close();
  
  const url = event.notification.data?.clickAction || "/";
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Si une fenêtre est déjà ouverte, la focus
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      // Sinon, ouvrir une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
