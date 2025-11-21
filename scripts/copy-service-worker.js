const fs = require('fs');
const path = require('path');

/**
 * Script pour copier le service worker Firebase depuis public/ vers web/dist/
 * Ce script est exécuté après le build web pour s'assurer que le service worker
 * est accessible à /firebase-messaging-sw.js sur Vercel
 */

const publicSwPath = path.join(__dirname, '..', 'public', 'firebase-messaging-sw.js');
const distSwPath = path.join(__dirname, '..', 'web', 'dist', 'firebase-messaging-sw.js');

console.log('[POST-BUILD] Copying service worker...');
console.log('[POST-BUILD] Source:', publicSwPath);
console.log('[POST-BUILD] Destination:', distSwPath);

// Vérifier que le fichier source existe
if (!fs.existsSync(publicSwPath)) {
  console.error('[POST-BUILD] ERROR: Service worker source file not found:', publicSwPath);
  process.exit(1);
}

// Créer le dossier dist s'il n'existe pas
const distDir = path.dirname(distSwPath);
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  console.log('[POST-BUILD] Created dist directory:', distDir);
}

// Copier le fichier
try {
  fs.copyFileSync(publicSwPath, distSwPath);
  console.log('[POST-BUILD] ✅ Service worker copied successfully to:', distSwPath);
  
  // Vérifier que le fichier a bien été copié
  if (fs.existsSync(distSwPath)) {
    const stats = fs.statSync(distSwPath);
    console.log('[POST-BUILD] ✅ Service worker file size:', stats.size, 'bytes');
  } else {
    console.error('[POST-BUILD] ERROR: Service worker was not copied');
    process.exit(1);
  }
} catch (error) {
  console.error('[POST-BUILD] ERROR copying service worker:', error);
  process.exit(1);
}

