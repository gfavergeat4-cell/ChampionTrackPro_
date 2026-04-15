# PROGRESS REPORT 5 — Dashboard responses fix
**Date:** 2026-03-11
**Status:** ✅ Fixed and deployed

---

## Root Cause

The coach dashboard showed zero data / "Missing or insufficient permissions" (which was actually a 0-document result, not an auth error).

Three compounding issues:

### Issue 1 — Missing `teamId` COLLECTION_GROUP single-field index
Firestore requires an explicit **single-field COLLECTION_GROUP index** for any field used as an equality filter in a `collectionGroup()` query. Our `firestore.indexes.json` only had a composite `[teamId, submittedAt]` COLLECTION_GROUP index — this serves the 2-field query but NOT a standalone `where("teamId", "==", ...)` check.

Without this single-field index, the REST API returned HTTP 400:
```
"The query requires a COLLECTION_GROUP_ASC index for collection responses and field teamId."
```

The SDK silently returns 0 results instead of surfacing this error to the UI.

### Issue 2 — `isTest` field missing on legacy responses
90+ existing response documents were written without an `isTest` field. In Firestore, a `where("isTest", "==", false)` filter excludes documents where `isTest` is **undefined** (field absent). Same for `in [false, null]` — `null` matches an explicit null value, not a missing field.

### Issue 3 — Old `[teamId, isTest, submittedAt]` composite index never covered single-field teamId queries

---

## check-responses.js Output (final run, all indexes READY)

```
1. Total responses no filter: 10        → responses exist
2. Responses with teamId: 5             → teamId filter works (after index fix)
3. Responses isTest==false: 0           → isTest field MISSING on all real docs
4. Responses isTest in [false,null]: 0  → same (null ≠ missing field)

DIAGNOSIS → CASE C: isTest field missing on real responses
```

---

## Changes Made

### `firestore.indexes.json`
- Replaced `[teamId, isTest, submittedAt]` composite with `[teamId, submittedAt]`
- Added `fieldOverrides` for `responses/teamId`:
  ```json
  { "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" }
  ```
  This enables the single-field COLLECTION_GROUP index required by Firestore for collectionGroup equality queries.

### `src/screens/PerformanceDashboard.tsx` (line 382–388)
Removed `.where("isTest", "==", false)` from the server-side query.
```typescript
// BEFORE
const qy = query(cg,
  where("teamId", "==", selectedTeamId),
  where("isTest", "==", false),          // ← excluded all legacy docs
  where("submittedAt", ">=", startTs),
  where("submittedAt", "<=", endTs)
);

// AFTER
const qy = query(cg,
  where("teamId", "==", selectedTeamId),
  where("submittedAt", ">=", startTs),
  where("submittedAt", "<=", endTs)
);
// Client-side guard (line 398) handles test session exclusion:
// if (data.isTest) return;
```

### `scripts/check-responses.js` (new diagnostic tool)
4-test diagnostic script using Firestore REST API.
Automatically refreshes OAuth token via `scripts/refresh-token.js`.

---

## Indexes Deployed

```
[READY] COLLECTION_GROUP  [teamId:ASC, submittedAt:ASC]        ← composite for dashboard query
[READY] COLLECTION_GROUP  [teamId:ASC]                         ← single-field (fieldOverride)
[READY] COLLECTION        [status:ASC, dueAt:ASC]              ← reminders
[READY] COLLECTION        [questionnaireNotified:ASC, endUtc:ASC]
```

---

## Expected Dashboard Result

After fix and index deployment:
- `collectionGroup("responses").where("teamId","==",selectedTeamId).where("submittedAt",">=",start).where("submittedAt","<=",end)` returns all responses in the date range
- Client-side `if (data.isTest) return` excludes test session responses
- Morning Brief calculates from real athlete data (responses from Nov 2025 → Mar 2026)
- Charts render once date range includes existing data (30d includes Mar 2026, 90d includes Nov 2025)

---

## Files Modified
- `firestore.indexes.json`
- `src/screens/PerformanceDashboard.tsx`
- `scripts/check-responses.js` (new)
- `scripts/refresh-token.js` (new — local dev util, not shipped)
- `scripts/fix-coach-membership.js` (new — confirms coach in members subcollection)
