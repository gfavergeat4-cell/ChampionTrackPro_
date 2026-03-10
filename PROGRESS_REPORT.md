# PROGRESS REPORT — ChampionTrackPro V2
Generated: 2026-03-10 | Commits: cab5733 → d3775fd

---

## 1. SECURITY FIXES (Phase 2 — commit cab5733)

### VULN-01 — Unauthenticated team read (CRITICAL)
- **Was:** `allow read: if request.auth == null || isAdmin() || isCoach() || isTeamMember(teamId)`
- **Risk:** Any unauthenticated internet user could read all team documents, including private `icsUrl` calendar links and member counts.
- **Fix:** `firestore.rules` line 96 → `allow read: if signedIn();`

### VULN-02 — Cross-team IDOR on coach response reads (CRITICAL)
- **Was:** `match /{path=**}/responses/{responseId} { allow read: if isAdmin() || isCoach(); }`
- **Risk:** Any coach could `collectionGroup("responses")` and read every athlete's wellness data across all teams. HIPAA/GDPR violation.
- **Fix:** `firestore.rules` lines 83–88 → added `resource.data.teamId != null && exists(/databases/$(database)/documents/teams/$(resource.data.teamId)/members/$(request.auth.uid))` to scope reads to the coach's own team.

### VULN-03 — Role escalation via self-update (CRITICAL)
- **Was:** `allow update: if signedIn() && (isAdmin() || uid == request.auth.uid)` — no field restrictions.
- **Risk:** Any athlete could write `role: "admin"` to their own user document and gain full dashboard access.
- **Fix:** `firestore.rules` lines 70–74 → added `!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'teamId'])` to block self-escalation.

### VULN-05 — No team authorization on ICS Cloud Functions (MEDIUM)
- **Was:** `syncIcsNow` and `importTeamCalendarFromUrlCallable` only checked `context.auth != null`. Any athlete could overwrite any team's calendar.
- **Fix:** `functions/index.js` lines 228–242, 492–503 → added role check (coach/admin) + team membership verification via Admin SDK before executing.

### New Firestore rules added
- `pendingQuestionnaireReminders`: `read: isAdmin()`, `write: false` (Cloud Functions only)
- `ai_training_dataset`: `read, write: false` (Admin SDK only)
- New helper: `isCoachOfTeam(teamId)` combining `isCoach()` + `isTeamMember(teamId)`

---

## 2. V2 QUESTIONNAIRE (Phase 3 — commit 147df2c)

### What changed vs V1

| | V1 | V2 |
|---|---|---|
| Fields | French names (`fatigue`, `concentration`, etc.) | English `metrics.*` schema |
| Scale | 1–10 numeric input | SemanticSlider (1–10, anchors, floating tooltip) |
| Questions | Same set for all sessions | Conditional by `sessionType` |
| Friction | None | Friction Matrix toggle |
| Schema saved | Flat V1 fields | `{ metrics, readinessScore, workloadAU, sessionType, hasFriction, ... }` |

### New structure
- **`sessionType`** (conditioning / skill / scrimmage) — drives which questions appear
- **`QUESTION_SETS`**: conditioning = 5 questions, skill = 6, scrimmage = 7
- **`calculateReadiness(m)`**: weighted formula — cardio×0.20, neuro×0.25, sleep×0.20, stress×0.15, motor×0.10, tactical×0.10
- **`workloadAU`**: sessionRPE × trainingDuration (AU = arbitrary units)
- **SemanticSlider**: CSS `.slider-v2`, gradient thumb `#00BFFF→#0066FF`, no numbers at rest, tooltip on drag
- **Friction Matrix**: toggle → frictionType select (Physical Fatigue / Academic-Life Stress / Court Confusion / Mental-Emotional) + 3 sub-sliders

### File modified
- `screens/StitchQuestionnaireScreen.js` — full rewrite

---

## 3. NOTIFICATIONS (commits 9ece7c3 → d3775fd)

### Before (issues)
- Stale FCM tokens never cleaned up → "Sent to 0/1 tokens" silently
- Notification tap → landed on Home → athlete had to find questionnaire manually
- No onboarding → notification opt-in rate < 30%
- Notification copy was system-generated ("Questionnaire available for training ID xyz")
- Notifications sent at NORMAL priority → no pop-up on Android
- Token expiry silently broke delivery; no re-registration mechanism
- Test button visible to all athletes in Profile

### After (6 fixes applied)

**FIX 5** (`9ece7c3`) — Token cleanup
- `arrayRemove` all failed tokens (not just specific error codes) after every FCM send
- Applied to: `sendQuestionnaireAvailableNotifications`, `sendQuestionnaireReminders`, `sendTestNotification`

**FIX 4** (`cdcbf18`) — Deep link
- Notification tap → opens `/?screen=questionnaire&trainingId=X&teamId=Y` → questionnaire loads directly
- `public/firebase-messaging-sw.js`: `notificationclick` builds URL from `event.notification.data.trainingId`
- `navigation/StitchNavigator.js`: reads `screen/trainingId/teamId` params on startup
- `functions/index.js`: all 3 send paths updated to new URL format
- Copywriting: NOTIF 1 = "ChampionTrackPro ⚡ / Tell us — how did that session hit you?", NOTIF 2 = "Still got 60 seconds? ⏱ / Your coach needs your data..."
- FCM priority: `android.priority: "high"`, `apns: apns-priority: 10`, `webpush.headers.Urgency: "high"`

**FIX 2** (`181fde1`) — Reminder banner
- `users/{uid}.loginCount` incremented on every app open (StitchNavigator AuthGate)
- After 3+ logins without `Notification.permission === 'granted'` (non-standalone): banner in AthleteHomeNew
- Dismiss ×2 → `localStorage.notifReminderDismissed = true` → never shown again

**FIX 1** (`53120bc`) — Onboarding screen
- `src/screens/OnboardingNotifScreen.tsx` — new file
- Platform-specific flows: Android Chrome (direct requestPermission), iOS Safari non-standalone (install guide), iOS PWA standalone (requestPermission)
- Stored in Firestore: `users/{uid}.onboardingComplete: true`
- Integrated in `StitchNavigator.js`: athletes with `onboardingComplete: false` see full-screen onboarding before AthleteHome
- Style: Bebas Neue 36px title, gradient button `#00BFFF→#0066FF`, skip×2 exits

**FIX 3** (`217c838`) — Profile notification status
- Replaced test button with status indicator: ● Active (green #00FF9D) / ● Inactive (red #FF3B30, tappable → requestPermission) / ● Blocked (orange #FFB800, tappable → inline platform instructions)
- Test button hidden from athletes; visible to `role: coach` / `role: admin` only
- Secret access: 5× tap on profile avatar reveals test button for any user

**FIX 6** (`d3775fd`) — Token re-registration
- `src/services/fcmService.js`: `visibilitychange` listener added after `initializeFCM()`
- Re-registers token if >24h since last registration (`localStorage.fcmLastRegistration`)
- Guard flag `window.__fcmVisibilityListenerAttached` prevents duplicate listeners

---

## 4. DECISIONS MADE AUTONOMOUSLY

| ID | Decision | Rationale |
|----|----------|-----------|
| DEC-01 | VULN-02 fix uses `resource.data.teamId` membership check (not path extraction) | Firestore wildcard `{path=**}` cannot extract intermediate segments; data-level check is the only viable approach |
| DEC-02 | VULN-03 fix uses `affectedKeys().hasAny(['role', 'teamId'])` | Blocks escalation fields while allowing athletes to update `fcmWebTokens`, `displayName`, `photoURL`, etc. |
| DEC-03 | `sessionType` defaults to `"conditioning"` when absent | Smallest question set = minimum burden when type unknown (ICS-imported trainings have no sessionType) |
| DEC-04 | Dashboard supports V1+V2 schemas simultaneously via `extractV2Metrics()` | 90 days of prod data uses V1 French field names; migration would corrupt historical charts |
| DEC-05 | Unauthenticated team read → `signedIn()` (not Cloud Function) | Minimal breaking-change fix; team code join flow still works; Cloud Function refactor logged for future |
| DEC-06 | ICS functions verify `role` + team membership via Admin SDK | Prevents any athlete from overwriting any team's calendar |
| DEC-07 | "Physical Soreness" → "Physical Fatigue" | HIPAA compliance requirement from PRD |
| DEC-08 | `ai_training_dataset`: client access = `false` | Written by Admin SDK only; no client should ever access raw anonymized data directly |

---

## 5. WHAT REMAINS

### Phase 4 — V2 Dashboard enhancements (partially done in commit 55e652b)
Already shipped: Morning Brief (EMA, risk levels), RadarChart, deviation chart, workload chart, V1/V2 field mapping.
Still open:
- DEBT-02: exclude `isTest` responses from collectionGroup query (`where("isTest", "==", false)`)

### Phase 6 — Team code join flow refactor (DEC-05 follow-up)
- Replace `allow read: if signedIn()` on teams with a Cloud Function `lookupTeamByCode(code)` returning only `{teamId, teamName}`
- Eliminates need for authenticated-but-not-yet-member reads

### Phase 7 — Operational debt
- DEBT-03: weekly Cloud Function to delete `pendingQuestionnaireReminders` older than 30 days
- DEBT-04: batch user doc fetches in `sendQuestionnaireAvailableNotifications` (currently O(teams × trainings × members) reads)

### Phase 8 — Badge icon
- `public/icons/badge-72.png` — 72×72px monochrome white logo for Android status bar
- Generate via `sharp` from `logo/logo_final.svg`

### Phase 9 — App Check
- Add Firebase App Check to rate-limit `lookupTeamByCode` and protect all callable functions from abuse
