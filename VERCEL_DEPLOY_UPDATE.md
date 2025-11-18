# 🚀 Mise à jour Vercel - Nouvelle Interface

## ✅ Modifications effectuées

### 1. Configuration Vercel (`vercel.json`)
- ✅ Ajout des headers pour le service worker Firebase
- ✅ Configuration du Content-Type pour `firebase-messaging-sw.js`
- ✅ Ajout du header `Service-Worker-Allowed` pour permettre le service worker à la racine

### 2. Structure de l'application
- ✅ L'application utilise déjà `StitchNavigator` qui charge les nouveaux composants
- ✅ `AthleteHome` utilise `AthleteHomeNew` (nouvelle interface)
- ✅ `ScheduleScreenNewScreen` utilise `ScheduleScreenNew` (nouvelle interface)
- ✅ `ProfileScreen` utilise la nouvelle interface centrée

### 3. Service Worker
- ✅ Le fichier `public/firebase-messaging-sw.js` sera automatiquement copié dans le build
- ✅ Expo copie automatiquement les fichiers du dossier `public/` dans `web/dist/`
- ✅ Le service worker sera accessible à `https://votre-domaine.com/firebase-messaging-sw.js`

## 📋 Vérifications avant déploiement

### 1. Build local (optionnel mais recommandé)
```bash
npm run web:build
```

Vérifiez que :
- Le dossier `web/dist/` est créé
- Le fichier `web/dist/firebase-messaging-sw.js` existe
- Le fichier `web/dist/index.html` existe

### 2. Test local du build
```bash
# Installer serve si nécessaire
npm install -g serve

# Tester le build
serve web/dist -p 5000
```

Ouvrez `http://localhost:5000` et vérifiez :
- ✅ L'application se charge correctement
- ✅ La navigation fonctionne
- ✅ Les nouveaux composants s'affichent (interface centrée)
- ✅ Le service worker est accessible : `http://localhost:5000/firebase-messaging-sw.js`

### 3. Variables d'environnement Vercel

Assurez-vous que les variables suivantes sont configurées dans Vercel :
- `EXPO_PUBLIC_FCM_VAPID_KEY` (pour les notifications push)
- `EXPO_PUBLIC_FIREBASE_API_KEY` (optionnel, valeurs par défaut dans le code)
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` (optionnel)
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID` (optionnel)

## 🚀 Déploiement

### Option 1 : Déploiement automatique (recommandé)
1. Commitez et poussez les changements :
```bash
git add .
git commit -m "feat: update Vercel config for new interface and service worker"
git push origin main
```

2. Vercel détectera automatiquement le push et lancera un nouveau build

### Option 2 : Déploiement manuel
```bash
vercel --prod
```

## ✅ Après le déploiement

1. Vérifiez que l'application se charge : `https://votre-domaine.vercel.app`
2. Vérifiez le service worker : `https://votre-domaine.vercel.app/firebase-messaging-sw.js`
3. Testez la navigation entre les onglets (Home, Schedule, Profile)
4. Vérifiez que l'interface est bien centrée (nouvelle interface)
5. Testez les notifications push (si configuré)

## 🐛 Dépannage

### Le service worker n'est pas accessible
- Vérifiez que le fichier `public/firebase-messaging-sw.js` existe
- Vérifiez que le build a bien copié le fichier dans `web/dist/`
- Vérifiez les headers dans `vercel.json`

### L'interface n'est pas la nouvelle
- Vérifiez que `StitchNavigator` utilise bien les nouveaux composants
- Vérifiez que `AthleteHome` importe `AthleteHomeNew`
- Vérifiez que `ScheduleScreenNewScreen` importe `ScheduleScreenNew`

### Erreurs de build
- Vérifiez que toutes les dépendances sont installées : `npm install`
- Vérifiez les logs de build dans Vercel
- Testez le build localement : `npm run web:build`

## 📝 Notes

- Les fichiers dans `public/` sont automatiquement copiés par Expo lors du build
- Le service worker Firebase est automatiquement enregistré par `getMessaging()`
- La nouvelle interface est déjà intégrée dans `StitchNavigator`
- Les notifications push nécessitent la clé VAPID dans les variables d'environnement

