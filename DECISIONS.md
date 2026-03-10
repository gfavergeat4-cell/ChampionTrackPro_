# DECISIONS.md — ChampionTrackPro V2
# Ambiguous decisions logged here per PRD instructions
# Updated: 2026-03-10

---

## DEC-01 — Wildcard collectionGroup rule: approach for team-scoped coach access
**Context:** VULN-02 — current wildcard rule `allow read: if isCoach()` gives any coach access to all teams.
**Problem:** Firestore wildcard match `/{path=**}/responses/{responseId}` cannot extract `teamId` from the path (it's nested under `/teams/{teamId}/trainings/{trainingId}/responses/{responseId}`). The path variable is not addressable in rules at the wildcard level.
**Decision (conservative):** Keep the wildcard rule for collectionGroup queries but add a data-level check using the `teamId` field stored in each response document:
```javascript
match /{path=**}/responses/{responseId} {
  allow read: if isAdmin() ||
              (isCoach() && resource.data.teamId != null &&
               exists(/databases/$(database)/documents/teams/$(resource.data.teamId)/members/$(request.auth.uid)));
}
```
This relies on `teamId` being stored in the response document (which it is — see RawResponse interface line 63).
**Tradeoff:** Each read triggers an `exists()` call — Firestore bills this as an additional read. Acceptable at current scale.

---

## DEC-02 — Role field protection: block self-update of role/teamId
**Context:** VULN-03 — users can self-assign coach/admin role.
**Decision (conservative):** Add explicit field restriction to the update rule:
```javascript
allow update: if signedIn() && (
  isAdmin() ||
  (uid == request.auth.uid &&
   !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'teamId']))
);
```
This blocks changes to `role` and `teamId` while allowing athletes to update `fcmWebTokens`, `displayName`, `photoURL`, etc.

---

## DEC-03 — sessionType default for trainings without the field
**Context:** DEBT-05 — ICS-imported trainings have no `sessionType` field. V2 questionnaire is conditional on it.
**Decision (conservative):** Default to `"conditioning"` when `sessionType` is absent or null.
Rationale: "conditioning" shows the smallest question set (5 questions), minimizing athlete burden for sessions where type is unknown. Coaches can always edit the training to set the correct type.

---

## DEC-04 — V1/V2 metric field coexistence in dashboard
**Context:** DEBT-01 — 90 days of existing data uses V1 French field names. V2 spec introduces new field names under `metrics.*`.
**Decision (conservative):** The dashboard will use a field-mapping function that:
1. Checks for V2 `metrics.*` fields first
2. Falls back to V1 field names if V2 fields are absent
3. Returns `null` for missing values (not 0, to avoid polluting averages)
This preserves historical data visualization while supporting new V2 responses.

---

## DEC-05 — unauthenticated team read: scope of fix
**Context:** VULN-01 — `allow read: if request.auth == null` on teams collection.
**Comment in code says:** "Les codes sont publics par design (partagés avec les athlètes)"
**Investigation:** The join flow uses a team code (not teamId) stored in the team document. Athletes need to look up a team by code without being authenticated yet.
**Decision (conservative):** Remove unauthenticated read entirely. Move team code lookup to a Cloud Function (`lookupTeamByCode`) that:
- Takes a code, returns only `{teamId, teamName}` (not the full document)
- Rate-limited at 10 requests/minute per IP via Firebase App Check or rate limiting
However, to avoid breaking the current join flow in V2 Phase 2, the conservative minimal fix is:
- Change to `allow read: if signedIn()` (requires auth, but not membership)
- Athletes registering can sign in anonymously first, then upgrade
- Document this in DECISIONS.md for later refactor
**Immediate action for Phase 2:** Change to `allow read: if signedIn()`. Log for future Cloud Function refactor.

---

## DEC-06 — ICS Cloud Function authorization: scope check
**Context:** VULN-05 — syncIcsNow and importTeamCalendarFromUrlCallable don't verify team membership.
**Decision (conservative):** Add check: caller must be `role: "coach"` OR `role: "admin"` AND be a member of the specified team (or admin = any team). Use Admin SDK to read user role from Firestore.

---

## DEC-07 — Physical Soreness → Physical Fatigue rename
**Context:** PRD specifies replacing "Physical Soreness" with "Physical Fatigue" for legal compliance (HIPAA).
**Decision:** Apply rename in questionnaire and Friction Matrix. No database migration needed — `frictionType` is a string field. Old values with "Physical Soreness" (if any exist) will display as-is but new submissions will use "Physical Fatigue".

---

## DEC-08 — ai_training_dataset collection: not creating in client rules
**Context:** PRD Phase 5 specifies Cloud Function to populate `ai_training_dataset`.
**Decision:** The Firestore rules will add `allow read, write: if false` for this collection. It will only be written by Cloud Functions using Admin SDK (bypasses rules). Client will never have direct access.

---

## DEC-09 — lookupTeamByCode rate limit: in-memory vs Firestore
**Context:** Rate limiting the `lookupTeamByCode` CF requires a counter per caller. Options: Firestore counter, Redis, or in-memory Map.
**Decision:** Use in-memory `_rateLimitMap` on the CF instance. Rationale: function is low-traffic (account creation only), cold starts reset the counter harmlessly, and adding a Firestore read for rate limiting would add latency/cost to an already-read-heavy path. Upgrade to Firestore-backed counter if abuse is observed in production logs.
**Tradeoff:** Anonymous callers (pre-auth) all share the `"anonymous"` key — a single unauthenticated device can exhaust the limit for all other unauthenticated users on the same CF instance. Acceptable at current scale.

---

## DEC-10 — Legacy unused screens with direct team queries: leave in place
**Context:** `screens/JoinTeam.js:21` and `src/stitch_components/CreateAccountScreenNew.tsx:60` still contain `getDocs(query(teamsRef, where(...)))` calls against the teams collection. After DEC-05 rule tightening, these would fail at runtime with PERMISSION_DENIED if called.
**Decision:** Leave as-is (not migrated, not deleted). Neither file is imported in `StitchNavigator.js` or any active screen. Deleting risks surprises if referenced from outside the navigator. A follow-up task should either delete or add a deprecation comment. Logged here to prevent confusion during future security audits.

---

## DEC-11 — isTest client-side guard kept alongside server-side filter
**Context:** After adding `where("isTest", "==", false)` to the dashboard collectionGroup query, the client-side `if (data.isTest) return` guard at `PerformanceDashboard.tsx:488` is technically redundant.
**Decision:** Keep the client-side guard. V1 responses predating the `isTest` field have `isTest: undefined`. Firestore's `== false` filter excludes documents where the field equals `false` but the behavior for missing fields is to exclude those documents too — however, the guard costs nothing and prevents any unexpected legacy data from appearing if query behavior changes. Defense-in-depth.

---

## DEC-12 — Position filter propagation: responses vs. dropdown-only
**Context:** TASK 2 — original implementation filtered the player dropdown by position but `filteredResponses` ignored the position filter when no specific players were selected, so charts showed data for all team members even with a position active.
**Decision:** Update `filteredResponses` to respect position filter independently: when `selectedPositions.length > 0` and `selectedPlayerIds.length === 0`, filter responses to UIDs of `membersFilteredByPosition`. This makes position + player filters composable without duplicating logic.
**Tradeoff:** If a coach selects a position to pre-filter the dropdown, then selects a specific player, the specific player selection takes priority (explicit beats implicit).

---

## DEC-13 — AthleteDetailScreen: standalone vs. PerformanceDashboard wrapper
**Context:** Existing `AthleteDetailScreen.tsx` wrapped `PerformanceDashboard` with `athleteId` as route param. This showed the full team-level dashboard UI (duration controls, view toggles) instead of a focused individual view.
**Decision:** Full standalone implementation with dedicated collectionGroup data-fetching and purpose-built charts (gauge, EMA trendline, radar, session table). PerformanceDashboard dependency removed.
**Tradeoff:** Code duplication of EMA/metric utilities. Future refactor should extract to `src/utils/analytics.ts`.
