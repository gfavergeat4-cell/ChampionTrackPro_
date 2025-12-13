const fs = require('fs');
const path = require('path');

/**
 * Script pour copier le service worker Firebase depuis public/ vers web/dist/
 * Ce script est exécuté après le build web pour s'assurer que le service worker
 * est accessible à /firebase-messaging-sw.js sur Vercel
 * 
 * IMPORTANT: Ce fichier doit être présent dans web/dist/ AVANT que Vercel serve l'application,
 * sinon Vercel réécrira la route vers index.html
 * 
 * Ce script est robuste : il ne casse pas le build si le fichier source est absent.
 */

const publicSwPath = path.join(__dirname, '..', 'public', 'firebase-messaging-sw.js');
const distSwPath = path.join(__dirname, '..', 'web', 'dist', 'firebase-messaging-sw.js');

console.log('[POST-BUILD] ===== Copying Firebase Service Worker =====');
console.log('[POST-BUILD] Source path:', publicSwPath);
console.log('[POST-BUILD] Destination path:', distSwPath);
console.log('[POST-BUILD] Current working directory:', process.cwd());

// Vérifier que le fichier source existe
if (!fs.existsSync(publicSwPath)) {
  console.warn('[POST-BUILD] ⚠️  WARNING: Service worker source file not found:', publicSwPath);
  console.warn('[POST-BUILD] ⚠️  The build will continue, but web push notifications may not work.');
  console.warn('[POST-BUILD] ⚠️  Make sure public/firebase-messaging-sw.js exists and is tracked by git.');
  
  // Vérification finale : est-ce que le fichier existe déjà dans dist ?
  if (fs.existsSync(distSwPath)) {
    console.log('[POST-BUILD] ℹ️  Service worker already exists in dist, skipping copy.');
  } else {
    console.warn('[POST-BUILD] ⚠️  Service worker missing in dist. Web push will not work.');
  }
  
  // Ne pas casser le build, juste avertir
  console.log('[POST-BUILD] ===== Service Worker Copy Skipped (file not found) =====');
  process.exit(0);
}

// Lire le contenu du fichier source pour vérifier qu'il contient bien du JS
let sourceContent;
try {
  sourceContent = fs.readFileSync(publicSwPath, 'utf8');
} catch (error) {
  console.warn('[POST-BUILD] ⚠️  WARNING: Could not read source file:', error.message);
  console.warn('[POST-BUILD] ⚠️  The build will continue, but web push notifications may not work.');
  process.exit(0);
}

if (!sourceContent.includes('importScripts') || !sourceContent.includes('firebase')) {
  console.warn('[POST-BUILD] ⚠️  WARNING: Source file does not appear to be a valid Firebase service worker');
  console.warn('[POST-BUILD] ⚠️  First 200 chars:', sourceContent.substring(0, 200));
  console.warn('[POST-BUILD] ⚠️  The build will continue, but web push notifications may not work.');
  process.exit(0);
}

console.log('[POST-BUILD] ✅ Source file validated (contains importScripts and firebase)');
console.log('[POST-BUILD] Source file size:', sourceContent.length, 'bytes');

// Vérifier que le dossier dist existe (il devrait exister après expo export)
const distDir = path.dirname(distSwPath);
if (!fs.existsSync(distDir)) {
  console.warn('[POST-BUILD] ⚠️  WARNING: Dist directory does not exist:', distDir);
  console.warn('[POST-BUILD] ⚠️  This means expo export did not create web/dist/');
  console.warn('[POST-BUILD] ⚠️  The build will continue, but web push notifications may not work.');
  process.exit(0);
}

console.log('[POST-BUILD] ✅ Dist directory exists:', distDir);

// Copier le fichier de manière synchrone
try {
  console.log('[POST-BUILD] Copying file...');
  fs.copyFileSync(publicSwPath, distSwPath);
  console.log('[POST-BUILD] ✅ Copied firebase-messaging-sw.js');
  
  // Vérifier que le fichier a bien été copié
  if (!fs.existsSync(distSwPath)) {
    console.warn('[POST-BUILD] ⚠️  WARNING: Destination file does not exist after copy');
    console.warn('[POST-BUILD] ⚠️  The build will continue, but web push notifications may not work.');
    process.exit(0);
  }
  
  // Vérifier le contenu du fichier copié
  const copiedContent = fs.readFileSync(distSwPath, 'utf8');
  if (copiedContent !== sourceContent) {
    console.warn('[POST-BUILD] ⚠️  WARNING: Copied file content does not match source');
    console.warn('[POST-BUILD] ⚠️  The build will continue, but web push notifications may not work.');
    process.exit(0);
  }
  
  // Vérifier que le fichier n'est pas du HTML (problème courant sur Vercel)
  if (copiedContent.trim().startsWith('<!DOCTYPE') || copiedContent.includes('<html>')) {
    console.warn('[POST-BUILD] ⚠️  WARNING: Destination file contains HTML instead of JavaScript!');
    console.warn('[POST-BUILD] ⚠️  This means the file is being served from index.html instead of the SW file');
    console.warn('[POST-BUILD] ⚠️  First 200 chars of destination:', copiedContent.substring(0, 200));
    console.warn('[POST-BUILD] ⚠️  The build will continue, but web push notifications may not work.');
    process.exit(0);
  }
  
  const stats = fs.statSync(distSwPath);
  console.log('[POST-BUILD] ✅ Service worker file verified');
  console.log('[POST-BUILD] ✅ File size:', stats.size, 'bytes');
  console.log('[POST-BUILD] ✅ File contains JavaScript (not HTML)');
} catch (error) {
  console.warn('[POST-BUILD] ⚠️  WARNING: Error copying service worker:', error.message);
  console.warn('[POST-BUILD] ⚠️  The build will continue, but web push notifications may not work.');
  console.warn('[POST-BUILD] Error details:', {
    message: error.message,
    code: error.code,
    path: error.path,
  });
  process.exit(0);
}

// Vérification finale : est-ce que le fichier est présent dans dist ?
console.log('[POST-BUILD] ===== Final Verification =====');
if (fs.existsSync(distSwPath)) {
  const finalStats = fs.statSync(distSwPath);
  const finalContent = fs.readFileSync(distSwPath, 'utf8');
  if (finalContent.includes('importScripts') && finalContent.includes('firebase')) {
    console.log('[POST-BUILD] ✅ Present in dist');
    console.log('[POST-BUILD] ✅ File size:', finalStats.size, 'bytes');
    console.log('[POST-BUILD] ✅ Valid JavaScript service worker');
  } else {
    console.warn('[POST-BUILD] ⚠️  Missing in dist (file exists but content invalid)');
  }
} else {
  console.warn('[POST-BUILD] ⚠️  Missing in dist');
}

console.log('[POST-BUILD] ===== Service Worker Copy Complete =====');

