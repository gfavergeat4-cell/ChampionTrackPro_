/* Firebase Cloud Messaging Service Worker - ESM */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-sw.js";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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

// Professional notification options (same title/body text; improved look & attention)
const NOTIFICATION_ICON = "/icons/icon-192.png";
const NOTIFICATION_BADGE = "/icons/icon-192.png"; // or /icons/badge-72.png if you add one
const DEFAULT_TAG = "ctpro-questionnaire";

onBackgroundMessage(messaging, (payload) => {
  const title = payload?.notification?.title || payload?.data?.title || "Questionnaire available";
  const body = payload?.notification?.body || payload?.data?.body || "Tap to open your questionnaire.";
  const data = payload?.data || {};
  const options = {
    body,
    icon: data.icon || NOTIFICATION_ICON,
    badge: data.badge || NOTIFICATION_BADGE,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    renotify: true,
    tag: data.tag || DEFAULT_TAG,
    data: { ...data, url: data.url || data.clickAction || "/" },
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || event.notification?.data?.clickAction || "/";
  event.waitUntil(clients.openWindow(url));
});
