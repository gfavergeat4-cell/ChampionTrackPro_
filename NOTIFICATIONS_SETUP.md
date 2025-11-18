# 🔔 Configuration des Notifications Push Web

Ce document explique comment configurer le système de notifications push web pour ChampionTrackPro.

## 📋 Prérequis

1. **Clé VAPID Firebase** : Vous devez générer une clé VAPID dans la console Firebase
2. **Service Worker** : Le fichier `public/firebase-messaging-sw.js` doit être accessible
3. **Cloud Functions** : Les fonctions doivent être déployées

## 🔧 Configuration

### 1. Générer la clé VAPID

1. Allez dans la [Console Firebase](https://console.firebase.google.com/)
2. Sélectionnez votre projet `championtrackpro`
3. Allez dans **Paramètres du projet** → **Cloud Messaging**
4. Dans la section **Web Push certificates**, cliquez sur **Generate key pair**
5. Copiez la clé publique générée

### 2. Configurer la variable d'environnement

Ajoutez la clé VAPID dans vos variables d'environnement :

**Pour Vercel :**
```bash
vercel env add EXPO_PUBLIC_FCM_VAPID_KEY
# Collez la clé VAPID quand demandé
```

**Pour le développement local :**
Créez un fichier `.env.local` :
```
EXPO_PUBLIC_FCM_VAPID_KEY=votre_cle_vapid_ici
```

### 3. Vérifier le service worker

Le fichier `public/firebase-messaging-sw.js` doit être accessible à l'URL :
```
https://votre-domaine.com/firebase-messaging-sw.js
```

Vérifiez que Vercel sert bien les fichiers du dossier `public/`.

### 4. Déployer les Cloud Functions

```bash
cd functions
npm install
firebase deploy --only functions
```

La fonction `sendQuestionnaireAvailableNotifications` s'exécutera automatiquement toutes les 5 minutes.

## 🎯 Fonctionnement

### Enregistrement des tokens

Quand un utilisateur se connecte :
1. Le navigateur demande la permission de notification
2. Un token FCM est généré
3. Le token est enregistré dans `users/{uid}/fcmWebTokens` (array)

### Envoi des notifications

La Cloud Function `sendQuestionnaireAvailableNotifications` :
1. S'exécute toutes les 5 minutes
2. Cherche les trainings terminés dans les 30 dernières minutes
3. Vérifie que `questionnaireNotified === false`
4. Envoie une notification à tous les athlètes de l'équipe
5. Marque le training comme notifié

### Deep-link

Quand l'utilisateur clique sur une notification :
- L'URL `/?sessionId={trainingId}&openQuestionnaire=1` est ouverte
- Le navigateur détecte les paramètres et ouvre automatiquement l'écran Questionnaire

## 📝 Structure Firestore

### Document utilisateur
```javascript
users/{uid}
{
  fcmWebTokens: ["token1", "token2", ...],
  // ... autres champs
}
```

### Document training
```javascript
teams/{teamId}/trainings/{trainingId}
{
  endUtc: Timestamp,
  questionnaireNotified: boolean,
  questionnaireNotifiedAt: Timestamp,
  // ... autres champs
}
```

## 🐛 Dépannage

### Les notifications ne s'affichent pas

1. Vérifiez que la permission est accordée dans le navigateur
2. Vérifiez la console pour les erreurs FCM
3. Vérifiez que le service worker est bien chargé : `navigator.serviceWorker.getRegistrations()`

### Les tokens ne sont pas enregistrés

1. Vérifiez que `EXPO_PUBLIC_FCM_VAPID_KEY` est bien défini
2. Vérifiez les logs de la console pour les erreurs
3. Vérifiez que l'utilisateur est bien authentifié

### La Cloud Function ne s'exécute pas

1. Vérifiez les logs Firebase Functions
2. Vérifiez que la fonction est bien déployée : `firebase functions:list`
3. Vérifiez que le scheduler est activé dans Firebase Console

## 📚 Ressources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Notifications Guide](https://web.dev/push-notifications-overview/)

