# ChampionTrackPro — MVP Autonomous Sprint

**For Claude Code · Full autonomy · No interruptions · Self-testing · Self-correcting
Generated: March 2026**

\---

## PRIME DIRECTIVE

You are working as a **senior full-stack engineer and security auditor** on ChampionTrackPro.

Execute every task in this file **completely and autonomously**.

Rules:

* **Never stop to ask for permission.** Make decisions, implement, test, fix, repeat.
* **Never skip a task** because it seems complex. Break it down and solve it.
* **Always self-test** after each fix before moving to the next.
* **Never deploy Firebase Functions without explicit `firebase deploy` commands listed below** — these are the only safe deploy points.
* **Never delete production data.** You may add, update, and restructure.
* **If a test fails**, fix it and re-run the test until it passes. Log every attempt.
* **If you find additional bugs** not listed here, fix them and log them in the final report.
* **Write clean, typed TypeScript.** No `any` types unless absolutely unavoidable.
* All UI text must be **English only**.
* `useIsDesktop()` is mandatory on all Coach and Admin screens.
* Every `setDoc` to `users/{uid}` **must** use `{ merge: true }`.

\---

## STEP 0 — FULL READ BEFORE ANY CHANGE

Read these files **entirely** before writing a single line:

```
navigation/StitchNavigator.js
functions/index.js
firestore.rules
firestore.indexes.json
src/screens/PerformanceDashboard.tsx
src/screens/AdminHomeScreen.tsx
src/screens/AdminTeamDetailScreen.tsx
src/screens/AdminTeamScreen.tsx
src/screens/CreateTeamModal.tsx
src/screens/CoachHomeScreen.tsx
src/screens/CoachTeamScreen.tsx
src/screens/CoachScheduleScreen.tsx
src/screens/AthleteDetailScreen.tsx
screens/StitchQuestionnaireScreen.js
src/stitch\\\_components/AthleteHomeNew.tsx
src/utils/useDARAlgorithm.ts
src/utils/analytics.ts
src/utils/questionnaireTemplates.ts
src/utils/questionnaire.ts
src/lib/responses.ts
src/services/fcmService.js
src/services/webNotifications.ts
src/constants/theme.ts
src/types/firestore.ts
public/firebase-messaging-sw.js
package.json
app.json
```

Also run:

```bash
find . -type f \\\\( -name "\\\*.ts" -o -name "\\\*.tsx" -o -name "\\\*.js" \\\\) \\\\
  ! -path "\\\*/node\\\_modules/\\\*" ! -path "\\\*/dist/\\\*" ! -path "\\\*/.expo/\\\*" \\\\
  | sort
```

\---

## TASK 1 — FIX: Admin Tab Navigation (CRITICAL)

**Problem:** `AdminTabs` in `StitchNavigator.js` maps both "Teams" and "Analytics" tabs to `StitchAdminDashboard` — a blank placeholder. Admin cannot access real screens from the tab bar.

**Fix:**

1. Open `navigation/StitchNavigator.js`
2. Find `AdminTabs` component
3. Replace the "Teams" tab screen with `AdminHomeScreen` from `src/screens/AdminHomeScreen.tsx`
4. Replace the "Analytics" tab screen with `PerformanceDashboard` from `src/screens/PerformanceDashboard.tsx`
5. For the PerformanceDashboard in admin context: read `users/{uid}.teamId` from Firestore and pass it as the `teamId` prop

**Self-test:**

```bash
npx tsc --noEmit
```

Then verify in code that AdminTabs no longer imports or renders `StitchAdminDashboard` for Teams/Analytics tabs.
Log: `\\\[TASK 1] Admin tab navigation fixed — Teams → AdminHomeScreen, Analytics → PerformanceDashboard`

\---

## TASK 2 — FIX: Coach Pain Detection V1 → V3 Upgrade (CRITICAL)

**Problem:** `CoachHomeScreen.tsx`, `CoachTeamScreen.tsx`, and `CoachScheduleScreen.tsx` read V1 legacy fields (`impactMusculaire`, `fatigue`, `physicalPain`) to show risk alerts. V3 responses never set these fields — all alerts are silent.

**Fix in CoachHomeScreen.tsx:**

1. Find the alerts section reading V1 pain fields
2. Replace the athlete risk detection logic with:

```typescript
const isAtRisk = (response: any) => {
  // V3 detection
  if (response.worryFlag === true) return { level: 'mental', label: '⚠️ High worry' }
  if (response.readinessScore !== undefined \\\&\\\& response.readinessScore < 40)
    return { level: 'physical', label: `🔴 Readiness ${response.readinessScore}/100` }
  if (response.frictionImpact !== undefined \\\&\\\& response.frictionImpact > 70)
    return { level: 'friction', label: '⚡ High friction impact' }
  // V2 fallback
  if (response.stressLevel !== undefined \\\&\\\& response.stressLevel > 70)
    return { level: 'stress', label: '🟡 High stress' }
  // V1 legacy fallback (keep for old data only)
  if (response.impactMusculaire !== undefined \\\&\\\& response.impactMusculaire >= 70)
    return { level: 'physical', label: '🔴 Physical overload (legacy)' }
  if (response.fatigue !== undefined \\\&\\\& response.fatigue >= 80)
    return { level: 'fatigue', label: '🔴 High fatigue (legacy)' }
  return null
}
```

3. Apply same logic in `CoachTeamScreen.tsx`
4. In `CoachScheduleScreen.tsx`: replace `physicalPain` field color logic with:

   * `hasFriction === true` → amber left border on session card
   * `worryFlag === true` → red left border on session card
   * `readinessScore < 40` → red dot indicator
   * else → no indicator

**Self-test:**

```bash
npx tsc --noEmit
```

Verify no remaining references to `impactMusculaire`, `fatigue`, `physicalPain` as primary alert conditions (legacy fallback is fine).
Log: `\\\[TASK 2] Coach pain detection upgraded V1→V3 across 3 screens`

\---

## TASK 3 — FIX: Questionnaire Navigation Params (CRITICAL)

**Problem:** `StitchQuestionnaireScreen.js` reads `route.params.sessionId` but new navigation passes `trainingId`. Works by coincidence today — one refactor breaks it silently.

**Fix in screens/StitchQuestionnaireScreen.js:**

1. Find every occurrence of `route.params.sessionId`
2. Replace with: `route.params.trainingId || route.params.sessionId`
3. Store as a constant at top of component: `const trainingId = route.params?.trainingId || route.params?.sessionId`
4. Use `trainingId` everywhere

**Fix in navigation/StitchNavigator.js:**

1. Find the navigation call to the Questionnaire screen
2. Ensure it passes BOTH params for backward compat:

```javascript
navigation.navigate('Questionnaire', {
  trainingId: training.id,
  sessionId: training.id,  // deprecated alias — keep until fully migrated
  teamId: training.teamId,
  eventData: training,
})
```

**Self-test:**

```bash
npx tsc --noEmit
grep -r "route.params.sessionId" screens/ src/
# Must return 0 results (all replaced)
```

Log: `\\\[TASK 3] Questionnaire params hardened — trainingId primary, sessionId alias preserved`

\---

## TASK 4 — FIX: AthleteDetailScreen V3 Metrics

**Problem:** `AthleteDetailScreen.tsx` reads V2 metric keys for the radar chart. V3 athletes show 0 or null for all dimensions.

**Fix:**

1. Create a bridge function at the top of the file:

```typescript
const getMetric = (response: any, v3key: string, v2key: string, defaultVal = 0): number => {
  return response?.metrics?.\\\[v3key]
    ?? response?.metrics?.\\\[v2key]
    ?? response?.\\\[v2key]
    ?? defaultVal
}
```

2. Replace all direct metric reads in the radar chart data with:

```typescript
physical:  getMetric(r, 'legBounce',         'neuroLoad'),
cardio:    getMetric(r, 'cardioLoad',         'cardioLoad'),
tank:      getMetric(r, 'tankLevel',          'sleepQuality'),
chemistry: getMetric(r, 'teamChemistry',      'stressLevel'),
motor:     getMetric(r, 'motorControl',       'motorControl'),
tactical:  getMetric(r, 'tacticalSharpness',  'tacticalLucidity'),
```

3. Also bridge `readinessScore`: use `response.readinessScore ?? response.readiness ?? 0`
4. Bridge `workloadAU`: use `response.workloadAU ?? (response.sessionRPE \\\* response.durationMinutes) ?? 0`

**Self-test:**

```bash
npx tsc --noEmit
```

Log: `\\\[TASK 4] AthleteDetailScreen bridges V1/V2/V3 metric keys`

\---

## TASK 5 — FIX: Team Members View

**Problem:** No UI to see who is in a team or remove a member. Blocking for real client onboarding.

**Fix in AdminTeamDetailScreen.tsx:**

1. Add a "Members" accordion in the settings drawer (after Access Codes, before Calendar)
2. On expand: query `teams/{teamId}/members` and display a list
3. Each member row shows:

   * Avatar circle (initials, cyan background)
   * Display name + email
   * Role badge (coach = cyan pill, athlete = green pill)
   * Joined date formatted "Jan 5, 2026"
   * "Remove" button (red outline, small, 32px height)
4. "Remove" shows a confirmation: `"Remove ${name} from this team? They will lose access immediately."`
5. On confirm:

```typescript
   await deleteDoc(doc(db, `teams/${teamId}/members/${uid}`))
   await updateDoc(doc(db, `users/${uid}`), { teamId: null })
   ```

6. Show member count: "3 Coaches · 9 Athletes"

**Self-test:**

```bash
npx tsc --noEmit
```

Manual check: verify the query reads `teams/{teamId}/members` collection.
Log: `\\\[TASK 5] Team members view added — list + remove member`

\---

## TASK 6 — CREATE: Notification Icon

**Problem:** `icon-notif-color.png` does not exist. Notifications show generic icon on Android.

**Fix:**

1. Check if `public/icons/icon-notif-color.png` exists: `ls public/icons/icon-notif-color.png`
2. If it does NOT exist, create it programmatically using Node canvas or sharp:

```bash
node -e "
const { createCanvas } = require('canvas');
const fs = require('fs');
const canvas = createCanvas(192, 192);
const ctx = canvas.getContext('2d');

// Transparent background
ctx.clearRect(0, 0, 192, 192);

// Cyan slider track
ctx.fillStyle = 'rgba(0, 212, 255, 0.25)';
ctx.beginPath();
ctx.roundRect(28, 86, 136, 20, 10);
ctx.fill();

// Filled portion
ctx.fillStyle = '#00D4FF';
ctx.beginPath();
ctx.roundRect(28, 86, 90, 20, 10);
ctx.fill();

// Thumb circle
ctx.fillStyle = '#FFFFFF';
ctx.beginPath();
ctx.arc(118, 96, 18, 0, Math.PI \\\* 2);
ctx.fill();

// Inner dot
ctx.fillStyle = '#00D4FF';
ctx.beginPath();
ctx.arc(118, 96, 8, 0, Math.PI \\\* 2);
ctx.fill();

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('public/icons/icon-notif-color.png', buffer);
console.log('icon-notif-color.png created');
"
```

3. If `canvas` module is not available, try with `sharp`:

```bash
npm install sharp --save-dev 2>/dev/null
node -e "
const sharp = require('sharp');
const svg = \\\\`<svg width='192' height='192' xmlns='http://www.w3.org/2000/svg'>
  <rect width='192' height='192' fill='transparent'/>
  <rect x='28' y='86' width='136' height='20' rx='10' fill='rgba(0,212,255,0.25)'/>
  <rect x='28' y='86' width='90' height='20' rx='10' fill='#00D4FF'/>
  <circle cx='118' cy='96' r='18' fill='white'/>
  <circle cx='118' cy='96' r='8' fill='#00D4FF'/>
</svg>\\\\`;
sharp(Buffer.from(svg)).png().toFile('public/icons/icon-notif-color.png')
  .then(() => console.log('Created icon-notif-color.png via sharp'));
"
```

4. Update `functions/index.js` notification sends: change `icon` field to use `icon-notif-color.png` where applicable
5. Update `public/firebase-messaging-sw.js`: ensure `icon` field points to `/icons/icon-notif-color.png`

**Self-test:**

```bash
ls -la public/icons/icon-notif-color.png
# Must exist and be > 500 bytes
```

Log: `\\\[TASK 6] icon-notif-color.png created — cyan slider design 192×192`

\---

## TASK 7 — CLEANUP: Remove 7 Legacy Files

**Problem:** 7 orphan files clog the codebase. `StitchAdminDashboard.js` actively blocks navigation.

**Steps:**

1. First verify none are imported anywhere (except the ones we're fixing):

```bash
grep -r "StitchAdminDashboard" src/ screens/ navigation/ --include="\\\*.js" --include="\\\*.ts" --include="\\\*.tsx"
grep -r "TeamCalendarSettings" src/ screens/ navigation/ --include="\\\*.js" --include="\\\*.ts" --include="\\\*.tsx"
grep -r "icsImporterReal" src/ screens/ navigation/ --include="\\\*.js" --include="\\\*.ts" --include="\\\*.tsx"
grep -r "WelcomeScreen" src/ screens/ navigation/ --include="\\\*.js" --include="\\\*.ts" --include="\\\*.tsx"
grep -r "AuthScreen" src/ screens/ navigation/ --include="\\\*.js" --include="\\\*.ts" --include="\\\*.tsx"
```

2. After Task 1 removes the StitchAdminDashboard import from navigator, delete these files:

```bash
rm screens/StitchAdminDashboard.js
rm screens/TeamCalendarSettings.js
rm src/lib/icsImporterReal.ts
# Only delete these if grep confirms 0 active imports:
# src/screens/WelcomeScreen.tsx (if unimported)
# src/screens/AuthScreen.js (if unimported)
# src/screens/AdminPanel.js (if unimported)
```

3. Do NOT delete files that still have active imports — just note them in the report.

**Self-test:**

```bash
npx tsc --noEmit
# Must still pass after deletions
```

Log: `\\\[TASK 7] Legacy files removed: \\\[list which ones]`

\---

## TASK 8 — COMPLETE: DAR Rebrand (Morin → DAR)

**Problem:** Some files still reference "Morin" — intellectual property risk before any external demo.

**Fix:**

```bash
# Find all remaining references
grep -ri "morin" src/ functions/ scripts/ navigation/ screens/ \\\\
  --include="\\\*.ts" --include="\\\*.tsx" --include="\\\*.js" -l
```

For each file found:

* Replace all string occurrences: `"Morin"` → `"DAR"`, `"morin"` → `"dar"`
* Rename any remaining files:

  * `useMorinAlgorithm.ts` → `useDARAlgorithm.ts` (if not yet done)
  * `MorinPerformanceChart.tsx` → `DARPerformanceChart.tsx` (if not yet done)
* Update all imports accordingly

**Self-test:**

```bash
grep -ri "morin" src/ functions/ scripts/ navigation/ screens/ \\\\
  --include="\\\*.ts" --include="\\\*.tsx" --include="\\\*.js"
# Must return 0 results
npx tsc --noEmit
```

Log: `\\\[TASK 8] DAR rebrand complete — 0 Morin references remain`

\---

## TASK 9 — SECURITY HARDENING: Full Cyber Audit \& Fixes

Read `firestore.rules` entirely. Then implement every fix below.

### 9.1 — Fix: Any coach can add members to any team

**Problem:** `teams/{teamId}/members/{uid}` create rule allows any coach (not specifically THIS team's coach) to add members.

**Fix in firestore.rules:**

```
// BEFORE (too permissive):
allow create: if isCoach() || isAdmin();

// AFTER (scoped to this team):
allow create: if request.auth.uid == uid
  || (isCoach() \\\&\\\& isTeamMember(teamId))
  || isAdmin();
```

### 9.2 — Add rate limiting awareness comment + App Check note

Add at top of `firestore.rules`:

```
// SECURITY LEVEL: HARDENED v2 — March 2026
// App Check: configured for production (Firebase Console)
// Rate limiting: enforced via Cloud Functions callable auth
// FERPA: compliant — see FERPA\\\_COMPLIANCE.md
```

### 9.3 — Harden Cloud Functions: validate all inputs

In `functions/index.js`, for every `httpsCallable` function:

1. `lookupTeamByCode`: validate `code` is string, 6-10 chars, alphanumeric+dash only
2. `createMembership`: validate `teamId` is non-empty string, `role` is exactly "coach" or "athlete"
3. `syncIcsNow`: validate `teamId` is non-empty string, verify caller is coach of that team

Add this validation helper at top of functions/index.js:

```javascript
function validateString(val, name, maxLen = 200) {
  if (typeof val !== 'string' || val.trim().length === 0)
    throw new functions.https.HttpsError('invalid-argument', `${name} must be a non-empty string`)
  if (val.length > maxLen)
    throw new functions.https.HttpsError('invalid-argument', `${name} exceeds max length`)
  return val.trim()
}
```

### 9.4 — Add security headers to Vercel config

Create/update `vercel.json`:

```json
{
  "headers": \\\[
    {
      "source": "/(.\\\*)",
      "headers": \\\[
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://\\\*.firebaseapp.com https://\\\*.googleapis.com; connect-src 'self' https://\\\*.firebaseio.com https://\\\*.googleapis.com wss://\\\*.firebaseio.com https://api.anthropic.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none';"
        },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" }
      ]
    }
  ]
}
```

### 9.5 — Sanitize all user inputs in frontend

In `CreateTeamModal.tsx`, `AdminTeamDetailScreen.tsx`, `CoachProfileScreen.tsx`:

1. Add input sanitization before any Firestore write:

```typescript
const sanitize = (str: string, maxLen = 200): string =>
  str.trim().replace(/\\\[<>\\\\"']/g, '').slice(0, maxLen)
```

2. Apply to: team name, coach name, display name, calendar URL (URL-specific validation already exists in CF)

### 9.6 — Protect FCM tokens array from unbounded growth

In `src/services/webNotifications.ts` and `fcmService.js`:
After `arrayUnion`, add cleanup to cap tokens at 10 per user:

```typescript
// After writing the new token, check array size
const userDoc = await getDoc(doc(db, 'users', uid))
const tokens: string\\\[] = userDoc.data()?.fcmWebTokens || \\\[]
if (tokens.length > 10) {
  // Keep only the 10 most recent (last 10)
  await updateDoc(doc(db, 'users', uid), {
    fcmWebTokens: tokens.slice(-10)
  }, { merge: true })
}
```

### 9.7 — Add Firestore index for member role queries

In `firestore.indexes.json`, add:

```json
{
  "collectionGroup": "members",
  "queryScope": "COLLECTION",
  "fields": \\\[
    { "fieldPath": "role", "order": "ASCENDING" },
    { "fieldPath": "joinedAt", "order": "DESCENDING" }
  ]
}
```

**Self-test after all security fixes:**

```bash
npx tsc --noEmit
firebase firestore:rules --project championtrackpro 2>/dev/null || echo "Rules syntax checked locally"
```

Log: `\\\[TASK 9] Security hardening complete — 7 vectors addressed`

\---

## TASK 10 — FERPA COMPLIANCE

**What is FERPA:** The Family Educational Rights and Privacy Act (20 U.S.C. § 1232g) governs the privacy of student educational records at US institutions receiving federal funding. All NCAA programs are covered. ChampionTrackPro collects daily wellness data on student-athletes — this is considered an education record under FERPA.

**Create file: `FERPA\\\_COMPLIANCE.md`** at project root with full content:

```markdown
# FERPA Compliance — ChampionTrackPro
\\\*\\\*Last reviewed: March 2026\\\*\\\*
\\\*\\\*Status: Compliant by design\\\*\\\*

## Legal Basis
ChampionTrackPro operates under FERPA (20 U.S.C. § 1232g) as a
School Official with a legitimate educational interest.
Per 34 CFR § 99.31(a)(1), authorized vendors with direct control
over educational records under the institution's supervision are
permitted to access student data without individual consent.

## Data Collected
- Daily wellness self-reports (1-100 slider scales)
- Session type and timing
- Anonymous readiness scores
- Friction and psychological load indicators

## What We Do NOT Collect
- Academic grades or GPA
- Medical diagnoses or prescriptions
- Social Security numbers
- Financial information
- Personally identifiable information beyond name and email

## Data Minimization (FERPA § 99.34)
- Athletes only see their own data
- Coaches only see their own team's data
- Aggregated team data never identifies individual athletes to outsiders
- Admins access is logged and role-restricted

## Data Retention
- Active responses: retained for duration of team membership
- On account deletion: personal data anonymized within 24h via
  `anonymizePlayerDataForAI` Cloud Function (GDPR-style FERPA compliance)
- Anonymized aggregated data may be retained for research

## Security Measures (FERPA Safeguard requirement)
- All data encrypted in transit (HTTPS/TLS 1.3 enforced by Vercel)
- All data encrypted at rest (Firebase default AES-256)
- Role-based access control enforced at database level (Firestore Rules)
- No data shared with third parties without institutional consent
- Audit trail available via Firebase console logs
- App Check protects against unauthorized API access

## Student Rights Under FERPA
Athletes have the right to:
1. Access their own wellness data (available via athlete profile)
2. Request correction of inaccurate data (contact team admin)
3. Request deletion of their data (account deletion triggers anonymization)

## Institutional Agreement Requirements
Before onboarding any NCAA institution, ChampionTrackPro requires:
- A signed Data Processing Agreement (DPA)
- Designation as School Official in the institution's FERPA policy
- Written confirmation that athletes have been informed of data collection

## Contact for FERPA Requests
gabin@champtrackpro.com (to be configured)

## Changelog
- March 2026: Initial FERPA compliance framework established
- GDPR anonymization CF verified as FERPA-compatible
- Firestore security rules audited and FERPA-compliant access controls confirmed
```

**Implement FERPA requirements in code:**

1. **Data access logging** — add to Firestore rules a comment noting which rules enforce FERPA:

```
// FERPA: athletes access own records only — § 99.12 "education records"
// FERPA: coaches have legitimate educational interest — § 99.31(a)(1)
```

2. **Anonymization trigger** — verify `anonymizePlayerDataForAI` CF runs on user delete:

```bash
grep -n "anonymizePlayerDataForAI\\\\|onDocumentDeleted\\\\|user.\\\*delete" functions/index.js
```

If not implemented or incomplete, implement:

```javascript
exports.anonymizeOnUserDelete = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid
  const db = admin.firestore()
  // Find all responses by this user across all teams
  const responsesSnap = await db.collectionGroup('responses')
    .where('userId', '==', uid).get()
  const batch = db.batch()
  responsesSnap.forEach(doc => {
    batch.update(doc.ref, {
      userId: 'ANONYMIZED',
      // Keep metrics and readinessScore for aggregate research
      // Remove all PII
    })
  })
  // Delete user doc
  batch.delete(db.collection('users').doc(uid))
  await batch.commit()
  console.log(`\\\[FERPA] Anonymized data for deleted user ${uid}`)
})
```

3. **Add FERPA notice to athlete onboarding:**
In `OnboardingNotifScreen.tsx`, add below the notification permission section:

```typescript
<Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 12, paddingHorizontal: 24 }}>
  Your wellness data is protected under FERPA.
  It is only visible to your coaching staff.
  You may request deletion of your data at any time.
</Text>
```

4. **Add FERPA notice to questionnaire:**
In `StitchQuestionnaireScreen.js`, add a one-line privacy note below the submit button:

```javascript
<Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', textAlign: 'center', marginTop: 8 }}>
  Your responses are private and protected. Only your coaching staff can see this data.
</Text>
```

**Self-test:**

```bash
ls -la FERPA\\\_COMPLIANCE.md
grep -n "FERPA" OnboardingNotifScreen.tsx screens/StitchQuestionnaireScreen.js
```

Log: `\\\[TASK 10] FERPA compliance implemented — documentation + anonymization + privacy notices`

\---

## TASK 11 — BUILD VERIFICATION

After all tasks complete, run the full build pipeline:

```bash
# TypeScript check
npx tsc --noEmit
# Expected: 0 errors

# Expo web build
npx expo export --platform web 2>\\\&1 | tail -20
# Expected: "Web Bundled" with no errors

# Check for remaining Morin references
grep -ri "morin" src/ functions/ screens/ navigation/ \\\\
  --include="\\\*.ts" --include="\\\*.tsx" --include="\\\*.js"
# Expected: 0 results

# Check legacy files are gone
ls screens/StitchAdminDashboard.js 2>/dev/null \\\&\\\& echo "STILL EXISTS" || echo "DELETED OK"
ls screens/TeamCalendarSettings.js 2>/dev/null \\\&\\\& echo "STILL EXISTS" || echo "DELETED OK"
ls src/lib/icsImporterReal.ts 2>/dev/null \\\&\\\& echo "STILL EXISTS" || echo "DELETED OK"

# Check icon exists
ls -la public/icons/icon-notif-color.png
# Expected: file exists > 500 bytes

# Check FERPA file
ls -la FERPA\\\_COMPLIANCE.md
# Expected: file exists

# Check vercel.json security headers
cat vercel.json | grep "X-Frame-Options"
# Expected: DENY
```

\---

## TASK 12 — DEPLOY FUNCTIONS

Only after all tasks pass verification:

```bash
firebase deploy --only functions
```

Wait for completion. If it fails, read the error and fix before proceeding.

\---

## TASK 13 — GIT COMMIT

```bash
git add .
git commit -m "feat: MVP sprint — 11 tasks complete

FIXES (Critical):
- Admin tab navigation: Teams→AdminHomeScreen, Analytics→PerformanceDashboard
- Coach pain detection: V1→V3 (worryFlag + readinessScore + frictionImpact)
- Questionnaire params: trainingId primary, sessionId alias preserved
- AthleteDetailScreen: V1/V2/V3 metric bridge

FEATURES:
- Team members view with remove functionality
- icon-notif-color.png created (cyan slider 192×192)

SECURITY HARDENING:
- Firestore rules: scoped member create to team coaches only
- Cloud Functions: input validation on all callables
- Vercel: security headers (CSP, HSTS, X-Frame-Options, etc.)
- Frontend: input sanitization on all user inputs
- FCM tokens: capped at 10 per user

COMPLIANCE:
- FERPA\\\_COMPLIANCE.md created
- Anonymization CF verified/implemented
- Privacy notices added to onboarding and questionnaire

CLEANUP:
- Legacy files removed: StitchAdminDashboard.js + others
- DAR rebrand complete: 0 Morin references remain

feat: MVP ready for first NCAA client onboarding"

git push origin main
```

\---

## TASK 14 — GENERATE FINAL REPORT

Create file `MVP\\\_FINAL\\\_REPORT.md` at project root with this exact structure:

```markdown
# ChampionTrackPro — MVP Final Report
\\\*\\\*Generated:\\\*\\\* \\\[current date]
\\\*\\\*Sprint:\\\*\\\* Autonomous MVP Sprint v1.0
\\\*\\\*Engineer:\\\*\\\* Claude Code

---

## EXECUTIVE SUMMARY
\\\[2-3 sentences on overall state of the project]

---

## TASKS COMPLETED

| # | Task | Status | Files Modified | Tests |
|---|------|--------|----------------|-------|
| 1 | Admin tab navigation fix | ✅/❌ | \\\[files] | \\\[pass/fail] |
| 2 | Coach pain detection V3 | ✅/❌ | \\\[files] | \\\[pass/fail] |
| 3 | Questionnaire params hardened | ✅/❌ | \\\[files] | \\\[pass/fail] |
| 4 | AthleteDetailScreen V3 metrics | ✅/❌ | \\\[files] | \\\[pass/fail] |
| 5 | Team members view | ✅/❌ | \\\[files] | \\\[pass/fail] |
| 6 | Notification icon | ✅/❌ | \\\[files] | \\\[pass/fail] |
| 7 | Legacy files cleanup | ✅/❌ | \\\[files deleted] | \\\[pass/fail] |
| 8 | DAR rebrand complete | ✅/❌ | \\\[files] | \\\[pass/fail] |
| 9 | Security hardening | ✅/❌ | \\\[files] | \\\[pass/fail] |
| 10 | FERPA compliance | ✅/❌ | \\\[files] | \\\[pass/fail] |

---

## ADDITIONAL BUGS FOUND \\\& FIXED
\\\[List any bugs discovered during the sprint not in the original task list]

---

## SECURITY AUDIT RESULTS

| Vector | Before | After | Severity |
|--------|--------|-------|----------|
| Admin tab routing | \\\[state] | \\\[state] | \\\[HIGH/MED/LOW] |
| Member create scoping | \\\[state] | \\\[state] | |
| Input validation CFs | \\\[state] | \\\[state] | |
| Security headers | \\\[state] | \\\[state] | |
| Frontend sanitization | \\\[state] | \\\[state] | |
| FCM token growth | \\\[state] | \\\[state] | |
| \\\[any additional vectors] | | | |

\\\*\\\*Security Score: \\\[X/10] → \\\[Y/10]\\\*\\\*

---

## FERPA COMPLIANCE CHECKLIST

- \\\[ ] FERPA\\\_COMPLIANCE.md created and accurate
- \\\[ ] Anonymization on user delete: implemented / verified
- \\\[ ] Privacy notice on onboarding screen
- \\\[ ] Privacy notice on questionnaire
- \\\[ ] Role-based access controls: athlete/coach/admin separation confirmed
- \\\[ ] Data minimization: no unnecessary PII collected
- \\\[ ] Encryption in transit: HTTPS enforced
- \\\[ ] Encryption at rest: Firebase AES-256

---

## BUILD STATUS

```

TypeScript: \[0 errors / N errors]
Expo export: \[success / failed]
Morin references: \[0 / N remaining]
Legacy files: \[removed / remaining]

```

---

## WHAT IS READY FOR FIRST CLIENT

\\\[Honest assessment: what works end-to-end today]

1. \\\[Feature 1 — works]
2. \\\[Feature 2 — works]
...

---

## WHAT STILL NEEDS WORK BEFORE PRODUCTION SCALE

\\\[Honest list of remaining gaps for post-MVP]

1. \\\[Gap 1 — why it matters — estimated effort]
2. \\\[Gap 2 — why it matters — estimated effort]
...

---

## RECOMMENDED IMPROVEMENTS DETECTED DURING SPRINT

\\\[Anything noticed during the work that wasn't in the original spec
but would improve quality, performance, or security]

1. \\\[Improvement — file — impact]
...

---

## WEAKNESSES FOUND BUT NOT IN SCOPE

\\\[Things that need attention but were out of scope for this sprint]

---

## COMMIT HASH
\\\[git log --oneline -1]
```

\---

## FINAL CHECK

Before closing, verify these 10 items are all green:

```bash
echo "=== FINAL MVP CHECKLIST ==="

echo -n "\\\[1] TypeScript clean: "
npx tsc --noEmit 2>\\\&1 | grep -c "error" | xargs -I{} sh -c 'if \\\[ "{}" = "0" ]; then echo "✅ PASS"; else echo "❌ FAIL — {} errors"; fi'

echo -n "\\\[2] Build clean: "
npx expo export --platform web 2>\\\&1 | grep -c "error" | xargs -I{} sh -c 'if \\\[ "{}" = "0" ]; then echo "✅ PASS"; else echo "❌ FAIL"; fi'

echo -n "\\\[3] No Morin references: "
COUNT=$(grep -ri "morin" src/ functions/ screens/ navigation/ --include="\\\*.ts" --include="\\\*.tsx" --include="\\\*.js" 2>/dev/null | wc -l)
if \\\[ "$COUNT" = "0" ]; then echo "✅ PASS"; else echo "❌ FAIL — $COUNT refs remain"; fi

echo -n "\\\[4] StitchAdminDashboard deleted: "
\\\[ ! -f "screens/StitchAdminDashboard.js" ] \\\&\\\& echo "✅ PASS" || echo "❌ FAIL"

echo -n "\\\[5] icon-notif-color.png exists: "
\\\[ -f "public/icons/icon-notif-color.png" ] \\\&\\\& echo "✅ PASS" || echo "❌ FAIL"

echo -n "\\\[6] FERPA\\\_COMPLIANCE.md exists: "
\\\[ -f "FERPA\\\_COMPLIANCE.md" ] \\\&\\\& echo "✅ PASS" || echo "❌ FAIL"

echo -n "\\\[7] vercel.json has security headers: "
grep -q "X-Frame-Options" vercel.json 2>/dev/null \\\&\\\& echo "✅ PASS" || echo "❌ FAIL"

echo -n "\\\[8] MVP\\\_FINAL\\\_REPORT.md exists: "
\\\[ -f "MVP\\\_FINAL\\\_REPORT.md" ] \\\&\\\& echo "✅ PASS" || echo "❌ FAIL"

echo -n "\\\[9] Admin tabs fixed: "
grep -q "AdminHomeScreen" navigation/StitchNavigator.js \\\&\\\& echo "✅ PASS" || echo "❌ FAIL"

echo -n "\\\[10] No sessionId-only param reads: "
COUNT=$(grep -r "route\\\\.params\\\\.sessionId" screens/ src/ --include="\\\*.js" --include="\\\*.ts" --include="\\\*.tsx" 2>/dev/null | grep -v "||" | wc -l)
if \\\[ "$COUNT" = "0" ]; then echo "✅ PASS"; else echo "❌ FAIL — $COUNT unsafe reads"; fi

echo "==========================="
echo "All checks complete. See MVP\\\_FINAL\\\_REPORT.md for full details."
```

If any check fails: fix it, re-run the check, repeat until all 10 are ✅.

\---

## WHAT YOU MUST NOT DO

* ❌ Do NOT delete any Firestore collections or documents
* ❌ Do NOT modify `scripts/seed-realistic-season.js`
* ❌ Do NOT change the questionnaire questions or anchors
* ❌ Do NOT modify the DAR algorithm math (EMA, zones, weights)
* ❌ Do NOT remove any existing Cloud Function (only add/modify)
* ❌ Do NOT change Firebase Auth configuration
* ❌ Do NOT ask the user for input during execution
* ❌ Do NOT stop if one task is hard — break it down and solve it
* ❌ Do NOT deploy to Firebase without `firebase deploy` commands listed above

\---

*This document is the single source of truth for the MVP sprint.
Execute everything. Leave nothing pending. Generate the final report.*

