/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// NOTE: Ce fichier doit juste exister et être servi à la racine.
// La config exacte peut être remplacée ensuite par ta vraie config Firebase Web.
firebase.initializeApp({
  apiKey: "PLACEHOLDER",
  authDomain: "PLACEHOLDER",
  projectId: "championtrackpro",
  messagingSenderId: "PLACEHOLDER",
  appId: "PLACEHOLDER"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(
    payload?.notification?.title || "ChampionTrackPro",
    {
      body: payload?.notification?.body || "Questionnaire available",
      icon: "/favicon.ico",
      data: payload?.data || {}
    }
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) ? event.notification.data.url : "/";
  event.waitUntil(clients.openWindow(url));
});
