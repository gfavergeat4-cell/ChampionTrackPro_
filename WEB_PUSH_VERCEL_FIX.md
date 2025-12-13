# 🔧 Fix Web Push Service Worker sur Vercel

## 🔍 Problème identifié

Sur Vercel, `/firebase-messaging-sw.js` retourne le HTML de `index.html` au lieu du JavaScript du service worker. Cela signifie que :
- Le fichier n'est pas présent dans `web/dist/` après le build, OU
- Vercel applique le rewrite général `/(.*)` → `/index.html` avant de servir le fichier statique

## ✅ Configuration actuelle

### 1. Service Worker Source
- **Fichier** : `public/firebase-messaging-sw.js`
- **Contenu** : ✅ JavaScript avec `importScripts`, `onBackgroundMessage`, etc.
- **Status** : ✅ Correct

### 2. Script de copie
- **Fichier** : `scripts/copy-service-worker.js`
- **Méthode** : ✅ `fs.copyFileSync()` (synchrone)
- **Source** : ✅ `public/firebase-messaging-sw.js`
- **Destination** : ✅ `web/dist/firebase-messaging-sw.js`
- **Validations** : ✅ Vérifie que le fichier contient du JS (pas du HTML)

### 3. Build Script
- **Fichier** : `package.json`
- **Script** : ✅ `"web:build": "expo export --platform web --output-dir web/dist && node scripts/copy-service-worker.js"`
- **Ordre** : ✅ Export Expo d'abord, puis copie du service worker

### 4. Configuration Vercel
- **Fichier** : `vercel.json`
- **Output Directory** : ✅ `web/dist`
- **Headers** : ✅ Configurés pour `/firebase-messaging-sw.js`
- **Rewrites** : ⚠️ `/(.*)` → `/index.html` (peut capturer le SW si le fichier n'existe pas)

## 🔧 Solution

Sur Vercel, les fichiers statiques dans `outputDirectory` sont servis automatiquement **AVANT** les rewrites, mais seulement s'ils existent vraiment dans le dossier.

Le script de copie doit garantir que le fichier est bien présent dans `web/dist/firebase-messaging-sw.js` après le build.

### Vérifications ajoutées dans le script de copie

Le script `scripts/copy-service-worker.js` vérifie maintenant :
1. ✅ Le fichier source existe
2. ✅ Le fichier source contient du JavaScript (pas du HTML)
3. ✅ Le dossier `web/dist/` existe après l'export Expo
4. ✅ Le fichier est bien copié
5. ✅ Le fichier copié contient du JavaScript (pas du HTML)
6. ✅ Le fichier copié correspond exactement au fichier source

### Structure attendue après build

```
web/dist/
  ├── index.html
  ├── firebase-messaging-sw.js  ← DOIT ÊTRE PRÉSENT
  └── _expo/
      └── ...
```

## 📋 Checklist de déploiement

### Avant de pousser sur GitHub → Vercel

1. ✅ Vérifier que `public/firebase-messaging-sw.js` existe et contient du JavaScript
2. ✅ Vérifier que `scripts/copy-service-worker.js` existe et utilise `fs.copyFileSync()`
3. ✅ Vérifier que `package.json` a le script `web:build` correct
4. ✅ Vérifier que `vercel.json` est correct

### Après le déploiement sur Vercel

1. ✅ Vérifier les logs de build Vercel :
   - Chercher `[POST-BUILD] ✅ Service worker copied successfully`
   - Chercher `[POST-BUILD] ✅ File contains JavaScript (not HTML)`

2. ✅ Vérifier que le fichier est accessible :
   - Ouvrir `https://champion-track-pro.vercel.app/firebase-messaging-sw.js` dans le navigateur
   - Le contenu doit commencer par `/* public/firebase-messaging-sw.js */` ou `importScripts(...)`
   - **NE DOIT PAS** contenir `<!DOCTYPE html>` ou `<title>ChampionTrackPRO</title>`

3. ✅ Vérifier dans DevTools :
   - Application → Service Workers
   - Devrait voir `firebase-messaging-sw.js` enregistré et actif
   - `navigator.serviceWorker.getRegistrations()` doit retourner le SW

## 🚨 Si le problème persiste

Si après le déploiement, `/firebase-messaging-sw.js` retourne toujours du HTML :

1. **Vérifier les logs de build Vercel** :
   - Chercher les messages `[POST-BUILD]`
   - Vérifier si le script de copie s'est exécuté
   - Vérifier si le fichier a été copié avec succès

2. **Vérifier manuellement le fichier dans le build** :
   - Télécharger les artefacts de build depuis Vercel
   - Vérifier que `web/dist/firebase-messaging-sw.js` existe
   - Vérifier que le contenu est du JavaScript (pas du HTML)

3. **Si le fichier n'existe pas dans le build** :
   - Le script de copie ne s'exécute peut-être pas
   - Vérifier que `package.json` a bien le script `web:build` avec `&& node scripts/copy-service-worker.js`
   - Vérifier que le script a les permissions d'exécution

4. **Si le fichier existe mais retourne du HTML** :
   - Vercel applique le rewrite avant de servir le fichier statique
   - Cela signifie que Vercel ne trouve pas le fichier dans `web/dist/`
   - Vérifier que le fichier est bien à `web/dist/firebase-messaging-sw.js` (pas dans un sous-dossier)

## ✅ Fichiers vérifiés

1. ✅ `public/firebase-messaging-sw.js` - Existe et correct
2. ✅ `scripts/copy-service-worker.js` - Existe et utilise `fs.copyFileSync()`
3. ✅ `package.json` - Script `web:build` correct
4. ✅ `vercel.json` - Headers et rewrites configurés

## 🎯 Résultat attendu

Après le déploiement :
- `https://champion-track-pro.vercel.app/firebase-messaging-sw.js` doit retourner du JavaScript
- Le service worker doit être enregistré dans DevTools
- Les notifications push doivent fonctionner


