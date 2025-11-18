/* public/firebase-messaging-sw.js */
/* global importScripts, firebase */

// Charger les scripts Firebase
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

// Configuration Firebase (doit correspondre à celle de l'app)
firebase.initializeApp({
  apiKey: "AIzaSyDwslrK0lbuqsBl61C_l3gjVDGF8ZqTZ5o",
  authDomain: "championtrackpro.firebaseapp.com",
  projectId: "championtrackpro",
  storageBucket: "championtrackpro.appspot.com",
  messagingSenderId: "308674968497",
  appId: "1:308674968497:web:5f8d10b09ee98717a81b90",
});

const messaging = firebase.messaging();

// Gérer les messages en background
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background message received:", payload);
  
  const { title, body, icon, clickAction } = payload.data || {};
  
  const notificationTitle = title || "ChampionTrackPro";
  const notificationOptions = {
    body: body || "Questionnaire available",
    icon: icon || "/icon-192.png",
    badge: "/icon-192.png",
    data: { clickAction },
    tag: "questionnaire-notification",
    requireInteraction: false,
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

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

