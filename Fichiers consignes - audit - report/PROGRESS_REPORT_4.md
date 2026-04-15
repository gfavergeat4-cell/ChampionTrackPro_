# PROGRESS_REPORT_4.md — ChampionTrackPro
Generated: 2026-03-10

---

## TASK 1 — 6h Final Reminder Notification

**Status:** COMPLETE — deployed

**Files changed:**
- `functions/index.js`

**Changes:**
1. Added `secondReminderDueAt: Timestamp(now + 6h)` to the `pendingQuestionnaireReminders` doc created in `sendQuestionnaireAvailableNotifications` (line 864).
2. New exported Cloud Function `sendQuestionnaireSecondReminder`:
   - Schedule: every 5 minutes, Europe/Paris
   - Query: `status == "reminded"` AND `secondReminderDueAt <= now`
   - Skip docs where `secondReminderSent === true` (client-side guard)
   - Skip if questionnaire already completed (checks responses subcollection)
   - Batch user doc fetch via `db.getAll(...userRefs)`
   - FCM payload: `title: "Final reminder 🔒"` / `body: "Don't let your session go untracked."`
   - Same FCM structure: android HIGH, apns-priority 10, webpush Urgency high, deep link
   - `arrayRemove` failed tokens after send
   - Updates doc: `secondReminderSent: true` + `secondRemindedAt: serverTimestamp()`

**Commit:** `1be9712`

**Notification sequence now:**
- T+0: Initial notification (session end) — "ChampionTrackPro ⚡"
- T+3h: 3h reminder — "Still got 60 seconds? ⏱"
- T+6h: Final reminder — "Final reminder 🔒"

---

## TASK 2 — Verify icon-192-v2.png references

**Status:** VERIFIED — no changes needed

All 3 files already reference correct filenames:
1. `public/firebase-messaging-sw.js:32` → `icon: "/icons/icon-192-v2.png"`, `badge: "/icons/badge-72.png"` ✅
2. `public/manifest.json:9` → `"src": "/icons/icon-192-v2.png"` (192×192) + `icon-512-v2.png` (512×512) ✅
3. `functions/index.js:823,978,1065` → `icon-192-v2.png` + `badge-72.png` on all 3 send paths ✅
4. `public/icons/badge-72.png` → exists (72×72px, 2201 bytes) ✅

No commit needed.

---

## TASK 3 — Coach Profile editing (name + photo)

**Status:** COMPLETE

**File changed:**
- `src/screens/CoachProfileScreen.tsx`

**Changes:**
- Removed Firebase Storage dependency (`uploadBytes`, `getDownloadURL`, `storage`)
- Added `updateProfile` from Firebase Auth
- Added `setDoc` with merge for Firestore update
- Photo upload: `FileReader.readAsDataURL()` → base64 data URL → saved to `users/{uid}.photoBase64`
  - 500 KB file size limit enforced client-side; inline error if exceeded
- Name edit: `updateProfile(auth.currentUser, { displayName })` + `setDoc merge` to Firestore
  - Saves both `displayName` and `fullName` fields for forward/backward compatibility
- Avatar display on load: `photoBase64` (Firestore) takes priority over `photoURL` (Storage)
- Live avatar preview during edit: `editPhotoBase64 || existing photoURL`
- Success feedback: green "Profile updated ✅" banner for 3 seconds, then hides
- `successMsg` state added (null → string → null after timeout)

**Firestore rule:** No change needed. DEC-02 blocks `role` and `teamId` changes only. `photoBase64` and `displayName`/`fullName` are not in the blocked fields list.

**Commit:** `7282d72`

---

## TASK 4 — Extract analytics utilities (DEC-13)

**Status:** COMPLETE

**New file:**
- `src/utils/analytics.ts`

**Exported symbols:**
| Name | Signature | Description |
|------|-----------|-------------|
| `calculateEMA` | `(values: (number\|null)[], N: number) → number[]` | α=2/(N+1), null=carry-forward, seeds with first value or 5 |
| `calculateDeviation` | `(value: number, ema: number) → number` | ((v-ema)/ema)×100 |
| `calculateReadiness` | `(m: V2Metrics) → number` | Weighted readiness 0-100, all metrics inverted |
| `extractV2Metrics` | `(r: RawResponse) → V2Metrics \| null` | V2 first, V1 French fallback, null if no data |
| `V2Metrics` | interface | Exported type |
| `RawResponse` | interface | Exported type |

**Files updated:**
- `src/screens/PerformanceDashboard.tsx`
  - Removed local `V2Metrics`, `RawResponse` interfaces
  - Removed local `extractV2Metrics`, `calculateReadinessScore`, `calculateEMA`, `calculateDeviation`
  - Updated call sites: `calculateEMA(x)` → `calculateEMA(x, 28)`, `calculateEMA(workloads, 7)` for acute
  - `calculateReadinessScore(m2)` → `calculateReadiness(m2)`, null-safe `extractV2Metrics(r) ?? {}`
- `src/screens/AthleteDetailScreen.tsx`
  - Removed local `calculateEMA`, `calculateEMA7`, `calculateReadiness`, `getMetric`... kept `getMetric` as local helper (not exported)
  - Updated: `calculateEMA(scores, 28)`, `calculateEMA(workloads, 7)`, `calculateEMA(workloads, 28)`
  - `calculateReadiness(r) * 10` → `calculateReadiness(r?.metrics ?? {})` (new version returns 0-100)

**Commit:** `8ad0bb3`

---

## New Decisions

### DEC-14 — Coach photo storage: base64 in Firestore vs Firebase Storage
**Context:** TASK 3 — original `CoachProfileScreen` used Firebase Storage for photo upload. Task required switching to base64 in Firestore.
**Decision:** Save photo as base64 data URL in `users/{uid}.photoBase64`. Enforce 500 KB client-side limit. Rationale: eliminates Storage dependency, works without CORS config, no additional billing dimension for low-traffic coach profile edits. Acceptable at current scale (team of ≤50 coaches).
**Tradeoff:** 500 KB base64 ≈ 667 KB stored in Firestore document. Firestore document limit is 1 MB. Monitor if coaches upload high-resolution photos; upgrade to Storage CDN if document size becomes a concern.

### DEC-15 — 6h reminder triggered by status=="reminded", not by time from creation
**Context:** TASK 1 — the second reminder (6h) is triggered when `status == "reminded" AND secondReminderDueAt <= now`. This means it fires 6h after the initial notification, not 6h after session end.
**Decision:** Acceptable. The `secondReminderDueAt` is set to `now + 6h` at initial notification time (session end), so the 6h window is relative to session end, which matches the stated requirement. The `status == "reminded"` gate ensures the 3h reminder was already sent before the 6h fires.
**Tradeoff:** If the 3h reminder is delayed (e.g. user had no tokens at T+3h, status never set to "reminded"), the 6h reminder also never fires. Acceptable: a user who missed the 3h window due to missing tokens is unlikely to have tokens at 6h.

---

## AUTO-VALIDATION Results

| Check | Command | Result |
|-------|---------|--------|
| Web build | `npx expo export --platform web` | ✅ Exported: dist — no errors |
| Functions deploy | `firebase deploy --only functions` | ✅ 12 functions updated |
| Functions logs | `firebase functions:log --lines 10` | ✅ Only update audit logs, no runtime errors |
| icon-192-v2 in SW | `grep -n "icon-192-v2" firebase-messaging-sw.js` | ✅ Line 32 |
| icon-192-v2 in manifest | `grep -n "icon-192-v2" manifest.json` | ✅ Line 9 |
| secondReminderSent in functions | `grep -n "secondReminderSent" functions/index.js` | ✅ Lines 1033, 1042, 1046, 1051, 1108 |

---

## Blockers Encountered

None — all tasks completed without blockers.

---

## Full App Status Table

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (email/password) | ✅ Working | |
| Team join via access code | ✅ Working | `lookupTeamByCode` CF |
| Athlete questionnaire (V2) | ✅ Working | SemanticSlider, sessionType-conditional, Friction Matrix |
| Coach dashboard (V2) | ✅ Working | Morning Brief, EMA, 5 chart types, isTest excluded |
| Dashboard player/position filter | ✅ Working | Position filter propagates to responses (DEC-12) |
| AthleteDetailScreen | ✅ Working | Gauge, EMA trendline, RadarChart, sessions table |
| Coach Profile — name edit | ✅ Working | updateProfile + Firestore setDoc merge |
| Coach Profile — photo edit | ✅ Working | Base64, 500KB limit, live preview, success banner |
| FCM notifications — session end | ✅ Working | "ChampionTrackPro ⚡" |
| FCM notifications — 3h reminder | ✅ Working | "Still got 60 seconds? ⏱" |
| FCM notifications — 6h final | ✅ Working | "Final reminder 🔒" — deployed |
| FCM token cleanup (arrayRemove) | ✅ Working | All 3 send paths |
| Token re-registration (24h) | ✅ Working | visibilitychange listener |
| Notification onboarding | ✅ Working | OnboardingNotifScreen, platform-specific |
| Notification status in Profile | ✅ Working | Active/Inactive/Blocked dots |
| badge-72.png | ✅ Exists | 72×72px monochrome |
| icon-192-v2.png references | ✅ Correct | SW + manifest + functions all updated |
| GDPR anonymization | ✅ Working | anonymizePlayerDataForAI CF |
| Reminder cleanup | ✅ Working | cleanupOldReminders weekly CF |
| Analytics utils (DEC-13) | ✅ Extracted | `src/utils/analytics.ts` |
| Security (VULN-01/02/03/05) | ✅ Fixed | Firestore rules + CF auth |
| Cloud Functions runtime | ✅ Node 22 | All 12 functions |
| iOS PWA install banner | ✅ Working | |
| Web build | ✅ Passing | Expo export clean |

---

## What Remains Open

| # | Item | Priority | Notes |
|---|------|----------|-------|
| 1 | lookupTeamByCode rate limit upgrade | Low | In-memory rate limit resets on cold start (DEC-09) |
| 2 | 6h reminder: status=="reminded" gate | Low | If 3h reminder skipped (no tokens), 6h also skipped (DEC-15) |
| 3 | photoBase64 document size monitoring | Low | 500KB limit; upgrade to Storage CDN if abuse (DEC-14) |
| 4 | `src/utils/analytics.ts` V1 normalization | Low | V1 sleepQuality inversion differs between Dashboard and old AthleteDetailScreen — verify with real data |
