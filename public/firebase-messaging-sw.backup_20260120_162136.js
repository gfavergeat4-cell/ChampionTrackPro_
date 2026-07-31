/* public/firebase-messaging-sw.js */
/* Firebase Cloud Messaging Service Worker - ESM (MODULAR) */

import { initializeApp } from "/firebase/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "/firebase/firebase-messaging-sw.js";

const firebaseConfig = {
  apiKey: "AIzaSyDwslrK0lbuqsBl61C_l3gjVDGF8ZqTZ5o",
  authDomain: "championtrackpro.firebaseapp.com",
  projectId: "championtrackpro",
  storageBucket: "championtrackpro.appspot.com",
  messagingSenderId: "308674968497",
  appId: "1:308674968497:web:5f8d10b09ee98717a81b90"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

onBackgroundMessage(messaging, (payload) => {
  const title =
    payload?.notification?.title ||
    payload?.data?.title ||
    "Questionnaire available";

  const options = {
    body:
      payload?.notification?.body ||
      payload?.data?.body ||
      "Tap to open your questionnaire.",
    icon: payload?.notification?.icon || payload?.data?.icon || "/assets/icon-192.png",
    badge: "/assets/icon-192.png",
    data: payload?.data || {},
    tag: "questionnaire-notification",
    requireInteraction: false
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url =
    event.notification?.data?.url ||
    event.notification?.data?.click_action ||
    event.notification?.data?.clickAction ||
    "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
