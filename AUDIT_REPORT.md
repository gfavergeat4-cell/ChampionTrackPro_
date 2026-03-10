# AUDIT REPORT — ChampionTrackPro V2
# Generated: Phase 1 — Security & Technical Debt Audit
# Date: 2026-03-10

---

## ✅ WHAT IS CORRECT

### firestore.rules
- Athlete write (create/update) scoped to own `responseId == request.auth.uid` — correct
- Questionnaire time window enforced at rules level (30min after endUtc, 5h window) — correct
- `isTestSession: true` trainings always open for write — correct
- Admin-only delete on critical documents — correct
- `signedIn()` and `userExists()` guard functions defined — correct
- `createMembership` Cloud Function uses admin SDK to bypass rules — acceptable pattern

### functions/index.js
- `sendTestNotification` — auth check present (`context.auth`) — correct
- Invalid FCM token cleanup on send failure — correct
- `sendQuestionnaireReminders` — checks response exists before sending — correct
- `importTeamCalendarFromUrl` HTTP function — verifies Bearer token — correct

### PerformanceDashboard.tsx
- `selectedTeamId` initialized from route params or resolved from user doc — correct
- Athlete filter (`m.role !== "coach"`) applied to members list — correct
- `isTestSession` excluded from coach home (confirmed in StitchHomeScreen)

---

## 🔴 CRITICAL VULNERABILITIES

### VULN-01 — IDOR: Unauthenticated read on /teams/{teamId}
**File:** `firestore.rules`
**Line:** 93
**Severity:** CRITICAL
**Code:**
```
allow read: if request.auth == null ||
               isAdmin() ||
               isCoach() ||
               isTeamMember(teamId);
```
**Problem:** `request.auth == null` allows ANY unauthenticated internet user to read entire team documents, including `icsUrl` (private calendar URL), `members` count, and team metadata.
**Impact:** Team enumeration, calendar URL exfiltration, competitor intelligence.
**Fix:** Remove `request.auth == null`. If access code validation needs unauthenticated read, scope it to a specific field or use a Cloud Function.

---

### VULN-02 — Cross-team IDOR: Coach reads all responses across all teams
**File:** `firestore.rules`
**Lines:** 85–87
**Severity:** CRITICAL
**Code:**
```javascript
match /{path=**}/responses/{responseId} {
  allow read: if isAdmin() || isCoach();
}
```
**Problem:** This wildcard rule allows any authenticated `role: "coach"` to read ALL responses across ALL teams. A coach at Team A can query `collectionGroup("responses")` and read athlete data from Team B, Team C, etc.
**PRD requirement:** "Coach : lit toutes les réponses de son équipe uniquement"
**Impact:** Mass PII exposure across teams. HIPAA/GDPR risk.
**Fix:** Replace with `isCoachOfTeam(teamId)` check. Requires the teamId to be extractable from the path. Proposed fix in DECISIONS.md.

---

### VULN-03 — Role escalation: User can self-assign coach/admin role
**File:** `firestore.rules`
**Lines:** 73–76
**Severity:** CRITICAL
**Code:**
```javascript
allow update: if signedIn() && (
  isAdmin() ||
  uid == request.auth.uid
);
```
**Problem:** Any authenticated user can update their own `users/{uid}` document without field restrictions. An athlete can set `role: "coach"` or `role: "admin"` to gain full dashboard access.
**Comment in code says this is "protégé côté serveur" — but there is NO Cloud Function enforcing this. The protection does not exist.**
**Impact:** Privilege escalation. Any athlete becomes a coach with one Firestore write.
**Fix:** Add field-level protection in rules: deny changes to `role` and `teamId` fields for self-updates.

---

## 🟡 MEDIUM VULNERABILITIES

### VULN-04 — PerformanceDashboard: collectionGroup not enforcing team scope server-side
**File:** `src/screens/PerformanceDashboard.tsx`
**Lines:** 384–391
**Severity:** MEDIUM
**Code:**
```typescript
const cg = collectionGroup(db, "responses");
// ... where("teamId", "==", selectedTeamId)
```
**Problem:** The `teamId` filter is a client-side query param. Since VULN-02 allows any coach to read all responses, a malicious client can remove the `where("teamId")` filter and exfiltrate all athlete responses from all teams.
**Fix:** Fix VULN-02 first (server-side enforcement). Query then becomes inherently scoped.

---

### VULN-05 — Cloud Functions: No team authorization on ICS sync/import
**File:** `functions/index.js`
**Lines:** 228–242 (syncIcsNow), 492–503 (importTeamCalendarFromUrlCallable)
**Severity:** MEDIUM
**Problem:** Both functions only check `context.auth != null`. Any authenticated user (including athletes) can:
- Trigger an ICS sync for any teamId
- Import/overwrite any team's calendar from a malicious URL
**Fix:** Verify caller is coach or admin of the specified teamId before proceeding.

---

## 🔵 TECHNICAL DEBT

### DEBT-01 — V1 metric field names (French) vs V2 spec (English)
**File:** `src/screens/PerformanceDashboard.tsx`
**Lines:** 61–80 (RawResponse interface), 461–548 (data processing)
**Problem:** Current schema uses V1 French fields: `intensiteMoyenne`, `hautesIntensites`, `impactCardiaque`, `impactMusculaire`, `fatigue`, `concentration`, `confiance`, `bienEtre`, `nervosite`, `sommeil`.
V2 spec requires: `metrics.cardioLoad`, `metrics.neuroLoad`, `metrics.sleepQuality`, `metrics.stressLevel`, `metrics.motorControl`, `metrics.tacticalLucidity`, `metrics.sessionRPE`, `readinessScore`, `workloadAU`.
**Plan:** Dashboard must support both schemas during transition (V1 data persists in Firestore). Add field mapping layer.

### DEBT-02 — isTest responses not excluded from dashboard
**File:** `src/screens/PerformanceDashboard.tsx`
**Line:** 384–391
**Problem:** No `where("isTest", "!=", true)` filter in the collectionGroup query. Test responses (from `isTestSession` trainings) pollute analytics.
**Fix:** Add `where("isTest", "==", false)` or filter client-side after load.

### DEBT-03 — pendingQuestionnaireReminders: no TTL/cleanup
**File:** `functions/index.js`
**Lines:** 808–820
**Problem:** Completed/skipped reminder documents accumulate indefinitely. No cleanup mechanism.
**Fix:** Add a weekly Cloud Function to delete records older than 30 days with status != "pending", or use Firestore TTL policy.

### DEBT-04 — sendQuestionnaireAvailableNotifications: N+1 query pattern
**File:** `functions/index.js`
**Lines:** 659–682
**Problem:** For each team → each training → each member → fetch user doc = O(teams × trainings × members) reads per cron. At scale this is expensive and slow.
**Fix:** Batch user doc fetches or denormalize FCM tokens into the members subcollection.

### DEBT-05 — No `sessionType` field on trainings
**Problem:** V2 questionnaire is conditional on `sessionType` ("conditioning" | "skill" | "scrimmage"). Current training documents created by ICS sync have no `sessionType` field.
**Fix:** Default to "conditioning" when sessionType is absent (conservative), log decision in DECISIONS.md.

### DEBT-06 — No `readinessScore` or V2 metrics in existing responses
**Problem:** 90 days of test data in Firestore uses V1 schema. Dashboard Phase 4 must handle missing V2 fields gracefully.
**Fix:** Null-safe accessors with V1 fallback mapping for all metric reads.

---

## 📋 REMEDIATION PLAN (PRIORITIZED)

| Priority | ID | Action | Phase |
|----------|-----|--------|-------|
| 🔴 P0 | VULN-03 | Add role/teamId field protection in firestore.rules | Phase 2 |
| 🔴 P0 | VULN-02 | Fix wildcard collectionGroup rule → team-scoped | Phase 2 |
| 🔴 P0 | VULN-01 | Remove unauthenticated team read | Phase 2 |
| 🟡 P1 | VULN-05 | Add team auth check in ICS Cloud Functions | Phase 2 |
| 🟡 P1 | DEBT-02 | Exclude isTest responses from dashboard | Phase 4 |
| 🟡 P1 | DEBT-01 | V1/V2 field mapping in dashboard | Phase 4 |
| 🔵 P2 | DEBT-03 | Add reminder cleanup function | Phase 5 |
| 🔵 P2 | DEBT-04 | Batch user doc fetches in CRON | Phase 5 |
| 🔵 P2 | DEBT-05 | Default sessionType on missing field | Phase 3 |
| 🔵 P2 | DEBT-06 | Null-safe V1 fallback in analytics | Phase 4 |

---

## SUMMARY

- **3 critical vulnerabilities** requiring immediate fix before any V2 launch
- **2 medium vulnerabilities** in Cloud Functions
- **6 technical debts** to address in Phases 2–5
- **No `allow read: if true`** found (good)
- **Wildcard collectionGroup rule** is the highest-risk item for PII exposure
