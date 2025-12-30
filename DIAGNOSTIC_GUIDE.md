# 🔍 Guide de Diagnostic - Problème d'affichage des événements

## 🚨 **Problème identifié :**
L'écran Schedule affiche "No events on this day" alors que vous avez 3 entraînements dans votre calendrier Google.

## 🔧 **Étapes de diagnostic :**

### **1. Vérifier que le serveur fonctionne**
```bash
# Le serveur devrait être accessible sur :
http://localhost:8108
```

### **2. Ouvrir l'outil de diagnostic**
Ouvrez le fichier `test-schedule-debug.html` dans votre navigateur pour diagnostiquer le problème.

### **3. Tests à effectuer dans l'ordre :**

#### **A. Test de connexion Firebase**
- Cliquez sur "Tester la connexion"
- ✅ **Attendu :** "Connexion Firebase réussie!"

#### **B. Vérifier les teams**
- Cliquez sur "Lister les teams"
- ✅ **Attendu :** Au moins 1 team avec `icsUrl` et `timeZone`

#### **C. Vérifier les événements**
- Cliquez sur "Lister les événements"
- ✅ **Attendu :** Des événements avec `startUTC` en millisecondes

#### **D. Test ICS Import**
- Cliquez sur "Tester l'import ICS"
- ✅ **Attendu :** ICS accessible avec des événements

#### **E. Test de filtrage**
- Cliquez sur "Tester le filtrage"
- ✅ **Attendu :** Des événements Mardi/Jeudi

## 🎯 **Solutions selon le diagnostic :**

### **Si aucun team n'est trouvé :**
1. Aller sur l'Admin Dashboard
2. Créer un team
3. Ajouter l'URL ICS au team

### **Si aucun événement n'est trouvé :**
1. Aller sur l'Admin Dashboard
2. Cliquer sur "📅 Calendrier" pour importer les événements
3. Vérifier que l'import fonctionne

### **Si les événements ne sont pas filtrés correctement :**
1. Vérifier que les événements ont `startUTC` en millisecondes
2. Vérifier que les événements sont des mardis/jeudis
3. Vérifier le timezone

### **Si l'ICS n'est pas accessible :**
1. Vérifier l'URL ICS
2. Vérifier que le calendrier Google est public
3. Tester l'URL dans le navigateur

## 🚀 **Actions correctives :**

### **1. Importer les événements depuis l'Admin Dashboard :**
```javascript
// Dans la console du navigateur (F12)
// Aller sur l'Admin Dashboard et cliquer sur "📅 Calendrier"
```

### **2. Vérifier les événements dans Firestore :**
```javascript
// Dans la console du navigateur (F12)
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const db = getFirestore();

// Remplacer par votre teamId
const teamId = 'your-team-id-here';

const eventsSnap = await getDocs(collection(db, 'teams', teamId, 'events'));
console.log('Events count:', eventsSnap.size);

eventsSnap.docs.forEach(doc => {
  const data = doc.data();
  console.log('Event:', {
    summary: data.summary,
    startUTC: data.startUTC,
    timeZone: data.timeZone
  });
});
```

### **3. Tester le filtrage :**
```javascript
// Dans la console du navigateur (F12)
const tuesdayThursdayEvents = eventsSnap.docs.filter(eventDoc => {
  const eventData = eventDoc.data();
  const eventDate = new Date(eventData.startUTC);
  const dayOfWeek = eventDate.getDay();
  return dayOfWeek === 2 || dayOfWeek === 4; // Mardi ou jeudi
});

console.log('Tuesday/Thursday events:', tuesdayThursdayEvents.length);
```

## 📋 **Checklist de résolution :**

- [ ] Serveur accessible sur `http://localhost:8108`
- [ ] Connexion Firebase fonctionne
- [ ] Au moins 1 team dans Firestore
- [ ] Team a `icsUrl` et `timeZone`
- [ ] Événements importés dans Firestore
- [ ] Événements ont `startUTC` en millisecondes
- [ ] Événements sont des mardis/jeudis
- [ ] Filtrage fonctionne correctement
- [ ] Écran Schedule affiche les événements

## 🎯 **Résultat attendu :**
L'écran Schedule devrait afficher vos 3 entraînements du jeudi avec les heures correctes et les boutons "Respond" fonctionnels.

---

**Une fois ces étapes suivies, vos événements devraient s'afficher correctement dans l'écran Schedule !** 🚀

---

# 🔔 Guide de Diagnostic - Notifications Web FCM en Production (Vercel)

## 🚨 **Problème identifié :**
Le service worker `firebase-messaging-sw.js` apparaît dans DevTools en local (localhost) mais **N'APPARAÎT PAS** en production sur Vercel.

## ✅ **Vérifications de Production (à effectuer après déploiement)**

### **1. Vérifier que le service worker est servi correctement**

Ouvrez dans votre navigateur (remplacez `<domain>` par votre domaine Vercel) :
```
https://<domain>/firebase-messaging-sw.js
```

**✅ Résultat attendu :**
- Le fichier doit retourner du **JavaScript** (pas du HTML)
- Le contenu doit commencer par `/* public/firebase-messaging-sw.js */`
- Le Content-Type doit être `application/javascript` (vérifier dans DevTools > Network)
- **PAS de redirection vers index.html**
- **PAS de 404**

**❌ Si vous voyez du HTML :**
- Le fichier n'est pas copié dans `web/dist/` lors du build
- Vérifier les logs de build Vercel pour `[POST-BUILD]`

**❌ Si vous voyez un 404 :**
- Le fichier n'existe pas dans `web/dist/`
- Vérifier que `scripts/copy-service-worker.js` s'exécute après `expo export`

### **2. Vérifier dans Chrome DevTools > Application > Service Workers**

1. Ouvrez votre site en production : `https://<domain>`
2. Ouvrez DevTools (F12)
3. Allez dans l'onglet **Application**
4. Cliquez sur **Service Workers** dans le menu de gauche

**✅ Résultat attendu :**
- Au moins **1 service worker** enregistré
- **Scope** : `https://<domain>/`
- **État** : "activated and is running" (vert)
- **Source** : `https://<domain>/firebase-messaging-sw.js`

**❌ Si aucun service worker n'apparaît :**
- L'enregistrement n'a pas été exécuté
- Vérifier les logs de la console (voir étape 3)

### **3. Vérifier les logs de la console**

Ouvrez la console (F12 > Console) et recherchez les logs suivants :

**✅ Logs attendus (dans l'ordre) :**
```
[WEB PUSH] ===== Service Worker Registration =====
[WEB PUSH] Environment: PRODUCTION (HTTPS)
[WEB PUSH] Location origin: https://<domain>
[WEB PUSH] Is secure context: true
[WEB PUSH] Protocol: https:
[WEB PUSH] Registering service worker at: /firebase-messaging-sw.js
[WEB PUSH] Notification permission: granted
[WEB PUSH] Existing service worker registrations (before): 0
[WEB PUSH] Calling navigator.serviceWorker.register()...
[WEB PUSH] ✅ Service worker registered successfully
[WEB PUSH] Registration result: { scope: "https://<domain>/", active: true, ... }
[WEB PUSH] Waiting for navigator.serviceWorker.ready...
[WEB PUSH] ✅ Service worker is ready and active
[WEB PUSH] All service worker registrations (after): 1
[WEB PUSH] SW #1: { scope: "https://<domain>/", active: true, ... }
[WEB PUSH] Requesting FCM token...
[WEB PUSH] ✅ FCM token obtained successfully
[WEB PUSH] Token preview: ...
```

**❌ Si vous ne voyez pas ces logs :**
- La fonction `registerWebPushTokenForCurrentUser()` n'est pas appelée
- Vérifier que l'utilisateur est authentifié
- Vérifier que `web/firebaseConfig.web.ts` appelle bien cette fonction

**❌ Si vous voyez des erreurs :**
- Notez le message d'erreur exact
- Vérifier les détails dans `[WEB PUSH] Error details:`

### **4. Vérifier la permission de notification**

Dans la console du navigateur, exécutez :
```javascript
Notification.permission
```

**✅ Résultat attendu :**
- `"granted"` (permission accordée)

**❌ Si le résultat est :**
- `"default"` : La permission n'a pas été demandée
- `"denied"` : L'utilisateur a refusé (réinitialiser dans les paramètres du navigateur)

### **5. Vérifier les service workers enregistrés (commande console)**

Dans la console du navigateur, exécutez :
```javascript
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service workers count:', regs.length);
  regs.forEach((reg, idx) => {
    console.log(`SW #${idx + 1}:`, {
      scope: reg.scope,
      active: !!reg.active,
      activeState: reg.active?.state,
      activeScriptURL: reg.active?.scriptURL
    });
  });
});
```

**✅ Résultat attendu :**
- Au moins 1 enregistrement
- `scope` : `https://<domain>/`
- `active` : `true`
- `activeState` : `"activated"`
- `activeScriptURL` : `https://<domain>/firebase-messaging-sw.js`

### **6. Vérifier le token FCM**

Les logs doivent montrer :
- `[WEB PUSH] ✅ FCM token obtained successfully`
- `[WEB PUSH] Token preview: ...` (20 premiers + 10 derniers caractères)
- `[WEB PUSH] Full token length: ...` (environ 150+ caractères)

**✅ Si le token est obtenu :**
- Le service worker fonctionne correctement
- Les notifications push devraient fonctionner

**❌ Si aucun token n'est obtenu :**
- Vérifier que `EXPO_PUBLIC_FCM_VAPID_KEY` est défini dans les variables d'environnement Vercel
- Vérifier que la clé VAPID correspond au projet Firebase

## 🔧 **Solutions selon le diagnostic :**

### **Si le service worker n'est pas servi (404 ou HTML) :**

1. **Vérifier les logs de build Vercel :**
   - Chercher `[POST-BUILD]`
   - Vérifier que `✅ BUILD SUCCESS: Service worker ready for Vercel deployment` apparaît

2. **Vérifier que le fichier existe dans le build :**
   - Dans les logs Vercel, chercher `[POST-BUILD] ✅ File path:`
   - Le chemin doit être `web/dist/firebase-messaging-sw.js`

3. **Vérifier vercel.json :**
   - La route `/firebase-messaging-sw.js` doit être **AVANT** le catch-all `/(.*)`
   - Les headers doivent inclure `Content-Type: application/javascript`

### **Si le service worker n'est pas enregistré :**

1. **Vérifier que l'utilisateur est authentifié :**
   - La fonction `registerWebPushTokenForCurrentUser()` nécessite un utilisateur connecté
   - Vérifier `auth.currentUser` dans la console

2. **Vérifier que la fonction est appelée :**
   - Dans `web/firebaseConfig.web.ts`, la fonction doit être appelée dans `initAuth()`
   - Vérifier les logs `[WEB PUSH]` dans la console

3. **Vérifier HTTPS :**
   - Les service workers nécessitent HTTPS en production
   - Vérifier `window.location.protocol === 'https:'`

### **Si le token FCM n'est pas obtenu :**

1. **Vérifier la clé VAPID :**
   - Dans Vercel > Settings > Environment Variables
   - Vérifier que `EXPO_PUBLIC_FCM_VAPID_KEY` est défini
   - La clé doit correspondre au projet Firebase

2. **Vérifier que le service worker est actif :**
   - Dans DevTools > Application > Service Workers
   - L'état doit être "activated and is running"

3. **Vérifier la configuration Firebase :**
   - Le `messagingSenderId` doit correspondre
   - Le projet Firebase doit avoir FCM activé

## 📋 **Checklist de résolution :**

- [ ] Service worker accessible à `https://<domain>/firebase-messaging-sw.js` (retourne JS, pas HTML)
- [ ] DevTools > Application > Service Workers montre un SW avec scope `https://<domain>/`
- [ ] Console logs `[WEB PUSH]` montrent `register` + `ready` + `token ok`
- [ ] `Notification.permission === "granted"`
- [ ] `navigator.serviceWorker.getRegistrations()` retourne au moins 1 enregistrement
- [ ] Token FCM obtenu (logs `[WEB PUSH] ✅ FCM token obtained successfully`)
- [ ] Build Vercel montre `[POST-BUILD] ✅ BUILD SUCCESS`

## 🎯 **Résultat attendu :**

Après ces vérifications, vous devriez avoir :
- ✅ Service worker enregistré et actif en production
- ✅ Token FCM obtenu et sauvegardé dans Firestore
- ✅ Notifications push fonctionnelles en production

**Une fois ces étapes suivies, les notifications web FCM devraient fonctionner en production !** 🚀












