# PROGRESS REPORT 7 — Coach Role Reset Bug
**Date:** 2026-03-11
**Status:** ✅ Fixed and deployed (commit `4d7f9dd`)

---

## Symptôme observé

Console du navigateur lors du login de `coachtest@gmail.com` :
```
Raw role from Firestore: athlete   ← PREMIER read — mauvais
Role confirmed via onSnapshot: coach  ← SECOND read — correct
```

Conséquence : le navigator chargeait les onglets Athlete au lieu des onglets Coach pendant un bref instant, puis corrigeait après le onSnapshot. Dans certains cas, les Firestore Security Rules refusaient l'accès car `myRole()` lisait "athlete" depuis le cache local.

---

## Investigation

### STEP 1 — Valeur réelle dans Firestore (serveur)

Exécution de `scripts/fix-coach-role.js` via REST API Firestore :
```
Current user doc:
  teamId: Ri8kpStgWp9yymtS71tb
  role: coach

>>> Current role: coach
✅ Role is already 'coach' — no change needed.
```

**Conclusion : le serveur Firestore a bien `role: "coach"`. Le problème est côté client, pas côté données.**

---

### STEP 2 — Recherche de toutes les écritures `role: "athlete"` dans le codebase

Grep sur `**/*.{js,ts,tsx}` pour `role.*athlete` et `setDoc.*users` :

#### Fichiers actifs écrits dans le login flow

| Fichier | Ce qu'il écrit sur `users/{uid}` | Touche `role` ? |
|---|---|---|
| `navigation/StitchNavigator.js` — loginCount | `loginCount: increment(1)` | ❌ Non |
| `src/screens/OnboardingNotifScreen.tsx` | `onboardingComplete: true` | ❌ Non |
| `src/services/fcmService.js` | `fcmWebTokens`, `fcmToken`, `fcmTokenUpdatedAt` | ❌ Non |
| **`src/services/membership.ts`** | `teamId, role: "athlete", email, displayName` | **⚠️ OUI — COUPABLE** |

#### Fichiers sans impact (ignorés)
- `App.DISABLED.js` — fichier désactivé
- `backup-*/` — anciennes versions archivées
- `scripts/seedBasketballTeam.js`, `scripts/backfill-members.js` — scripts one-shot
- `screens/SignUp.js`, `screens/Register.js` — uniquement à la création de compte

---

### STEP 3 — Identification du coupable

**Fichier : `src/services/membership.ts` — fonction `createMembershipClientOnly()`**

```typescript
// AVANT (code bugué)
async function createMembershipClientOnly({ teamId, uid, email, name }) {

  // 1) Crée le doc members/{uid} — OK
  await setDoc(memberRef, {
    uid, name, email,
    role: "athlete",      // ← accepté ici (metadata membre)
    joinedAt: serverTimestamp(),
  }, { merge: true });

  // 2) Met à jour users/{uid} — BUG ICI
  await setDoc(userRef, {
    teamId,
    role: "athlete",      // ← ÉCRASE le role même pour un coach !
    email,
    displayName,
    updatedAt: serverTimestamp(),
  }, { merge: true });   // merge:true ne protège pas un champ explicitement écrit
}
```

**Pourquoi `merge: true` ne suffit pas ?**
`{ merge: true }` empêche la suppression des champs non mentionnés, mais **écrase toujours les champs explicitement présents dans le payload**. Passer `role: "athlete"` avec `merge: true` remplace quand même la valeur existante "coach" par "athlete".

**Où cette fonction était-elle appelée ?**
- `screens/StitchCreateAccountScreen.js:96` — après création de compte (problème : elle s'exécute APRÈS que le bon `role` a été écrit, l'écrasant)
- `src/lib/resolveAthleteTeam.ts:49` — auto-repair du membership si absent (déclenché sur les écrans athlètes)

---

### STEP 4 — Cause secondaire : cache IndexedDB stale

Même après correction serveur (via `fix-coach-role.js`), le navigateur lisait "athlete" au premier `getDoc()` car :

1. À un moment passé, `createMembershipClientOnly` a été appelée pour le coach → `role: "athlete"` écrit en local (IndexedDB Firestore offline persistence)
2. `fix-coach-role.js` a corrigé le serveur via REST API → serveur = "coach"
3. Le cache IndexedDB local gardait encore "athlete"
4. `getDoc()` lit le cache en priorité → retourne "athlete"
5. `onSnapshot()` force une lecture serveur → retourne "coach"

**Schéma de la race condition :**
```
Login
  └─ getDoc() ──→ cache IndexedDB ──→ "athlete" ← log "Raw role: athlete"
  └─ onSnapshot() ─→ serveur Firestore ─→ "coach" ← log "Role confirmed: coach"
```

---

## Solutions appliquées

### Fix 1 — `src/services/membership.ts` : supprimer `role` du write sur `users/{uid}`

```typescript
// AVANT
await setDoc(userRef, {
  teamId,
  role: "athlete",   // ← supprimé
  email: email ?? "",
  displayName: displayName,
  updatedAt: serverTimestamp(),
}, { merge: true });

// APRÈS
// NOTE: role is intentionally NOT written here — the authoritative role is set by admins
// and must never be overwritten by membership creation (would break coach accounts).
await setDoc(userRef, {
  teamId,
  email: email ?? "",
  displayName: displayName,
  updatedAt: serverTimestamp(),
}, { merge: true });
```

**Règle établie :** `users/{uid}.role` est uniquement écrit à la création de compte (`StitchCreateAccountScreen`) ou par un admin. Jamais par la logique de membership.

---

### Fix 2 — `navigation/StitchNavigator.js` : `getDoc` → `getDocFromServer`

```javascript
// AVANT
import { doc, getDoc, setDoc, ... } from "firebase/firestore";
// ...
const userDoc = await getDoc(doc(db, "users", u.uid));
// ↑ lit depuis le cache IndexedDB — peut retourner une valeur obsolète

// APRÈS
import { doc, getDoc, getDocFromServer, setDoc, ... } from "firebase/firestore";
// ...
const userDoc = await getDocFromServer(doc(db, "users", u.uid));
// ↑ bypasse totalement le cache, lit directement depuis le serveur Firestore
```

`getDocFromServer` garantit que le premier read sur `onAuthStateChanged` renvoie toujours la valeur réelle du serveur, indépendamment de ce qui est stocké dans l'IndexedDB local.

---

## Résultat attendu après déploiement

Console après fix :
```
Raw role from Firestore: coach   ← premier read, serveur direct
Role confirmed via onSnapshot: coach  ← idem
```

- Plus de flip athlete→coach au chargement
- Dashboard coach charge immédiatement avec les bons droits
- Zéro "Missing or insufficient permissions" lié au rôle

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/services/membership.ts` | Suppression de `role: "athlete"` du write sur `users/{uid}` |
| `navigation/StitchNavigator.js` | `getDoc` → `getDocFromServer` sur auth state change |

**Commit :** `4d7f9dd` — `fix: prevent role overwrite on login — coach role stays coach`
**Push :** `main` → Vercel rebuild déclenché automatiquement
