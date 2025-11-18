# Configuration du système de membership

Ce document décrit les modifications apportées pour garantir la création systématique des documents `teams/{teamId}/members/{uid}` lors de l'inscription d'un athlète.

## ✅ Modifications effectuées

### 1. Rules Firestore (`firestore.rules`)

Ajout du bloc `match /members/{uid}` dans `match /teams/{teamId}` pour autoriser :
- **Lecture** : admin, coach de l'équipe, ou membre de l'équipe
- **Création** : par l'utilisateur authentifié lui-même (`request.auth.uid == uid`)
- **Mise à jour** : admin ou l'utilisateur lui-même
- **Suppression** : admin uniquement

### 2. Utilitaire transactionnel (`src/services/membership.ts`)

Fonction `joinTeamAndCreateMembership()` qui effectue dans une transaction atomique :
1. Création/mise à jour de `teams/{teamId}/members/{uid}`
2. Mise à jour de `users/{uid}` (teamId, role, email, displayName)
3. Incrémentation du compteur `teams/{teamId}.members`

### 3. Intégration dans les écrans d'inscription

- `screens/StitchCreateAccountScreen.js` : utilise `joinTeamAndCreateMembership()` après création du compte
- `src/stitch_components/CreateAccountScreenNew.tsx` : utilise `joinTeamAndCreateMembership()` après création du compte

### 4. Cloud Function callable (`functions/index.js`)

Fonction `createMembership` utilisant l'Admin SDK pour créer le membership si la transaction côté client échoue (fallback).

### 5. Script de backfill (`scripts/backfill-members.js`)

Script Node.js pour créer les memberships manquants pour les athlètes existants.

## 🚀 Déploiement

### Déployer les rules Firestore

```bash
firebase deploy --only firestore:rules
```

### Déployer la Cloud Function

```bash
cd functions
npm install
cd ..
firebase deploy --only functions:createMembership
```

### Exécuter le script de backfill

**Prérequis :**
- Node.js installé
- Variable d'environnement `GOOGLE_APPLICATION_CREDENTIALS` pointant vers la clé Admin SDK
- Package `firebase-admin` installé : `npm install firebase-admin`

**Exécution :**

```bash
node scripts/backfill-members.js
```

Le script va :
1. Lire tous les utilisateurs avec `role == "athlete"` et `teamId` défini
2. Vérifier si `teams/{teamId}/members/{uid}` existe
3. Créer le membership manquant si nécessaire
4. Afficher un résumé (créés, ignorés, erreurs)

## 🧪 Tests

### Test d'inscription d'un nouvel athlète

1. Créer une nouvelle équipe (admin)
2. Rejoindre l'équipe avec un nouveau compte athlète (via code)
3. Vérifier dans Firestore :
   - ✅ `users/{uid}` contient `teamId`, `role: 'athlete'`, `email`, `displayName`
   - ✅ `teams/{teamId}/members/{uid}` existe avec `uid`, `name`, `email`, `role: 'athlete'`, `joinedAt`
   - ✅ `teams/{teamId}.members` a été incrémenté
4. Côté athlète : l'écran **Home** et **Schedule** doivent afficher les entraînements

### Test de la Cloud Function (fallback)

Si la transaction côté client échoue, appeler la Cloud Function :

```javascript
import { getFunctions, httpsCallable } from "firebase/functions";

const fn = httpsCallable(getFunctions(), "createMembership");
const result = await fn({
  teamId: "TEAM_ID",
  email: "athlete@example.com",
  name: "John Doe"
});
```

## 📝 Notes

- La transaction garantit la cohérence : si une opération échoue, toutes les opérations sont annulées
- Les rules Firestore autorisent la création du membership par l'utilisateur lui-même, sans dépendre de `users/{uid}.teamId` (évite les races)
- Le script de backfill ne met pas à jour le compteur `teams/{teamId}.members` (à faire manuellement si nécessaire)

## 🔍 Debugging

### Logs à surveiller

- `[CREATE] auth ok` : compte Firebase créé
- `[CREATE] user doc set ok` : document utilisateur créé
- `[membership] created OK` : membership créé via transaction
- `[CREATE] membership error` : erreur lors de la création du membership

### Erreurs courantes

- **"permission-denied"** : vérifier que les rules Firestore sont déployées
- **"Team not found"** : vérifier que le `teamId` est correct
- **Transaction failed** : vérifier les logs pour identifier l'opération qui a échoué


