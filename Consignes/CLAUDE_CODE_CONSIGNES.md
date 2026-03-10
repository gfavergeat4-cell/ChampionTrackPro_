# CLAUDE CODE — CONSIGNES PERMANENTES
# Colle ce fichier en début de chaque session Claude Code
# Dernière mise à jour : Mars 2026

---

## 🤖 AUTONOMIE TOTALE

Tu es un agent de développement autonome sur ChampionTrackPro.

**RÈGLES D'AUTONOMIE — Ne jamais enfreindre :**
- Ne jamais t'arrêter pour demander une permission ou une confirmation
- Ne jamais attendre une réponse utilisateur en cours de tâche
- Si tu dois lire un fichier → lis-le
- Si tu dois modifier un fichier → modifie-le
- Si tu dois lancer une commande bash → lance-la
- Si tu dois installer un package → installe-le
- Si tu dois déployer → déploie
- Si un fichier n'existe pas → crée-le
- Si tu rencontres une erreur → diagnostique et corrige toi-même

**QUAND TU BLOQUES :**
- Essaie au moins 3 approches différentes avant d'abandonner
- Cherche des patterns similaires dans le codebase et réplique-les
- Consulte package.json, les imports existants et la structure des fichiers
- Ne reviens qu'une fois la tâche 100% terminée ou vraiment impossible

**STANDARD DE COMPLETION :**
- Chaque tâche se termine par un commit git pushé sur main
- Toujours exécuter : git add . && git commit -m "message" && git push origin main
- Si deploy nécessaire : firebase deploy --only functions ou firestore:rules
- Rapport final : ce qui a été fait, fichiers modifiés, hash du commit

---

## ✅ AUTO-VALIDATION OBLIGATOIRE

Après chaque tâche, exécute ces vérifications AVANT de committer :

### Build
```bash
npx expo export --platform web 2>&1 | tail -10
# → Doit se terminer sans erreur
```

### Firebase
```bash
firebase functions:log --lines 5
# → Pas d'erreurs critiques
```

### Fichiers modifiés
- Vérifie la syntaxe de chaque fichier modifié
- Vérifie qu'aucun import n'est cassé
- Vérifie qu'aucun chemin Windows absolu n'a été introduit (C:\Users\...)

### Notifications (si tâche liée aux notifs)
```bash
# Token FCM présent ?
# Lire users/{uid} → fcmWebTokens[] peuplé ?

# SW sans type:module ?
grep -n "type.*module" public/firebase-messaging-sw.js
# → Doit retourner vide

# manifest.json correct ?
grep "display" public/manifest.json
# → Doit contenir "standalone"
```

### Firestore Rules (si modifiées)
```bash
firebase deploy --only firestore:rules
# → 0 erreurs de compilation
```

**Si une vérification échoue → corrige avant de committer.**

---

## 🏢 PROJET : ChampionTrackPro

**Stack :** React Native Web + Expo / Firebase Firestore + Auth / Cloud Functions / Vercel / GitHub main

**3 rôles :**
| Rôle | Device | Job |
|------|--------|-----|
| Athlete | Mobile only | Questionnaires post-entraînement |
| Coach | Desktop | Suivi équipe + analytics |
| Admin | Desktop | Gestion multi-équipes |

---

## 📁 FICHIERS CLÉS

```
navigation/StitchNavigator.js            → Navigation principale
screens/StitchLandingScreen.js           → Landing page
screens/StitchProfileScreen.js           → Profil athlète + bouton test notif
src/screens/CoachHomeScreen.tsx          → Home coach
src/screens/CoachScheduleScreen.tsx      → Planning coach
src/screens/PerformanceDashboard.tsx     → Analytics (recharts)
src/screens/AdminHomeScreen.tsx          → Sélection équipes admin
src/services/fcmService.js               → FCM init + onMessage handler
src/services/webNotifications.ts         → Enregistrement token web push
src/services/notificationTest.ts         → Flow test notification
src/components/PWAInstallBanner.tsx      → Banner iOS Add to Home Screen
public/firebase-messaging-sw.js          → Service Worker FCM background
functions/index.js                       → Toutes les Cloud Functions
firestore.rules                          → Règles sécurité Firestore
firestore.indexes.json                   → Index composites
```

---

## 🎨 DESIGN SYSTEM

```
Background:     #0A0F1E
Cards:          #0D1526
Accent cyan:    #00D4FF
Cyan dim:       rgba(0,212,255,0.08)
Cyan border:    rgba(0,212,255,0.14)
Muted text:     rgba(255,255,255,0.38)
Primary btn:    linear-gradient(135deg, #00BFFF, #0066FF)
Success:        #00FF9D
Warning:        #FFB800
Danger:         #FF3B30
```

**Typography :**
```
Display :  Bebas Neue (letter-spacing 2-10px)
UI/Body :  DM Sans (300/400/500/600)
Mono :     Space Mono (letter-spacing 1.5-4px, uppercase)
```

**Logo :**
```
Fichier :   /logo/logo_final.jpeg
Usage :     mixBlendMode: 'screen'
Desktop :   width 480, height 240
Mobile :    width 260, height 130
JAMAIS :    chemin Windows C:\Users\...
```

---

## ⚙️ RÈGLES DE CODE

- Tout le texte de l'interface en **anglais**
- `useIsDesktop()` obligatoire sur tous les écrans Coach et Admin
- Scrollbar cachée sur tous les écrans
- Ne jamais casser la structure de navigation dans StitchNavigator.js
- Ne jamais utiliser de chemin Windows absolu dans le code
- Recharts est la librairie de charts — ne pas remplacer
- Logo path toujours `/logo/filename`
- VAPID key → `EXPO_PUBLIC_FCM_VAPID_KEY` dans .env.production (local) ET Vercel Environment Variables

---

## 🔔 SYSTÈME DE NOTIFICATIONS

### Architecture
```
Cloud Functions :
  sendQuestionnaireAvailableNotifications → CRON 1min — push fin entraînement
  sendQuestionnaireReminders              → CRON 5min — rappel après 3h
  sendTestNotification                    → HTTPS callable — test instantané

Client :
  fcmService.js          → initializeFCM(), onMessage via SW
  webNotifications.ts    → registerWebPushTokenForCurrentUser()
  notificationTest.ts    → testNotificationFlow()
  PWAInstallBanner.tsx   → Banner iOS install + enable
  firebase-messaging-sw.js → Background messages
```

### Règles critiques
- `Notification.requestPermission()` doit être dans la callstack directe d'un user gesture (iOS)
- `initializeFCM()` vérifie `Notification.permission !== 'granted'` avant de rappeler requestPermission()
- Tokens FCM → `users/{uid}.fcmWebTokens[]` via arrayUnion
- SW enregistré SANS `type: "module"` (incompatible importScripts iOS)
- La sous-collection `users/{uid}/fcmTokens/` est supprimée — causait PERMISSION_DENIED

### isTestSession
- Trainings test : `isTestSession: true`
- Exclus du dashboard coach ET home athlète
- Questionnaire affiche banner jaune "🧪 Test Session"
- Réponses marquées `isTest: true` — exclues des analytics

---

## 🧪 DONNÉES DE TEST

```
Team :          TRAINING TEST
teamId :        Ri8kpStgWp9yymtS71tb
Athletes :      bball_pg_1 → bball_c_10 (10 joueurs basketball, 90j de données)
Coach test :    fqXEQa0rjPdQcsCEcORWefOSzWw1 — coachtest@gmail.com
Athlète test :  84CKZH4GvTbxuK6g7bX73lQaaF32 — nkirsch@kces.fr — Nathan Kirsch
```

---

## 🚀 COMMANDES DEPLOY

```bash
# Règles Firestore
firebase deploy --only firestore:rules

# Cloud Functions
firebase deploy --only functions

# Commit systématique après chaque fix
git add . && git commit -m "message" && git push origin main
```

---

## 🚧 TÂCHES EN COURS

| # | Tâche | Statut |
|---|-------|--------|
| 1 | Vercel build fix | ✅ Done |
| 2 | PerformanceDashboard dropdowns (Players/Position) | 🟡 Pending |
| 3 | AthleteDetailScreen — vue joueur individuel depuis My Team | 🟡 Pending |
| 4 | Coach Profile — édition nom + photo | 🟡 Pending |
| 5 | Logo responsive desktop/mobile | ✅ Done |
| 6 | Notifications iOS/Android | ✅ Done |
| 7 | Rappel questionnaire 3h | ✅ Done |
| 8 | Fix questionnaire mauvais training | ✅ Done |
| 9 | Bouton test notification profil athlète | ✅ Done |
| 10 | Login page — même DA que landing | ✅ Done |
| 11 | Banner iOS install + enable notifications home | ✅ Done |

---

## 🗣 TON & VOIX

**EN :** Serious. Data-driven. Direct. No fluff.
**FR :** Professionnel. Précis. Orienté terrain.

**Ne jamais dire :** "revolutionary", "game-changer", "disruptive"
**Toujours dire :** "performance data", "athlete response", "training load", "readiness"
