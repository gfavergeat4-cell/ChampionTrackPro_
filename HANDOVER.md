# ChampionTrackPro — Engineering Handover Report
**Date:** 2026-03-10
**Branch:** `main` — all work committed and pushed
**Final commit:** `32f5b24`

---

## 1. What This Project Is

ChampionTrackPro (CTP) is a PWA-first athletic performance intelligence platform. Athletes fill post-training subjective wellness questionnaires on mobile; coaches analyze the aggregated data on desktop.

- **Frontend:** React Native Web + Expo (web-only deploy)
- **Database:** Firebase Firestore
- **Auth:** Firebase Auth (email/password)
- **Backend:** Cloud Functions Gen 1, Node.js 22, `us-central1`
- **Push notifications:** Firebase Cloud Messaging (FCM), Web Push
- **Hosting:** Vercel (frontend), Firebase (functions + rules)
- **Charts:** Recharts (do not replace)

**User roles:** Athlete (mobile, fills questionnaires) — Coach (desktop, monitors team) — Admin (desktop, multi-team)

---

## 2. All Work Completed (Chronological)

### Phase 2 — Security Hardening
**Commit:** `cab5733` (earlier session, pre-summary)

| Vuln | Severity | Fix |
|------|----------|-----|
| VULN-01 | CRITICAL | Unauthenticated team reads → `allow read: if signedIn()` (later tightened to membership-only via DEC-05) |
| VULN-02 | CRITICAL | Cross-team IDOR on `collectionGroup("responses")` → added `resource.data.teamId` membership check |
| VULN-03 | CRITICAL | Role self-escalation → `affectedKeys().hasAny(['role','teamId'])` blocks those fields on self-update |
| VULN-05 | MEDIUM | ICS Cloud Functions lacked team auth → Admin SDK role + membership check added |

New Firestore rules: `pendingQuestionnaireReminders` (read=admin, write=false), `ai_training_dataset` (read+write=false).

### Phase 3 — V2 Questionnaire
**Commit:** `147df2c`

- `screens/StitchQuestionnaireScreen.js` — full rewrite
- **SemanticSlider:** CSS 1-10 scale, gradient thumb, floating tooltip on drag, anchors ("Low / High")
- **Conditional questions by `sessionType`:** conditioning=5 questions, skill=6, scrimmage=7. Default `"conditioning"` when absent (DEC-03)
- **Friction Matrix:** toggle → `frictionType` (Physical Fatigue / Academic-Life Stress / Court Confusion / Mental-Emotional) + 3 sub-sliders
- **Schema saved:** `{ metrics.*, readinessScore (0-100), workloadAU (RPE×duration), sessionType, hasFriction, frictionType, frictionDetails }`
- **"Physical Soreness" renamed to "Physical Fatigue"** (DEC-07, HIPAA compliance)

### Phase 4 — V2 Dashboard
**Commit:** `55e652b`

- `src/screens/PerformanceDashboard.tsx`
- **Morning Brief:** per-player readiness + EMA deviation, risk-sorted (danger/monitor/optimal)
- **5 chart types:** Line (categories), Bar, RadarChart, Deviation chart (readiness vs EMA), Workload chart (acute 7d + chronic 28d)
- **V1/V2 field mapping** via `extractV2Metrics()` (DEC-04): V2 `metrics.*` first, V1 French field fallback, null for missing
- **Player + Position filter dropdowns** (multi-select, composable)
- `collectionGroup("responses")` query with `where("isTest","==",false)` server-side filter

### Phase 5 — GDPR Anonymization
**Commit:** `4d40991`

- `functions/index.js` — `anonymizePlayerDataForAI` CF
- Trigger: `auth.user().onDelete()` → anonymizes athlete response data into `ai_training_dataset` collection (Admin SDK)
- PII stripped; Firestore rule blocks all client access to `ai_training_dataset`

### Notifications V2 (6 fixes)
**Commits:** `9ece7c3` → `d3775fd`

| Fix | Commit | What |
|-----|--------|------|
| FIX 5 | `9ece7c3` | `arrayRemove` all failed FCM tokens after every send (3 send paths) |
| FIX 4 | `cdcbf18` | Deep link `/?screen=questionnaire&trainingId=X&teamId=Y`; HIGH priority on all platforms; new copywriting |
| FIX 2 | `181fde1` | `loginCount` counter; notification reminder banner in AthleteHome after 3+ logins without permission |
| FIX 1 | `53120bc` | `OnboardingNotifScreen.tsx` — first-login permission flow, platform-specific (Android/iOS Safari/iOS PWA) |
| FIX 3 | `217c838` | Profile notification status (Active●/Inactive●/Blocked●); test button hidden from athletes (5× avatar tap unlocks) |
| FIX 6 | `d3775fd` | FCM token re-registration on `visibilitychange` if >24h since last registration |

### Debt Cleanup Batch 1
**Commits:** `ffecdc9`, `3b64645`, `32681e3`, `661360e`

| Task | Commit | What |
|------|--------|------|
| DEBT-02 | `ffecdc9` | `where("isTest","==",false)` on dashboard query + composite Firestore index |
| badge-72.png | `3b64645` | `scripts/generate-badge.js` → `public/icons/badge-72.png` (72×72px monochrome, sharp) |
| DEC-05 `lookupTeamByCode` | `32681e3` | New callable CF: takes code, returns `{teamId,teamName,role}` only, in-memory rate limit 10req/60s. Team read rule tightened to membership-only |
| DEBT-03 | `661360e` | `cleanupOldReminders` scheduled CF (weekly): deletes reminders >30 days old |
| DEBT-04 (notifications CRON) | `661360e` | `db.getAll(...userRefs)` batch replaces O(N) sequential `getDoc` in `sendQuestionnaireAvailableNotifications` |

### Debt Cleanup Batch 2
**Commits:** `5bb2a68`, `31dad79`, `5e3a307`, `8a46f8a`, `807dbb4`, `a33adad`

| Task | Commit | What |
|------|--------|------|
| Node 22 upgrade | `5bb2a68` | `functions/package.json` + `firebase.json` → `nodejs22` (was nodejs20, deprecated 2026-04-30) |
| Dashboard filter fix | `31dad79` | `filteredResponses` now correctly propagates position filter when no players selected (DEC-12) |
| AthleteDetailScreen rewrite | `5e3a307` | 59 → 562 lines: SVG readiness gauge, EMA trendline (Recharts), RadarChart, last-5 sessions table |
| Legacy file deletion | `8a46f8a` | `screens/JoinTeam.js` + `src/stitch_components/CreateAccountScreenNew.tsx` deleted (unused, contained broken team queries) |
| DEBT-04 (reminders CRON) | `807dbb4` | `db.getAll` batch in `sendQuestionnaireReminders` too |

### Final Batch (this session)
**Commits:** `1be9712`, `7282d72`, `8ad0bb3`, `32f5b24`

| Task | Commit | What |
|------|--------|------|
| 6h final reminder | `1be9712` | `sendQuestionnaireSecondReminder` CF: "Final reminder 🔒 / Don't let your session go untracked." at T+6h |
| Coach Profile photo+name | `7282d72` | Base64 photo (500KB limit, FileReader), `updateProfile(auth)` + Firestore `setDoc` merge, success banner |
| Analytics extraction (DEC-13) | `8ad0bb3` | `src/utils/analytics.ts`: `calculateEMA`, `calculateDeviation`, `calculateReadiness`, `extractV2Metrics` — shared by Dashboard + AthleteDetailScreen |
| Docs | `32f5b24` | `PROGRESS_REPORT_4.md` + `DECISIONS.md` DEC-14/DEC-15 |

---

## 3. Architecture — Key Files

### Frontend
| File | Role |
|------|------|
| `navigation/StitchNavigator.js` | Main router (AthleteTabs / CoachTabs / AdminTabs). Deep link handler reads `screen/trainingId/teamId` from URL params. `loginCount` increment on auth. OnboardingNotifScreen overlay logic. |
| `screens/StitchQuestionnaireScreen.js` | V2 questionnaire. SemanticSlider, conditional questions, Friction Matrix. Saves `metrics.*`, `readinessScore`, `workloadAU`. |
| `screens/StitchCreateAccountScreen.js` | Account creation. Uses `lookupTeamByCode` CF (not direct Firestore read). |
| `src/screens/PerformanceDashboard.tsx` | Coach analytics. Morning Brief, 5 chart types, player/position filter, EMA, deviation, workload. |
| `src/screens/AthleteDetailScreen.tsx` | Individual athlete view from My Team. Gauge, EMA trendline, RadarChart, session table. |
| `src/screens/CoachProfileScreen.tsx` | Coach profile. Name edit (Auth + Firestore), photo edit (base64, 500KB limit). |
| `src/screens/OnboardingNotifScreen.tsx` | First-login push permission flow. Platform-branched. |
| `src/stitch_components/AthleteHomeNew.tsx` | Athlete home. Notification reminder banner (after 3 logins without permission). |
| `screens/StitchProfileScreen.js` | Athlete profile. Notification status dot (Active/Inactive/Blocked). Test button (coach/admin or 5× tap). |
| `src/utils/analytics.ts` | Shared analytics: `calculateEMA(values,N)`, `calculateDeviation`, `calculateReadiness(V2Metrics)`, `extractV2Metrics(RawResponse)` |

### Backend
| File | Role |
|------|------|
| `functions/index.js` | All 13 Cloud Functions (nodejs22, us-central1, Gen 1) |
| `firestore.rules` | Security rules — see Section 4 |
| `firestore.indexes.json` | Composite indexes — responses [teamId,isTest,submittedAt] |
| `public/firebase-messaging-sw.js` | Service Worker. FCM background message handler. `notificationclick` → deep link. |
| `src/services/fcmService.js` | FCM init, foreground `onMessage`, `visibilitychange` re-registration (24h TTL) |

### Static Assets
| File | Notes |
|------|-------|
| `public/icons/icon-192-v2.png` | PWA icon 192×192 |
| `public/icons/icon-512-v2.png` | PWA icon 512×512 |
| `public/icons/badge-72.png` | Android status bar badge (72×72, monochrome white) |
| `public/manifest.json` | References `icon-192-v2.png` + `icon-512-v2.png` |
| `scripts/generate-badge.js` | Reproducible badge generation via `sharp` |

---

## 4. Cloud Functions (13 total, all nodejs22)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `sendQuestionnaireAvailableNotifications` | Scheduled (every 1 min) | Sends initial FCM when training ends. Creates `pendingQuestionnaireReminders` doc with `dueAt+3h` and `secondReminderDueAt+6h` |
| `sendQuestionnaireReminders` | Scheduled (every 5 min) | 3h reminder: "Still got 60 seconds? ⏱" — queries `status==pending AND dueAt<=now` |
| `sendQuestionnaireSecondReminder` | Scheduled (every 5 min) | 6h final reminder: "Final reminder 🔒" — queries `status==reminded AND secondReminderDueAt<=now` |
| `cleanupOldReminders` | Scheduled (weekly) | Deletes reminders >30 days old |
| `sendTestNotification` | HTTPS callable | Sends test FCM to caller's tokens |
| `lookupTeamByCode` | HTTPS callable | Returns `{teamId,teamName,role}` for a team code. Rate limited 10/60s in-memory |
| `createMembership` | HTTPS callable | Adds user to team after code verification |
| `syncIcsEvery10min` | Scheduled (every 10 min) | Syncs ICS calendars for all teams |
| `syncIcsNow` | HTTPS callable | On-demand ICS sync for a team |
| `syncIcsNowHttp` | HTTPS | HTTP version of syncIcsNow |
| `importTeamCalendarFromUrl` | HTTPS | Import ICS from URL |
| `importTeamCalendarFromUrlCallable` | HTTPS callable | Callable version — validates role + team membership |
| `anonymizePlayerDataForAI` | Auth user.delete trigger | GDPR: strips PII, writes to `ai_training_dataset` |

### Notification Sequence
```
Session ends (endUtc)
├─ T+0   sendQuestionnaireAvailableNotifications fires
│         → "ChampionTrackPro ⚡ / Tell us — how did that session hit you?"
│         → creates pendingQuestionnaireReminders { dueAt: +3h, secondReminderDueAt: +6h, status: "pending" }
│
├─ T+3h  sendQuestionnaireReminders fires
│         → "Still got 60 seconds? ⏱ / Your coach needs your data..."
│         → updates doc: { status: "reminded", remindedAt }
│
└─ T+6h  sendQuestionnaireSecondReminder fires
          → "Final reminder 🔒 / Don't let your session go untracked."
          → updates doc: { secondReminderSent: true, secondRemindedAt }
```

---

## 5. Firestore Security Rules — Summary

```
users/{uid}
  read:   signedIn()
  create: signedIn()
  update: isAdmin() OR (own doc AND NOT changing role/teamId)

teams/{teamId}
  read:   isAdmin() OR isCoachOfTeam(teamId) OR isTeamMember(teamId)
  write:  isAdmin() OR isCoachOfTeam(teamId)

teams/{teamId}/members/{memberId}
  read:   isAdmin() OR isTeamMember(teamId)
  write:  isAdmin() OR isCoachOfTeam(teamId)

teams/{teamId}/trainings/{trainingId}
  read:   isAdmin() OR isCoachOfTeam(teamId) OR isTeamMember(teamId)
  write:  isAdmin() OR isCoachOfTeam(teamId)

/{path=**}/responses/{responseId}   [collectionGroup]
  read:   isAdmin() OR (isCoach() AND resource.data.teamId membership verified)
  write:  signedIn()

pendingQuestionnaireReminders/{id}
  read:   isAdmin()
  write:  false  (Cloud Functions via Admin SDK only)

ai_training_dataset/{id}
  read, write: false  (Admin SDK only)
```

---

## 6. Decisions Log (DEC-01 → DEC-15)

All 15 decisions documented in `DECISIONS.md`. Key ones:

| ID | Decision |
|----|----------|
| DEC-01 | VULN-02: use `resource.data.teamId` for collectionGroup scoping (path extraction impossible) |
| DEC-02 | VULN-03: block `role` + `teamId` on self-update; allow `fcmWebTokens`, `displayName`, `photoBase64`, etc. |
| DEC-03 | `sessionType` defaults to `"conditioning"` when absent (smallest question set) |
| DEC-04 | V1+V2 coexistence: `extractV2Metrics` checks V2 first, falls back to V1 French fields |
| DEC-05 | Team join uses `lookupTeamByCode` CF; direct team reads restricted to membership |
| DEC-09 | `lookupTeamByCode` rate limit: in-memory Map (acceptable at current scale) |
| DEC-11 | Client-side `isTest` guard kept alongside server-side filter (defense-in-depth) |
| DEC-12 | Position filter propagates to `filteredResponses`, not just the player dropdown |
| DEC-13 | Analytics utilities extracted to `src/utils/analytics.ts` |
| DEC-14 | Coach photo saved as base64 in Firestore (not Storage); 500KB limit |
| DEC-15 | 6h reminder gated on `status=="reminded"`; skipped if 3h reminder was never sent |

---

## 7. Design System (apply to all new screens)

```
Background:    #0A0F1E
Cards:         #0D1526
Accent cyan:   #00D4FF
Cyan dim bg:   rgba(0,212,255,0.08)
Cyan border:   rgba(0,212,255,0.14)
Muted text:    rgba(255,255,255,0.38)
Primary btn:   linear-gradient(135deg, #00BFFF, #0066FF)
Success:       #00FF9D
Warning:       #FFB800
Danger:        #FF4444

Fonts:
  Display:  Bebas Neue (letter-spacing 2-10px)
  Body/UI:  DM Sans (300/400/500/600)
  Labels:   Space Mono (uppercase, letter-spacing 1.5-4px)

Hooks:
  useIsDesktop() — mandatory on all Coach and Admin screens

Rules:
  Never use Windows absolute paths in source code
  Scrollbar hidden on all screens
  All UI text in English
  Logo: /logo/logo_final.jpeg, mixBlendMode: 'screen'
```

---

## 8. Known Remaining Items (Low Priority)

| # | Item | Notes |
|---|------|-------|
| 1 | `lookupTeamByCode` anonymous rate limit | All pre-auth callers share "anonymous" key — single device can exhaust per-instance limit. Upgrade to Firestore counter if abuse observed (DEC-09) |
| 2 | 6h reminder: 3h→6h chain | If 3h reminder skipped (no tokens), 6h also skipped. Acceptable in practice (DEC-15) |
| 3 | Coach photo Firestore doc size | Base64 at 500KB = ~667KB in Firestore doc (limit 1MB). Monitor at scale; migrate to Storage CDN if needed (DEC-14) |
| 4 | `src/utils/analytics.ts` V1 normalization | V1 `sleepQuality` inversion slightly differs from original AthleteDetailScreen implementation. Verify with real historical data before GA |
| 5 | Gen 1 → Gen 2 migration | All functions are Gen 1. Gen 2 offers longer timeouts, higher concurrency. Not urgent until traffic scales |
| 6 | Firebase App Check | Would harden `lookupTeamByCode` and all callables against abuse. Not yet implemented |

---

## 9. Test Data

| Entity | Value |
|--------|-------|
| Test team | TRAINING TEST — `teamId: Ri8kpStgWp9yymtS71tb` |
| Test athletes | `bball_pg_1` → `bball_c_10` (10 basketball players, 90 days synthetic data) |
| Coach test account | `coachtest@gmail.com` — UID `fqXEQa0rjPdQcsCEcORWefOSzWw1` |
| Test athlete | `nkirsch@kces.fr` — Nathan Kirsch — UID `84CKZH4GvTbxuK6g7bX73lQaaF32` |

Trainings marked `isTestSession: true` are excluded from coach dashboard and athlete home. Responses with `isTest: true` excluded from all analytics.

---

## 10. Deployment

```bash
# Frontend
npx expo export --platform web   # builds to /dist
# Vercel deploys automatically on push to main

# Cloud Functions
firebase deploy --only functions
# or per-function: firebase deploy --only functions:sendQuestionnaireSecondReminder

# Firestore rules
firebase deploy --only firestore:rules

# Firestore indexes
firebase deploy --only firestore:indexes

# Environment variables (Vercel)
EXPO_PUBLIC_FCM_VAPID_KEY   # Web Push VAPID key
# All Firebase config is in src/lib/firebase.ts (hardcoded, public)
```

---

## 11. Full Feature Status

| Feature | Status |
|---------|--------|
| Auth (email/password) | ✅ |
| Team join via access code | ✅ `lookupTeamByCode` CF |
| Athlete questionnaire V2 | ✅ SemanticSlider, conditional, Friction Matrix |
| Coach dashboard V2 | ✅ Morning Brief, 5 charts, EMA, isTest excluded |
| Player/position filter (dashboard) | ✅ Composable filters, position propagates to responses |
| AthleteDetailScreen | ✅ Gauge + EMA + Radar + sessions table |
| Coach Profile — name edit | ✅ Auth + Firestore |
| Coach Profile — photo edit | ✅ Base64, 500KB, live preview, success banner |
| FCM initial notification (T+0) | ✅ High priority, deep link, "ChampionTrackPro ⚡" |
| FCM 3h reminder (T+3h) | ✅ "Still got 60 seconds? ⏱" |
| FCM 6h final reminder (T+6h) | ✅ "Final reminder 🔒" |
| FCM token cleanup (arrayRemove) | ✅ All 3 send paths |
| Token re-registration (24h) | ✅ visibilitychange |
| Notification onboarding | ✅ Platform-specific (Android/iOS Safari/iOS PWA) |
| Notification status in Profile | ✅ Active/Inactive/Blocked |
| Notification reminder banner | ✅ After 3 logins without permission |
| badge-72.png (Android status bar) | ✅ Generated, deployed |
| Icon references (icon-192-v2) | ✅ SW + manifest + functions |
| GDPR anonymization on delete | ✅ anonymizePlayerDataForAI |
| Reminder doc cleanup | ✅ cleanupOldReminders (weekly) |
| Analytics utils (shared module) | ✅ src/utils/analytics.ts |
| Security VULN-01/02/03/05 | ✅ Firestore rules + CF auth |
| Cloud Functions runtime | ✅ Node.js 22 (all 13 functions) |
| iOS PWA install banner | ✅ |
| Web build (expo export) | ✅ No errors |
| Firebase deploy | ✅ All functions live |
