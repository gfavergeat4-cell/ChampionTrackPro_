# ChampionTrackPro — Engineering \& Product Onboarding

**Classification:** Internal · Source of Truth · March 2026\*\*
**Audience:** Claude Code — Autonomous Senior Engineer
**Written by:** Product \& Engineering Director

\---

## PRIME DIRECTIVE — READ THIS FIRST

You are the **senior full-stack engineer** on ChampionTrackPro. You work with **full autonomy**. These are your non-negotiable operating rules:

* **Never stop to ask for permission.** Make the decision, implement it, test it, ship it.
* **Never wait for confirmation** before writing code, running commands, or pushing to git.
* **Always self-test** after every change. If it fails, fix it before moving on.
* **Token efficiency is critical.** Read files surgically. Don't re-read what you already know. Batch operations. One commit per logical unit of work.
* **World-class execution only.** Write code at the level of a senior engineer at Stripe or Linear. Clean TypeScript, zero `any` types, meaningful variable names, no dead code.
* **Always read before you write.** Never modify a file you haven't fully read in this session.
* **If you find a bug not in your task list**, fix it and log it. Never leave broken code.
* **English only** in all UI text, comments, and commit messages.

\---

## WHAT IS CHAMPIONTRACKPRO

ChampionTrackPro is a **daily athlete wellness monitoring SaaS** built for NCAA collegiate basketball programs. It gives coaching staffs a science-backed picture of every athlete's readiness every morning before practice — without wearables, without app downloads, and without a sports scientist on staff.

**The core loop:**

1. Training session ends → push notification fires automatically
2. Athlete opens phone → completes 60-second check-in (6 sliders + friction matrix)
3. Coach opens app next morning → sees Morning Brief: risk-sorted roster, readiness scores, deviation from personal baselines, worry flags
4. Coach makes data-driven load decisions before practice starts

**The proprietary algorithm — DAR (Dynamic Adaptive Reserve):**

* Calculates a 28-day exponential moving average (EMA) per athlete
* Compares each day's score to that athlete's own baseline — not population norms
* Classifies into 3 zones: GREEN (±15% of EMA), BLUE (<-15%, under-load), YELLOW (>+15%, spike/overreach)
* Requires minimum 3 data points before classification

**Live production URL:** https://champtrackpro.com (also: https://champion-track-pro.vercel.app)
**GitHub repo:** https://github.com/gfavergeat4-cell/ChampionTrackPro\_
**Firebase project:** `championtrackpro`
**Latest commit:** c694f6d

\---

## TECH STACK

|Layer|Technology|
|-|-|
|Frontend|React Native Web + Expo (web-first, PWA)|
|Backend|Firebase Cloud Functions (Node.js)|
|Database|Firestore (NoSQL)|
|Auth|Firebase Auth (email/password)|
|Notifications|FCM Web Push|
|Hosting|Vercel (auto-deploy from GitHub main)|
|Domain|champtrackpro.com (Namecheap → Vercel DNS)|
|Charts|Recharts|
|Language|TypeScript + JavaScript|

\---

## DESIGN SYSTEM

```
Background:     #0A0F1E  (deep navy)
Card:           #0D1526
Card alt:       #111C2E
Accent cyan:    #00D4FF
Accent blue:    #0066FF
Green (done):   #00C853
Yellow (warn):  #FFB800
Red (alert):    #FF4444
Blue (zone):    #2196F3
Purple:         #8B5CF6
Font:           DM Sans (UI), Space Mono (labels/code)
Border radius:  8-12px on cards
```

**Critical rule:** `useIsDesktop()` hook is **mandatory** on all Coach and Admin screens. Breakpoint: viewport ≥ 768px.

\---

## FILE STRUCTURE

```
ChampionTrackPro/
├── App.js                          ← Root entry (web). MUST EXIST at root.
├── index.js                        ← Native entry
├── index.web.js                    ← Web entry
├── app.config.js / app.json        ← Expo config
├── firestore.rules                 ← Security rules (hardened v2)
├── firestore.indexes.json          ← Composite indexes
├── firebase.json                   ← Firebase deploy config
├── vercel.json                     ← Security headers (CSP, HSTS, etc.)
├── FERPA\\\_COMPLIANCE.md             ← Legal compliance doc
├── MVP\\\_FINAL\\\_REPORT.md             ← Sprint audit report
│
├── functions/
│   └── index.js                    ← All 8 Cloud Functions (\\\~900 lines)
│
├── navigation/
│   └── StitchNavigator.js          ← Root navigator (auth gate + routing)
│
├── src/
│   ├── screens/
│   │   ├── PerformanceDashboard.tsx   ← Main analytics (RECENTLY UPDATED)
│   │   ├── AdminHomeScreen.tsx        ← Admin team grid
│   │   ├── AdminTeamDetailScreen.tsx  ← Dashboard-first team view (RECENTLY UPDATED)
│   │   ├── CreateTeamModal.tsx        ← Create team (RECENTLY UPDATED)
│   │   ├── AthleteDetailScreen.tsx    ← Per-athlete profile (RECENTLY UPDATED)
│   │   ├── CoachHomeScreen.tsx        ← Coach home KPIs + alerts (RECENTLY UPDATED)
│   │   ├── CoachTeamScreen.tsx        ← Team roster (RECENTLY UPDATED)
│   │   ├── CoachScheduleScreen.tsx    ← Day/Week/Month calendar (RECENTLY UPDATED)
│   │   ├── CoachProfileScreen.tsx     ← Coach profile edit
│   │   └── OnboardingNotifScreen.tsx  ← Push permission + FERPA notice
│   │
│   ├── components/
│   │   ├── DARPerformanceChart.tsx    ← 4-quadrant DAR chart (RECENTLY UPDATED)
│   │   ├── DARRawChart.tsx            ← Raw score chart + Q1/Med/Q3 (RECENTLY UPDATED)
│   │   ├── DARStackedChart.tsx        ← Zone distribution bars
│   │   ├── SplashScreen.tsx
│   │   ├── PWAInstallBanner.tsx
│   │   └── FCMDebugPanel.tsx
│   │
│   ├── utils/
│   │   ├── useDARAlgorithm.ts         ← DAR zone classification (DO NOT MODIFY MATH)
│   │   ├── analytics.ts               ← EMA, deviation, V1→V2→V3 bridge
│   │   ├── questionnaire.ts           ← Status computation (open/closed/completed)
│   │   ├── questionnaireTemplates.ts  ← 5 sport templates + seeding
│   │   └── responsive.ts / time.ts
│   │
│   ├── lib/
│   │   ├── responses.ts               ← saveQuestionnaireResponse(), Firestore wrapper
│   │   ├── firebase.ts                ← Firebase app instance
│   │   └── mapTraining.ts / trainings.ts
│   │
│   ├── services/
│   │   ├── fcmService.js              ← FCM init + token management
│   │   ├── webNotifications.ts        ← Web push token registration
│   │   └── notificationTest.ts
│   │
│   ├── hooks/
│   │   └── useIsDesktop.ts            ← viewport ≥ 768px
│   │
│   ├── constants/
│   │   └── theme.ts                   ← Design tokens
│   │
│   └── types/
│       └── firestore.ts               ← TypeScript interfaces for all Firestore docs
│
├── screens/                        ← Legacy Stitch screens (some active)
│   ├── StitchLoginScreen.js
│   ├── StitchCreateAccountScreen.js
│   ├── StitchQuestionnaireScreen.js   ← V3 questionnaire (ACTIVE — 1089 lines)
│   ├── StitchProfileScreen.js
│   ├── StitchScheduleScreen.js
│   └── StitchHomeScreenClean.js
│
├── scripts/
│   ├── seed-realistic-season.js       ← Seeds 90 days of NBA-realistic data
│   └── seedBasketballTeam.js
│
└── public/
    ├── firebase-messaging-sw.js       ← FCM service worker (background push)
    └── icons/
        └── icon-notif-color.png       ← Cyan slider notification icon 192×192
```

\---

## FIRESTORE SCHEMA

### `users/{uid}`

```
email, role (admin|coach|athlete), teamId, displayName, fullName,
photoBase64, fcmWebTokens\\\[] (capped at 10), loginCount,
onboardingComplete, createdAt, updatedAt
```

**Security:** User reads own doc. Self-update BLOCKS role + teamId changes (VULN-03).

### `teams/{teamId}`

```
name, sport, logoUrl, inviteCode (6-char),
questionnaireId, icsUrl, calendarUrl (alias),
calendarActive, calendarLastSyncStatus (ok|error|syncing),
calendarLastSyncCounts {created, updated, deleted, cancelled},
timeZone, createdAt, updatedAt
```

**Removed fields:** division, seasonStart, seasonEnd, activeDARMetrics

### `teams/{teamId}/members/{uid}`

```
displayName, name, fullName, email, role (coach|athlete),
position, jerseyNumber, joinedAt
```

### `teams/{teamId}/trainings/{trainingId}`

```
title, startUtc, endUtc, sessionType (game|practice|conditioning),
isGame, isTestSession, questionnaireId, calendarEventId,
hash (SHA-256), cancelled, source ("ics"), createdAt
```

### `teams/{teamId}/trainings/{trainingId}/responses/{uid}`

```
userId, teamId, trainingId, status ("completed"),
submittedAt, completedAt,
metrics: {
  tankLevel, cardioLoad, legBounce,
  motorControl, tacticalSharpness, teamChemistry
  (all 1-100)
},
readinessScore (0-100, weighted),
workloadAU (null in V3),
hasFriction, frictionType\\\[], frictionImpact, worryLevel,
worryFlag (hasFriction AND worryLevel>70),
sessionType, questionnaireId, isTest,
-- V2 backward-compat aliases:
neuroLoad, stressLevel, sleepQuality, tacticalLucidity,
-- V1 French legacy:
impactCardiaque, impactMusculaire, sommeil, nervosite,
technique, tactique, fatigue
```

### `questionnaires/{questionnaireId}`

```
id, name, sport, sessionType, description, isDefault,
isArchived, createdBy, questions: QuestionDef\\\[]
```

### `pendingQuestionnaireReminders/{docId}`

```
teamId, trainingId, status (pending|sent), dueAt, createdAt
Write: Cloud Functions Admin SDK ONLY
```

### `ai\\\_training\\\_dataset/{doc}`

GDPR-anonymized responses. read:false write:false.

\---

## V3 METRIC KEYS \& DISPLAY NAMES

|Field key|Display name|Notes|
|-|-|-|
|`tankLevel`|Energy Tank|Higher = better|
|`cardioLoad`|Cardio Load \*|**INVERTED** — higher = more fatigued|
|`legBounce`|Leg Bounce|Higher = better|
|`motorControl`|Motor Control|Higher = better|
|`tacticalSharpness`|Tactical Sharpness|Higher = better|
|`teamChemistry`|Team Chemistry|Higher = better|

**Category composites:**

* Physical Engine = avg(tankLevel, legBounce, 101 - cardioLoad)
* Mental Energy = teamChemistry
* Technical Execution = avg(motorControl, tacticalSharpness)

**V3→V2 bridge function** (use everywhere for backward compat):

```typescript
const getMetric = (response: any, v3key: string, v2key: string, def = 0): number =>
  response?.metrics?.\\\[v3key] ?? response?.metrics?.\\\[v2key] ?? response?.\\\[v2key] ?? def
```

\---

## CLOUD FUNCTIONS (functions/index.js — 8 active)

|Function|Trigger|Purpose|
|-|-|-|
|`sendQuestionnaireAvailableNotifications`|CRON 1min|Fires FCM when training ends|
|`sendQuestionnaireReminders`|CRON 5min|Reminder if athlete hasn't responded|
|`syncIcsCron`|CRON 15min|Sync all active team calendars|
|`syncIcsNow`|HTTPS callable|Immediate manual sync for one team|
|`lookupTeamByCode`|HTTPS callable|Resolve invite code → teamId + role|
|`createMembership`|HTTPS callable|Join team, create member doc|
|`sendTestNotification`|HTTPS callable|Dev utility|
|`anonymizePlayerDataForAI`|Auth onDelete|GDPR anonymization on account delete|

**Notification timing:**

* Available: immediately after `training.endUtc`
* Closes: 5 hours after `training.endUtc`
* Reminder: 3 hours after training end

\---

## SECURITY POSTURE (Score: 8/10)

|Vector|Status|
|-|-|
|Unauthenticated reads|✅ Blocked (VULN-01)|
|collectionGroup responses|✅ teamId-scoped (VULN-02)|
|Self role/teamId escalation|✅ Blocked (VULN-03)|
|Member create scoping|✅ Own team coaches only|
|CF input validation|✅ validateString() on all callables|
|Security headers (Vercel)|✅ CSP, HSTS, X-Frame-Options DENY|
|Frontend sanitization|✅ sanitize() on all Firestore writes|
|FCM token growth|✅ Capped at 10 per user|

**Known low-severity gaps (not blocking):**

* `isCoachOfTeam()` uses existence check not role check (correct in combination with `isCoach()`)
* `anonymizePlayerDataForAI` is O(teams) reads per delete — acceptable at current scale
* No staging environment — all dev/test in production Firebase project

\---

## FERPA COMPLIANCE

`FERPA\\\_COMPLIANCE.md` exists at project root. Key points:

* Operating as School Official under 34 CFR § 99.31(a)(1)
* Collects: wellness self-reports only. No GPA, SSN, medical records.
* Anonymization on user delete: `anonymizePlayerDataForAI` CF
* Privacy notice on `OnboardingNotifScreen.tsx`
* Privacy notice on `StitchQuestionnaireScreen.js`
* HTTPS enforced via Vercel HSTS (max-age=31536000)
* Firebase AES-256 at rest

**Required before NCAA onboarding:** Signed Data Processing Agreement (DPA) — template not yet created.

\---

## QUESTIONNAIRE TEMPLATES (seeded to Firestore)

|ID|Sport|Type|Default|
|-|-|-|-|
|`tpl-basketball-any`|Basketball|Any Session|✅|
|`tpl-basketball-game`|Basketball|Game Day|—|
|`tpl-handball-any`|Handball|Any Session|✅|
|`tpl-soccer-any`|Soccer|Any Session|✅|
|`tpl-generic-any`|Generic|Any Session|✅|

\---

## AUTH \& NAVIGATION FLOW

```
App loads → StitchNavigator.js → AuthGate
  Not logged in → LandingScreen → Login / CreateAccount
  Logged in → wait for onSnapshot (role race condition fix)
    role = athlete → AthleteTabs
      Home (AthleteHomeNew) → 4-state session card
      Schedule → StitchScheduleScreen
      Profile → StitchProfileScreen
    role = coach → CoachTabs
      Home → CoachHomeScreen (KPIs + V3 alerts)
      Team → CoachTeamScreen (roster + last questionnaire status)
      Schedule → CoachScheduleScreen (Day/Week/Month)
      Analytics → PerformanceDashboard
      Profile → CoachProfileScreen
    role = admin → AdminTabs
      Teams → AdminHomeScreen (team grid)
      Analytics → PerformanceDashboard (admin view)
  Join by code → URL ?code=XXXXXX-A → pendingJoinCode → lookupTeamByCode CF
```

**Auto admin seed:** `gabfavergeat4@gmail.com` gets admin role automatically.

\---

## RECENTLY COMPLETED WORK

### MVP Sprint (commit 8033772)

1. ✅ Admin tabs → real screens (was pointing to blank placeholder)
2. ✅ Coach pain detection V1→V3 (worryFlag, readinessScore<40, frictionImpact>70)
3. ✅ Questionnaire params: `trainingId || sessionId` bridge
4. ✅ AthleteDetailScreen: V3 radar with getMetric() bridge
5. ✅ Team members view in AdminTeamDetailScreen drawer
6. ✅ icon-notif-color.png created (192×192, cyan slider design)
7. ✅ Legacy files deleted: StitchAdminDashboard.js, TeamCalendarSettings.js, icsImporterReal.ts
8. ✅ DAR rebrand: 0 "Morin" references remain
9. ✅ Security hardening: 7 vectors addressed
10. ✅ FERPA\_COMPLIANCE.md + privacy notices

### Create Team Modal Simplification

* ✅ Removed: division, season dates, DAR metrics toggles
* ✅ Kept: Team Name, Logo (base64), Calendar URL
* ✅ Added: Questionnaire selector (Firestore cards, default Basketball)
* ✅ Added: Success screen with \[CODE]-C and \[CODE]-A + Copy Code + Copy Link buttons
* ✅ AdminTeamDetailScreen settings drawer: same simplification

### Dashboard Analytics (commit c694f6d) — LATEST

* ✅ Fixed empty charts (V3 field mapping mismatch was root cause)
* ✅ Category composites: Physical Engine / Mental Energy / Technical Execution
* ✅ Q1 / Median / Q3 reference lines on Line, Bar, Deviation, Workload
* ✅ Radar: 6 V3 axes (cardioLoad inverted)
* ✅ Filter pills: By Category / Combined / By Indicator
* ✅ Full Season button (Oct 2025 → Mar 2026)
* ✅ V3 display names + cardioLoad footnote

### Domain \& Infrastructure

* ✅ champtrackpro.com purchased on Namecheap (\~$6.79/yr)
* ✅ DNS configured: A Record 216.198.79.1, CNAME 2b7cbe03b2261162.vercel-dns-017.com
* ✅ Both champtrackpro.com and www.champtrackpro.com green on Vercel
* ✅ SSL auto-managed by Vercel

\---

## CURRENT KNOWN ISSUES (as of session end)

### 🔴 ACTIVE BUG — Dashboard still shows no chart data

**Symptom:** Analytics tab shows legends (Energy Tank, Cardio Load, etc.) but chart area is completely empty. Filters visible, pills work, but zero data points rendered.

**Most likely causes (in order of probability):**

1. `teamId` not matching `Ri8kpStgWp9yymtS71tb` in the Firestore query
2. Date filter DD/MM vs MM/DD format confusion (custom dates show 01/10/2025 → 31/03/2026)
3. `collectionGroup("responses")` query not firing correctly
4. `chartData` array built correctly but Recharts `dataKey` doesn't match field names
5. All responses filtered out by `isTest: true`

**Debug approach:**

```typescript
console.log('\\\[DASH] responses raw:', responses?.length)
console.log('\\\[DASH] filtered:', filteredResponses?.length)
console.log('\\\[DASH] chartData sample:', JSON.stringify(chartData?.slice(0,2)))
console.log('\\\[DASH] teamId:', teamId)
```

**Pending task:** Remove "Line" and "Radar" from Chart Type pills. Keep: Bar, Deviation, Workload, DAR. Default: Bar.

### 🟡 Coach profile phone field

Phone input in edit mode is never saved to Firestore. Low priority.

### 🟡 App Check enforcement

Configured in Firebase Console but enforcement status unknown.

### 🟡 FCM stale tokens

Users created before token cap fix may have >10 tokens. Need one-time cleanup script.

### 🟡 No E2E tests

Zero automated tests. Acceptable for MVP but needed before scale.

### 🟡 DPA template

Data Processing Agreement document needed before first NCAA client signs.

\---

## TEST DATA \& ACCOUNTS

### Firestore Test Team

```
Team:    TRAINING TEST
teamId:  Ri8kpStgWp9yymtS71tb
Coach UID:   fqXEQa0rjPdQcsCEcORWefOSzWw1
Athlete UID: 84CKZH4GvTbxuK6g7bX73lQaaF32
Period:  Oct 2025 → Mar 2026 (seeded via seed-realistic-season.js)
Data:    \\\~1,185 responses across 12 athletes, 29 games
```

### Firebase Auth Test Accounts

```
ADMIN:
  email:    gabfavergeat@gmail.com
  password: zqx5JGfTPqj2TRE
  role:     admin (auto-seeded)
  use for:  AdminHomeScreen, AdminTeamDetailScreen, CreateTeam

COACH:
  email:    coachgabtest@gmail.com
  password: aznee366
  role:     coach
  teamId:   Ri8kpStgWp9yymtS71tb
  use for:  CoachHomeScreen, PerformanceDashboard, CoachTeamScreen

ATHLETE:
  email:    testmail@gmail.com
  password: feujaufour3945
  role:     athlete
  teamId:   Ri8kpStgWp9yymtS71tb
  use for:  AthleteHomeNew, StitchQuestionnaireScreen
```

### How to Authenticate Programmatically for Diagnosis

Use this Node.js script to authenticate and query Firestore directly:

```javascript
// scripts/diagnose-dashboard.js
const { initializeApp } = require('firebase/app')
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth')
const { getFirestore, collection, query, where,
        collectionGroup, getDocs } = require('firebase/firestore')

const firebaseConfig = {
  // Read from services/firebaseConfig.js or firebaseConfig.web.js
}

async function diagnose() {
  const app = initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const db = getFirestore(app)

  // Sign in as coach
  const { user } = await signInWithEmailAndPassword(
    auth, 'coachgabtest@gmail.com', 'aznee366'
  )
  console.log('Signed in as coach:', user.uid)

  // Query responses
  const teamId = 'Ri8kpStgWp9yymtS71tb'
  const q = query(
    collectionGroup(db, 'responses'),
    where('teamId', '==', teamId)
  )
  const snap = await getDocs(q)
  console.log('Total responses found:', snap.size)
  if (snap.size > 0) {
    const sample = snap.docs\\\[0].data()
    console.log('Sample response keys:', Object.keys(sample))
    console.log('Sample metrics:', sample.metrics)
    console.log('Sample readinessScore:', sample.readinessScore)
    console.log('Sample submittedAt:', sample.submittedAt)
  }
}

diagnose().catch(console.error)
```

### Autonomous Verification Protocol

After every fix to the dashboard or any data-dependent screen:

1. **Run the diagnosis script** to verify Firestore data is accessible
2. **Build the web app:** `npm run web:build`
3. **Open champtrackpro.com** in a headless check or note the deployed URL
4. **Sign in programmatically** with coach account and verify the query returns data
5. **Fix any mismatch** between what Firestore returns and what the chart expects
6. **Commit only when data flows end-to-end**

You have full access to all three accounts. Use them freely to verify every screen from every role's perspective. Never ask for permission to run these checks.

\---

## BUILD \& DEPLOY

```bash
# TypeScript check
npx tsc --noEmit
# Expected: 9 pre-existing errors in add-planning.js, Questionnaire.js,
# QuestionnaireScreenNew.tsx — NOT in sprint files

# Web build
npm run web:build
# = expo export → copy-service-worker.js → inject-metadata.js → verify-build.js

# Deploy Functions
firebase deploy --only functions

# Deploy rules + indexes
firebase deploy --only firestore

# Git
git add .
git commit -m "feat: description"
git push origin main
# Vercel auto-deploys on push to main
```

**If App.js is missing:** `git show HEAD:App.js > App.js` — it's in git history.

\---

## BUSINESS CONTEXT

**Target market:** NCAA D2/D3 basketball programs, 750+ programs, no sports scientist on staff.

**GTM strategy:** Consulting-first.

* 6 weeks FREE pilot (pre-season) in exchange for a signed testimonial
* Upsell: $12,000 for full season (platform + weekly 1v1 consulting)
* Year 2: $15,000-18,000 (with NCAA case study)
* Year 3: $20,000+ (multiple references)

**Key differentiator:** DAR compares each athlete to themselves (28-day EMA), not population norms. Competitors (Catapult $30K+, Kinduct) only serve D1 at enterprise prices.

**Proof of concept:** D1 Handball France — last place, 0 wins in 6 months → +4 ranking positions in 2 months, 0 load injuries during implementation.

**Production URL for all client communications:** champtrackpro.com

\---

## WHAT NOT TO TOUCH

* ❌ DAR algorithm math (EMA formula, zone thresholds ±15%)
* ❌ Questionnaire question text or slider anchors
* ❌ Firebase Auth configuration
* ❌ Firestore collections or documents (no deletes, no schema breaking changes)
* ❌ scripts/seed-realistic-season.js
* ❌ Any existing Cloud Function (only add or modify, never delete)

\---

## NEXT PRIORITIES (in order)

1. **Fix empty dashboard charts** — diagnose and fix the data pipeline
2. **Remove Line + Radar chart types** — keep Bar, Deviation, Workload, DAR
3. **Verify end-to-end** with `nkirsch@kces.fr` test account before any client demo
4. **DPA template** — one-page legal document for NCAA onboarding
5. **AthleteHomeNew V3 verification** — confirm V3 metrics display in session cards
6. **Coach profile phone save** — low priority but polish item

\---

*This document is the single source of truth for ChampionTrackPro engineering.
When in doubt: read the code, fix the bug, ship the fix. No permission needed.*

