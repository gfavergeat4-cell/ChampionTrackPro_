# CHAMPIONTRACKPRO — NOTIFICATIONS V2
# Consignes complètes : système + design + onboarding
# À lire conjointement avec CLAUDE_CODE_CONSIGNES.md

---

## ÉTAT ACTUEL — CE QUI EXISTE

```
src/services/fcmService.js               → initializeFCM(), onMessage handler
src/services/webNotifications.ts         → registerWebPushTokenForCurrentUser()
src/services/notificationTest.ts         → testNotificationFlow()
src/components/PWAInstallBanner.tsx      → Banner iOS install/enable
screens/StitchProfileScreen.js           → Bouton test + statut notif
public/firebase-messaging-sw.js          → Service Worker background
functions/index.js                       → sendQuestionnaireAvailableNotifications
                                            sendQuestionnaireReminders (3h)
                                            sendTestNotification
```

**Tokens stockés dans :** `users/{uid}.fcmWebTokens[]` via arrayUnion
**Rappel :** 3h après fin de séance
**SW :** sans `type: "module"` ✅
**Problème résolu :** sous-collection `users/{uid}/fcmTokens/` supprimée ✅

---

## PARTIE 1 — CORRECTIONS SYSTÈME

### FIX 1 — Onboarding flow dédié (PRIORITÉ ABSOLUE)

**Problème actuel :** L'athlète doit trouver seul le banner iOS, le bouton dans Profile,
et comprendre pourquoi les notifs sont importantes. Taux d'activation estimé : < 30%.

**Solution :** Créer `src/screens/OnboardingNotifScreen.tsx`

Un écran full-screen qui s'affiche UNE SEULE FOIS à la première connexion.
Stocké dans Firestore : `users/{uid}.onboardingComplete: true`

**Flux selon la plateforme :**

```
ANDROID CHROME :
  Étape unique → Écran plein "Never miss a session"
  → Illustration : notification qui arrive sur téléphone
  → Bouton "Enable Notifications" (gradient cyan)
  → requestPermission() direct dans onPress
  → Si granted  : register token → marquer onboardingComplete → Home
  → Si denied   : message settings + bouton "Skip for now"
  → Si skip ×2  : marquer onboardingComplete quand même → Home

iOS SAFARI (non-standalone) :
  Étape 1 → Écran plein "Install the app first"
  → Animation : flèche pointant vers le bas + icône Share qui pulse
  → Instruction : "Tap ↑ Share, then 'Add to Home Screen'"
  → Bouton "I've added it — Continue"
  → Mémoriser dans localStorage: pwaPromptShown = true

iOS PWA (standalone) :
  Étape 2 → Écran plein "Enable notifications"
  → Bouton "Enable Notifications"
  → requestPermission() direct dans onPress
  → Si granted  : register token → onboardingComplete → Home
  → Si denied   : message + bouton "Skip for now"
```

**Intégration dans StitchNavigator.js :**
```javascript
// Au login, avant de rediriger vers AthleteHome :
const userDoc = await getDoc(doc(db, "users", uid));
if (!userDoc.data()?.onboardingComplete) {
  // Rediriger vers OnboardingNotifScreen
} else {
  // Rediriger vers Home normal
}
```

**Style de l'écran onboarding :**
```
Background : #0A0F1E (identique au reste de l'app)
Illustration centrale : icône notif animée (scale pulse 1→1.15, 2s)
Titre : Bebas Neue, 36px, blanc, letter-spacing 3px
Sous-titre : DM Sans, 16px, rgba(255,255,255,0.6)
Bouton principal : linear-gradient(135deg, #00BFFF, #0066FF), height 56px, border-radius 12px
Bouton skip : texte seul, rgba(255,255,255,0.3), font-size 14px
```

---

### FIX 2 — Reminder intelligent (3 connexions sans notifs)

**Dans StitchHomeScreen (écran home athlète) :**

Ajouter un compteur `users/{uid}.loginCount` incrémenté à chaque connexion.

Si `loginCount >= 3` ET `Notification.permission !== 'granted'` ET pas standalone :
→ Afficher banner discret en haut :
```
"🔔 Enable notifications to never miss a session alert"
[Enable]  [×]
```

Si dismissed 2 fois → ne plus jamais afficher (localStorage: notifReminderDismissed = true).
Si standalone ET permission !== granted → afficher le banner rouge déjà en place.

---

### FIX 3 — Statut notif simplifié dans Profile (remplace le bouton test)

**Dans `screens/StitchProfileScreen.js` :**

Remplacer le bloc notifications actuel par un statut lisible :

```
NOTIFICATIONS
─────────────────────────────
● Active                          (point vert #00FF9D)
  You'll be alerted after each session

● Inactive — Tap to enable        (point rouge #FF3B30, cliquable)
  → requestPermission() au tap

● Blocked — Check Settings        (point orange #FFB800)
  → instructions plateforme au tap
```

**Le bouton "Send Test Notification" devient invisible pour les athlètes.**
Le garder uniquement si `users/{uid}.role === 'coach'` ou `role === 'admin'`.
Ou ajouter un accès caché : tap 5× sur le logo dans Profile → affiche le bouton test.

---

### FIX 4 — Deep link notification → questionnaire direct

**Problème :** Tap sur la notification → atterrit sur Home → l'athlète doit chercher
le questionnaire. Taux de complétion chute de ~40% selon les benchmarks SaaS sport.

**Dans `public/firebase-messaging-sw.js` :**
```javascript
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  // URL directe vers le questionnaire
  const trainingId = event.notification.data?.trainingId;
  const teamId = event.notification.data?.teamId;
  const url = trainingId 
    ? `/?screen=questionnaire&trainingId=${trainingId}&teamId=${teamId}`
    : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
```

**Dans `StitchNavigator.js` :** lire les query params au démarrage :
```javascript
useEffect(() => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const screen = params.get('screen');
    const trainingId = params.get('trainingId');
    if (screen === 'questionnaire' && trainingId) {
      // Navigation directe vers StitchQuestionnaireScreen avec trainingId
      navigation.navigate('Questionnaire', { trainingId });
    }
  }
}, []);
```

**Dans `functions/index.js` :** s'assurer que `trainingId` et `teamId` sont dans le payload FCM :
```javascript
const message = {
  notification: { title, body },
  data: {
    trainingId: trainingId,  // ← doit être présent
    teamId: teamId,          // ← doit être présent
    url: `/?screen=questionnaire&trainingId=${trainingId}&teamId=${teamId}`,
    tag: `questionnaire-${trainingId}`,
  },
  token: fcmToken,
};
```

---

### FIX 5 — Nettoyage des tokens invalides

**Problème :** Les tokens FCM expirent. Un token invalide → "Sent to 0/1 tokens" dans les logs.

**Dans `functions/index.js`, après chaque envoi FCM :**
```javascript
// Si token invalide → le supprimer de fcmWebTokens[]
if (response.failureCount > 0) {
  const failedTokens = response.responses
    .map((r, i) => !r.success ? tokens[i] : null)
    .filter(Boolean);
  
  if (failedTokens.length > 0) {
    await db.doc(`users/${uid}`).update({
      fcmWebTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens)
    });
    console.log(`[FCM] Removed ${failedTokens.length} invalid tokens for ${uid}`);
  }
}
```

---

### FIX 6 — Re-registration token au focus app

**Dans `src/services/fcmService.js` :**

Les tokens FCM web expirent silencieusement. Re-enregistrer automatiquement
quand l'utilisateur revient sur l'app après 24h d'absence :

```javascript
// Dans initializeFCM(), après onMessage registration :
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    const lastReg = localStorage.getItem('fcmLastRegistration');
    const now = Date.now();
    // Re-register si > 24h
    if (!lastReg || (now - parseInt(lastReg)) > 86400000) {
      await registerWebPushTokenForCurrentUser();
      localStorage.setItem('fcmLastRegistration', now.toString());
    }
  }
});
```

---

## PARTIE 2 — DESIGN DES NOTIFICATIONS

### Objectif
Taux de tap sur notification > 70% (benchmark Whoop : 68%, Hudl : 72%).
Chaque notification doit déclencher un réflexe immédiat chez l'athlète.

### Règles de copywriting

**❌ Ne jamais écrire :**
```
"You have a pending questionnaire for training session ID xyz_123"
"Questionnaire available"
"Training session ended"
```

**✅ Toujours écrire :**
```
Langage athlète. Direct. Urgent mais pas agressif.
Maximum 6 mots dans le titre. Maximum 12 mots dans le corps.
```

### Copywriting validé — FINAL ✅

```
NOTIF 1 — Fin de séance (immédiat)
  Titre : "ChampionTrackPro ⚡"
  Corps : "Tell us — how did that session hit you?"
  Bouton : "Tell us →"
  Levier : authenticité + langage vestiaire

NOTIF 2 — Rappel 3h
  Titre : "Still got 60 seconds? ⏱"
  Corps : "Your coach needs your data to make tomorrow better for everyone."
  Bouton : "Tell us →"
  Levier : appartenance équipe + conséquence collective

NOTIF 3 — Dernière relance 6h
  Titre : "Final reminder 🔒"
  Corps : "Don't let your session go untracked."
  Bouton : "Tell us →"
  Levier : FOMO + urgence fenêtre qui se ferme
```

**Règles copywriting — NE JAMAIS dévier :**
```
❌ "Questionnaire available"
❌ "Rate your session: Training"
❌ "You have a pending questionnaire for training ID xyz"
❌ Tout ce qui ressemble à un message système

✅ Langage vestiaire NCAA
✅ Maximum 6 mots titre / 12 mots corps
✅ Toujours un bouton action "Tell us →"
```

### Templates dans functions/index.js

```javascript
// NOTIF 1 — Fin de séance
const sessionEndNotification = {
  title: "ChampionTrackPro ⚡",
  body: "Tell us — how did that session hit you?",
};

// NOTIF 2 — Rappel 3h
const reminderNotification = {
  title: "Still got 60 seconds? ⏱",
  body: "Your coach needs your data to make tomorrow better for everyone.",
};

// NOTIF 3 — Dernière relance 6h
const finalReminderNotification = {
  title: "Final reminder 🔒",
  body: "Don't let your session go untracked.",
};
```

### Paramètres techniques — PRIORITÉ HIGH (pop-up forcé)

**Problème actuel :** Les notifs arrivent silencieusement dans le tiroir.
**Cause :** Priorité FCM par défaut = NORMAL → pas de pop-up flottant.
**Fix :** Forcer HIGH dans le payload FCM.

**Dans `functions/index.js`, construction du message FCM :**
```javascript
const message = {
  notification: {
    title: notifContent.title,
    body: notifContent.body,
  },
  data: {
    trainingId: trainingId,
    teamId: teamId,
    url: `/?screen=questionnaire&trainingId=${trainingId}&teamId=${teamId}`,
    tag: `questionnaire-${trainingId}`,
  },
  android: {
    priority: "high",
    notification: {
      priority: "high",
      defaultSound: true,
      channelId: "ctpro-questionnaire",
      color: "#00D4FF",
    },
  },
  apns: {
    headers: { "apns-priority": "10" },
    payload: { aps: { sound: "default", badge: 1 } },
  },
  webpush: {
    headers: { Urgency: "high" },
    notification: {
      title: notifContent.title,
      body: notifContent.body,
      icon: "/icons/icon-192-v2.png",
      badge: "/icons/badge-72.png",
      tag: `questionnaire-${trainingId}`,
      requireInteraction: false,
      silent: false,
      data: {
        url: `/?screen=questionnaire&trainingId=${trainingId}&teamId=${teamId}`,
        trainingId,
        teamId,
      },
      actions: [{ action: "open_questionnaire", title: "Tell us →" }],
    },
    fcmOptions: {
      link: `/?screen=questionnaire&trainingId=${trainingId}&teamId=${teamId}`,
    },
  },
  token: fcmToken,
};
```

**Dans `public/firebase-messaging-sw.js` :**
```javascript
self.registration.showNotification(title, {
  body: body,
  icon: "/icons/icon-192-v2.png",
  badge: "/icons/badge-72.png",
  tag: `questionnaire-${trainingId}`,
  renotify: false,
  requireInteraction: false,
  silent: false,
  data: { url, trainingId, teamId },
  actions: [{ action: "open_questionnaire", title: "Tell us →" }],
});
```

### Icônes — fichiers existants et à créer

```
EXISTANTS :
  /public/icons/icon-192-v2.png   → icône app notification ✅
  /public/icons/icon-512-v2.png   → icône app splash ✅

À CRÉER :
  /public/icons/badge-72.png      → logo slider monochrome blanc 72×72px
                                    fond transparent — barre de statut Android
```

**Script génération badge (sharp) :**
```javascript
// scripts/generate-badge.js
const sharp = require('sharp');
sharp('/logo/logo_final.jpeg')
  .resize(72, 72, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } })
  .greyscale()
  .png()
  .toFile('public/icons/badge-72.png')
  .then(() => console.log('badge-72.png generated'))
  .catch(console.error);
```

### Mise à jour manifest.json

```json
{
  "icons": [
    { "src": "/icons/icon-192-v2.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512-v2.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

### Templates de notifications (ancien bloc — REMPLACÉ PAR CI-DESSUS)

```javascript
// LEGACY — ne plus utiliser
const getSessionNotification = (sessionType, coachName) => ({
  title: "ChampionTrackPro ⚡",
  body: getBody(sessionType),
});

const getBody = (sessionType) => {
  const templates = {
    conditioning: "How did your body handle that grind? (< 60 sec)",
    skill:        "How did your shot feel today? Quick check-in →",
    scrimmage:    "How sharp were you out there? Rate it now →",
    default:      "Practice ended — How do you feel? (< 60 sec)",
  };
  return templates[sessionType] || templates.default;
};
```

**Notification rappel (3h) :**
```javascript
{
  title: "Still got a minute? ⏱",
  body: "Your session check-in is waiting. Takes 60 sec.",
}
```

**Notification dernier rappel (si configuré à 6h) :**
```javascript
{
  title: "Last call 🏀",
  body: "Check-in closes soon — don't let coach fly blind.",
}
```

### Paramètres techniques de la notification

**Dans `public/firebase-messaging-sw.js` :**
```javascript
self.registration.showNotification(title, {
  body: body,
  icon: "/icons/icon-192.png",       // logo CTP carré
  badge: "/icons/badge-72.png",      // icône monochrome pour la barre de statut
  tag: `questionnaire-${trainingId}`, // remplace les doublons
  renotify: false,                    // ne pas vibrer si déjà affiché
  requireInteraction: false,          // disparaît automatiquement (moins intrusif)
  silent: false,                      // son activé
  data: { url, trainingId, teamId },
  // vibrate non utilisé — ignoré silencieusement sur iOS, optionnel Android
});
```

### Icônes à créer

Demander à Claude Code de générer ces fichiers dans `/public/icons/` :

```
icon-192.png   → Logo CTP sur fond #0A0F1E, 192×192px
icon-512.png   → Logo CTP sur fond #0A0F1E, 512×512px
badge-72.png   → Icône CTP monochrome blanc, 72×72px (pour barre de statut Android)
```

Si les fichiers n'existent pas → utiliser le logo existant `/logo/logo_final.jpeg`
redimensionné et converti avec sharp ou canvas.

---

## PARTIE 3 — AUTO-VALIDATION NOTIFICATIONS

Après chaque modification, Claude Code doit vérifier :

```bash
# 1. SW sans type:module
grep -n "type.*module" public/firebase-messaging-sw.js
# → Doit retourner vide

# 2. trainingId présent dans payload FCM
grep -n "trainingId" functions/index.js
# → Doit apparaître dans la construction du message FCM

# 3. Token cleanup présent
grep -n "arrayRemove" functions/index.js
# → Doit apparaître après l'envoi FCM

# 4. Build OK
npx expo export --platform web 2>&1 | tail -5

# 5. Deploy functions
firebase deploy --only functions
firebase functions:log --lines 10
```

---

## ORDRE D'EXÉCUTION

```
1. FIX 5 — Token cleanup (functions/index.js)          ← impact immédiat prod
2. FIX 4 — Deep link notification → questionnaire       ← impact UX immédiat
3. FIX 2 — Design notifications (copywriting + badge)   ← impact taux de tap
4. FIX 1 — Onboarding flow dédié                        ← nouveau composant
5. FIX 3 — Statut simplifié dans Profile                ← refactor existant
6. FIX 6 — Re-registration token au focus               ← robustesse long terme
```

**Deploy après chaque fix :**
```bash
# Pour functions :
firebase deploy --only functions
# Pour client :
git add . && git commit -m "fix: [description]" && git push origin main
```
