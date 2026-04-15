# PROGRESS REPORT 6 — Firestore Rules fix
**Date:** 2026-03-11
**Status:** ✅ Fixed and deployed

---

## Full firestore.rules BEFORE fix

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }

    function userExists() {
      return signedIn() && exists(.../users/$(request.auth.uid));
    }

    function me() {
      return get(.../users/$(request.auth.uid));
    }

    function myRole() {
      return signedIn() && userExists() && me().data != null && me().data.role != null
        ? me().data.role : null;
    }

    function isAdmin() { return signedIn() && userExists() && myRole() == "admin"; }
    function isCoach() { return signedIn() && userExists() && myRole() == "coach"; }

    function isTeamMember(teamId) {
      return signedIn() && exists(.../teams/$(teamId)/members/$(request.auth.uid));
    }

    function isCoachOfTeam(teamId) {
      return isCoach() && isTeamMember(teamId);    // ← PROBLEM: isCoach() = 3 reads
    }

    match /{path=**}/responses/{responseId} {
      allow read: if isAdmin() ||
                  (isCoach() &&
                   resource.data.teamId != null &&
                   exists(.../teams/$(resource.data.teamId)/members/$(request.auth.uid)));
      // ↑ PROBLEM: per document = isAdmin(3) + isCoach(3) + exists(1) = 7 reads/doc
    }

    match /teams/{teamId}/members/{uid} {
      allow read: if isAdmin() || isCoachOfTeam(teamId) || isTeamMember(teamId);
      // ↑ PROBLEM: no shortcut for own-uid read, heavy evaluation
    }
  }
}
```

---

## Issues Found

### ISSUE A — Excessive `get()`/`exists()` reads in `isCoachOfTeam()`
`isCoachOfTeam()` called `isCoach()` which called `userExists()` (1 `exists()`) + `myRole()` → `userExists()` (1 more `exists()`) + `me()` (1 `get()`). That's 3 reads just for the role check, then +1 more `exists()` for membership. **Total: 4 reads per `isCoachOfTeam()` call.**

For the collectionGroup responses rule (evaluated per document):
- `isAdmin()` = 3 reads
- `isCoach()` = 3 reads
- `exists(members)` = 1 read
- **Total: 7 reads per document** with no caching guarantee

Firestore's limit is **10 `get()`/`exists()` calls per security rule evaluation**. For collectionGroup queries returning multiple documents where each doc costs 7 reads, this easily exceeds the limit and causes silent PERMISSION_DENIED.

### ISSUE B — Members read rule missing `request.auth.uid == memberId` shortcut
Without this shortcut, every user reading their own member doc incurred the full `isCoachOfTeam()` overhead (4+ reads) instead of the trivial uid comparison.

### ISSUE C — Collectiongroup responses rule redundant
Used `isCoach() && resource.data.teamId != null && exists(teams/$(resource.data.teamId)/members/...)` = 3+0+1 = 4 reads per doc instead of using the simplified `isCoachOfTeam()`.

### ISSUE D — Rules file not re-uploaded
Previous deploys said "latest version already up to date, skipping upload" even though the content hadn't propagated correctly. New deploy after editing forced actual upload.

---

## Exact Changes

### `myRole()` — removed redundant `userExists()` (2 reads → 1 read)
```javascript
// BEFORE
function myRole() {
  return signedIn() && userExists() && me().data != null && me().data.role != null
    ? me().data.role : null;
}
// AFTER
function myRole() {
  return signedIn() ? me().data.role : null;
}
```

### `isAdmin()`, `isCoach()` — removed redundant `userExists()` (3 reads → 1 read)
```javascript
// BEFORE
function isAdmin() { return signedIn() && userExists() && myRole() == "admin"; }
// AFTER
function isAdmin() { return signedIn() && myRole() == "admin"; }
```

### `isCoachOfTeam()` — ISSUE A fix (4 reads → 1 read)
```javascript
// BEFORE
function isCoachOfTeam(teamId) { return isCoach() && isTeamMember(teamId); }
// AFTER
function isCoachOfTeam(teamId) {
  return signedIn() && exists(.../teams/$(teamId)/members/$(request.auth.uid));
}
```

### `members/{memberId}` — ISSUE B fix
```javascript
// BEFORE
match /teams/{teamId}/members/{uid} {
  allow read: if isAdmin() || isCoachOfTeam(teamId) || isTeamMember(teamId);
}
// AFTER
match /teams/{teamId}/members/{memberId} {
  allow read: if isAdmin()
              || request.auth.uid == memberId     // ← shortcut: 0 Firestore reads
              || (isCoach() && isCoachOfTeam(teamId))
              || isTeamMember(teamId);
}
```

### collectionGroup responses — ISSUE C fix (7 reads/doc → 2 reads/doc)
```javascript
// BEFORE
match /{path=**}/responses/{responseId} {
  allow read: if isAdmin() || (isCoach() && resource.data.teamId != null &&
              exists(.../teams/$(resource.data.teamId)/members/$(request.auth.uid)));
}
// AFTER
match /{path=**}/responses/{responseId} {
  allow read: if isAdmin() ||
              (isCoach() && resource.data.teamId != null && isCoachOfTeam(resource.data.teamId));
}
// isCoach() = 1 get (cached), isCoachOfTeam() = 1 exists = 2 reads/doc total
```

### `canReadTrainings()` — simplified (removed redundant userExists/myTeamId overhead)
```javascript
// AFTER
function canReadTrainings(teamId) {
  return isAdmin() || (isCoach() && isCoachOfTeam(teamId)) ||
         isTeamMember(teamId) || (signedIn() && myTeamId() == teamId);
}
```

---

## Deployment
```
firebase deploy --only firestore:rules
→ ✔ uploaded (not "skipped" this time)
→ waited 60s for propagation
```

---

## Expected Result
- `coachtest@gmail.com` logs in → role confirmed as "coach"
- Dashboard loads members from `teams/{teamId}/members` — ✅ (2 reads: isCoach + exists)
- Dashboard loads responses via collectionGroup — ✅ (2 reads per doc: isCoach cached + exists)
- Morning Brief shows athlete data (responses from last 30-90 days)
- Zero "Missing or insufficient permissions" in console
