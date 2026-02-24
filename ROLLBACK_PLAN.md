# 🔄 Plan de Rollback vers b503c52 - ChampionTrackPro

## 📋 Résumé Exécutif

**Objectif**: Revenir au commit `b503c52` (version stable déployée sur Vercel) et supprimer toutes les modifications expérimentales liées aux FCM/service worker qui ont cassé le build.

**Commit cible**: `b503c52a9dfa9ddaf351f0e5e6091d7ee42878d6`  
**Date**: Sat Jan 3 11:55:42 2026 +0100  
**Message**: "fix: make FCM service worker SW-safe (classic importScripts + compat libs without window)"

---

## 🔍 Analyse des Commits Après b503c52

### Commits identifiés (à supprimer/annuler):

1. **8a6b79e** - "release: prof clean version (audit + docs + safe cleanup)"
   - Fichiers modifiés:
     - `PROJECT_AUDIT_REPORT.md` (ajouté)
     - `README.md` (modifié)
     - `public/firebase-messaging-sw.js` (modifié)
     - `scripts/copy-service-worker.js` (modifié)
     - `scripts/verify-build.js` (modifié)
     - `src/services/webNotifications.ts` (modifié)

2. **50fc4aa** - "Fix: Accept classic and ES module service workers in build scripts"
   - Fichiers modifiés:
     - `scripts/copy-service-worker.js` (modifié)
     - `scripts/verify-build.js` (modifié)

---

## 📁 Fichiers Expérimentaux à Supprimer/Restaurer

### Fichiers à RESTAURER depuis b503c52:

1. **`scripts/copy-service-worker.js`**
   - État actuel: Accepte classic ET ES modules (expérimental)
   - État cible: Version de b503c52 (classic uniquement avec compat)

2. **`scripts/verify-build.js`**
   - État actuel: Validation stricte pour classic SW uniquement
   - État cible: Version de b503c52

3. **`public/firebase-messaging-sw.js`**
   - État actuel: Utilise compat libs
   - État cible: Version de b503c52 (même approche, mais vérifier)

4. **`src/services/webNotifications.ts`**
   - État actuel: Modifications expérimentales
   - État cible: Version de b503c52

### Fichiers à SUPPRIMER (ajoutés après b503c52):

1. **`PROJECT_AUDIT_REPORT.md`** (ajouté dans 8a6b79e)
   - Fichier d'audit pour projet universitaire
   - **Action**: Supprimer

### Fichiers Firebase à VÉRIFIER:

Les fichiers suivants existent dans `public/firebase/`:
- `firebase-app.js` (ajouté dans b503c52)
- `firebase-messaging-sw.js` (ajouté dans b503c52)
- `firebase-app-compat.js` (présent)
- `firebase-messaging-compat.js` (présent)

**Note**: b503c52 utilise `firebase-app.js` et `firebase-messaging-sw.js` (ESM), mais le SW principal utilise `importScripts()` avec compat. Vérifier la cohérence.

---

## ✅ Vérification de b503c52

### Fichiers modifiés dans b503c52:
- `public/firebase-messaging-sw.js` (modifié)
- `public/firebase/firebase-app.js` (ajouté)
- `public/firebase/firebase-messaging-sw.js` (ajouté)
- `scripts/copy-service-worker.js` (modifié)
- `scripts/verify-build.js` (modifié)

**Conclusion**: b503c52 contient déjà des modifications FCM, mais c'est la dernière version "stable" avant les expérimentations.

---

## 🎯 Plan d'Action

### Étape 1: Sauvegarder l'état actuel
```powershell
# Créer une branche de sauvegarde
git checkout -b backup-before-rollback-$(Get-Date -Format "yyyyMMdd-HHmmss")
git push origin HEAD
git checkout prod
```

### Étape 2: Restaurer les fichiers depuis b503c52
```powershell
# Restaurer les fichiers modifiés
git checkout b503c52 -- scripts/copy-service-worker.js
git checkout b503c52 -- scripts/verify-build.js
git checkout b503c52 -- public/firebase-messaging-sw.js
git checkout b503c52 -- src/services/webNotifications.ts
```

### Étape 3: Supprimer les fichiers expérimentaux
```powershell
# Supprimer PROJECT_AUDIT_REPORT.md (si présent)
git rm PROJECT_AUDIT_REPORT.md
```

### Étape 4: Vérifier les fichiers Firebase
```powershell
# Vérifier que les fichiers Firebase sont cohérents avec b503c52
git checkout b503c52 -- public/firebase/firebase-app.js
git checkout b503c52 -- public/firebase/firebase-messaging-sw.js
```

### Étape 5: Commit et push
```powershell
git add -A
git commit -m "rollback: restore stable FCM setup from b503c52, remove experimental changes"
git push origin prod
```

### Étape 6: Vérifier le build Vercel
- Attendre le déploiement Vercel
- Vérifier que le build passe
- Tester que `/firebase-messaging-sw.js` est accessible

---

## 🔮 Plan pour Réintroduire FCM (APRÈS Rollback)

### Approche Minimale et Stable:

1. **Garder l'approche classic SW** (importScripts + compat)
   - ✅ Fonctionne dans tous les navigateurs
   - ✅ Pas de problème de type="module"
   - ✅ Compatible avec Vercel

2. **Améliorations progressives**:
   - Phase 1: Vérifier que le SW s'enregistre en prod
   - Phase 2: Ajouter des logs de diagnostic
   - Phase 3: Tester l'envoi de notifications
   - Phase 4: Optimiser si nécessaire

3. **Ne PAS réintroduire**:
   - ❌ Validation stricte ES modules vs classic
   - ❌ Scripts de vérification trop agressifs
   - ❌ Modifications expérimentales dans webNotifications.ts

---

## ⚠️ Fichiers Critiques à NE PAS TOUCHER

Ces fichiers sont essentiels au build Vercel et ne doivent PAS être modifiés:

- ✅ `package.json` (scripts web:build)
- ✅ `vercel.json` (configuration Vercel)
- ✅ `app.json` / `app.config.js` (configuration Expo)
- ✅ `index.js` / `index.web.js` (points d'entrée)
- ✅ Tous les fichiers dans `src/` (sauf webNotifications.ts)
- ✅ `functions/` (Cloud Functions)

---

## 📝 Checklist Post-Rollback

- [ ] Build Vercel passe sans erreur
- [ ] `/firebase-messaging-sw.js` retourne du JavaScript (pas HTML)
- [ ] Service worker s'enregistre en production (DevTools > Application > Service Workers)
- [ ] Pas d'erreurs dans la console navigateur
- [ ] Application se charge correctement
- [ ] Login/authentification fonctionne
- [ ] Schedule/événements se chargent

---

## 🚨 En Cas de Problème

Si le rollback ne fonctionne pas:

1. **Vérifier les logs Vercel**:
   - Aller sur Vercel Dashboard > Dernier déploiement > Build Logs
   - Chercher les erreurs `[POST-BUILD]` ou `[VERIFY]`

2. **Vérifier localement**:
   ```powershell
   npm run web:build
   ```
   - Si ça échoue, corriger les scripts avant de push

3. **Rollback complet si nécessaire**:
   ```powershell
   git reset --hard b503c52
   git push origin prod --force
   ```
   ⚠️ **ATTENTION**: Force push uniquement si absolument nécessaire

---

## 📊 Résumé des Modifications

| Fichier | Action | Raison |
|---------|--------|--------|
| `scripts/copy-service-worker.js` | Restaurer depuis b503c52 | Supprimer validations expérimentales |
| `scripts/verify-build.js` | Restaurer depuis b503c52 | Supprimer validations expérimentales |
| `public/firebase-messaging-sw.js` | Restaurer depuis b503c52 | Retour à version stable |
| `src/services/webNotifications.ts` | Restaurer depuis b503c52 | Retour à version stable |
| `PROJECT_AUDIT_REPORT.md` | Supprimer | Fichier expérimental universitaire |

---

**Date de création**: 2026-01-05  
**Auteur**: Auto-generated rollback plan  
**Status**: ⏳ En attente d'exécution

