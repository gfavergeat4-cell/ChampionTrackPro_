const fs = require('fs');
const path = require('path');

/**
 * Script pour copier le service worker Firebase depuis public/ vers web/dist/
 * Ce script est exécuté après le build web pour s'assurer que le service worker
 * est accessible à /firebase-messaging-sw.js sur Vercel
 * 
 * IMPORTANT: Ce fichier doit être présent dans web/dist/ AVANT que Vercel serve l'application,
 * sinon Vercel réécrira la route vers index.html
 */

const publicSwPath = path.join(__dirname, '..', 'public', 'firebase-messaging-sw.js');
const distSwPath = path.join(__dirname, '..', 'web', 'dist', 'firebase-messaging-sw.js');

console.log('[POST-BUILD] ===== Copying Firebase Service Worker =====');
console.log('[POST-BUILD] Source path:', publicSwPath);
console.log('[POST-BUILD] Destination path:', distSwPath);

// Vérifier que le fichier source existe
if (!fs.existsSync(publicSwPath)) {
  console.error('[POST-BUILD] ❌ ERROR: Service worker source file not found:', publicSwPath);
  console.error('[POST-BUILD] Current working directory:', process.cwd());
  console.error('[POST-BUILD] Script directory:', __dirname);
  process.exit(1);
}

// Lire le contenu du fichier source pour vérifier qu'il contient bien du JS
const sourceContent = fs.readFileSync(publicSwPath, 'utf8');
if (!sourceContent.includes('importScripts') || !sourceContent.includes('firebase')) {
  console.error('[POST-BUILD] ❌ ERROR: Source file does not appear to be a valid Firebase service worker');
  console.error('[POST-BUILD] First 200 chars:', sourceContent.substring(0, 200));
  process.exit(1);
}

console.log('[POST-BUILD] ✅ Source file validated (contains importScripts and firebase)');
console.log('[POST-BUILD] Source file size:', sourceContent.length, 'bytes');

// Vérifier que le dossier dist existe (il devrait exister après expo export)
const distDir = path.dirname(distSwPath);
if (!fs.existsSync(distDir)) {
  console.error('[POST-BUILD] ❌ ERROR: Dist directory does not exist:', distDir);
  console.error('[POST-BUILD] This means expo export did not create web/dist/');
  console.error('[POST-BUILD] Current working directory:', process.cwd());
  process.exit(1);
}

console.log('[POST-BUILD] ✅ Dist directory exists:', distDir);

// Copier le fichier de manière synchrone
try {
  console.log('[POST-BUILD] Copying file...');
  fs.copyFileSync(publicSwPath, distSwPath);
  console.log('[POST-BUILD] ✅ File copied successfully');
  
  // Vérifier que le fichier a bien été copié
  if (!fs.existsSync(distSwPath)) {
    console.error('[POST-BUILD] ❌ ERROR: Destination file does not exist after copy');
    process.exit(1);
  }
  
  // Vérifier le contenu du fichier copié
  const copiedContent = fs.readFileSync(distSwPath, 'utf8');
  if (copiedContent !== sourceContent) {
    console.error('[POST-BUILD] ❌ ERROR: Copied file content does not match source');
    process.exit(1);
  }
  
  // Vérifier que le fichier n'est pas du HTML (problème courant sur Vercel)
  if (copiedContent.trim().startsWith('<!DOCTYPE') || copiedContent.includes('<html>')) {
    console.error('[POST-BUILD] ❌ ERROR: Destination file contains HTML instead of JavaScript!');
    console.error('[POST-BUILD] This means the file is being served from index.html instead of the SW file');
    console.error('[POST-BUILD] First 200 chars of destination:', copiedContent.substring(0, 200));
    process.exit(1);
  }
  
  const stats = fs.statSync(distSwPath);
  console.log('[POST-BUILD] ✅ Service worker file verified');
  console.log('[POST-BUILD] ✅ File size:', stats.size, 'bytes');
  console.log('[POST-BUILD] ✅ File contains JavaScript (not HTML)');
  console.log('[POST-BUILD] ===== Service Worker Copy Complete =====');
} catch (error) {
  console.error('[POST-BUILD] ❌ ERROR copying service worker:', error);
  console.error('[POST-BUILD] Error details:', {
    message: error.message,
    code: error.code,
    path: error.path,
  });
  process.exit(1);
}

