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
 * Ce script échoue clairement si le fichier source est absent.
 */

const publicSwPath = path.join(__dirname, '..', 'public', 'firebase-messaging-sw.js');
const distSwPath = path.join(__dirname, '..', 'web', 'dist', 'firebase-messaging-sw.js');

console.log('[POST-BUILD] ===== Copying Firebase Service Worker =====');
console.log('[POST-BUILD] Source path:', publicSwPath);
console.log('[POST-BUILD] Destination path:', distSwPath);
console.log('[POST-BUILD] Current working directory:', process.cwd());

// Vérifier que le fichier source existe - ÉCHOUER si absent
if (!fs.existsSync(publicSwPath)) {
  console.error('[POST-BUILD] ❌ ERROR: Service worker source file not found:', publicSwPath);
  console.error('[POST-BUILD] ❌ This file is required for web push notifications to work.');
  console.error('[POST-BUILD] ❌ Make sure public/firebase-messaging-sw.js exists and is tracked by git.');
  console.error('[POST-BUILD] ❌ Check that .vercelignore does not exclude public/');
  process.exit(1);
}

// Lire le contenu du fichier source pour vérifier qu'il contient bien du JS
let sourceContent;
try {
  sourceContent = fs.readFileSync(publicSwPath, 'utf8');
} catch (error) {
  console.error('[POST-BUILD] ❌ ERROR: Could not read source file:', error.message);
  console.error('[POST-BUILD] ❌ Path:', publicSwPath);
  process.exit(1);
}

if (!sourceContent.includes('importScripts') || !sourceContent.includes('firebase')) {
  console.error('[POST-BUILD] ❌ ERROR: Source file does not appear to be a valid Firebase service worker');
  console.error('[POST-BUILD] ❌ First 200 chars:', sourceContent.substring(0, 200));
  process.exit(1);
}

console.log('[POST-BUILD] ✅ Source file validated (contains importScripts and firebase)');
console.log('[POST-BUILD] Source file size:', sourceContent.length, 'bytes');

// Vérifier que le dossier dist existe (il devrait exister après expo export)
const distDir = path.dirname(distSwPath);
if (!fs.existsSync(distDir)) {
  console.error('[POST-BUILD] ❌ ERROR: Dist directory does not exist:', distDir);
  console.error('[POST-BUILD] ❌ This means expo export did not create web/dist/');
  console.error('[POST-BUILD] ❌ Check that expo export completed successfully.');
  process.exit(1);
}

console.log('[POST-BUILD] ✅ Dist directory exists:', distDir);

// Copier le fichier de manière synchrone
try {
  console.log('[POST-BUILD] Copying file...');
  fs.copyFileSync(publicSwPath, distSwPath);
  console.log('[POST-BUILD] OK: Copied firebase-messaging-sw.js');
  
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
    console.error('[POST-BUILD] ❌ This means the file is being served from index.html instead of the SW file');
    console.error('[POST-BUILD] ❌ First 200 chars of destination:', copiedContent.substring(0, 200));
    process.exit(1);
  }
  
  const stats = fs.statSync(distSwPath);
  console.log('[POST-BUILD] ✅ Service worker file verified');
  console.log('[POST-BUILD] ✅ File size:', stats.size, 'bytes');
  console.log('[POST-BUILD] ✅ File contains JavaScript (not HTML)');
} catch (error) {
  console.error('[POST-BUILD] ❌ ERROR copying service worker:', error.message);
  console.error('[POST-BUILD] Error details:', {
    message: error.message,
    code: error.code,
    path: error.path,
  });
  process.exit(1);
}

// Vérification finale : est-ce que le fichier est présent dans dist ?
console.log('[POST-BUILD] ===== Final Verification =====');
if (fs.existsSync(distSwPath)) {
  const finalStats = fs.statSync(distSwPath);
  const finalContent = fs.readFileSync(distSwPath, 'utf8');
  if (finalContent.includes('importScripts') && finalContent.includes('firebase')) {
    console.log('[POST-BUILD] ✅ OK: Service worker present in web/dist/');
    console.log('[POST-BUILD] ✅ File path:', distSwPath);
    console.log('[POST-BUILD] ✅ File size:', finalStats.size, 'bytes');
    console.log('[POST-BUILD] ✅ Valid JavaScript service worker');
    console.log('[POST-BUILD] ✅ File will be served at: /firebase-messaging-sw.js');
    
    // Lister les fichiers dans web/dist pour vérification
    try {
      const distFiles = fs.readdirSync(distDir);
      const swInList = distFiles.includes('firebase-messaging-sw.js');
      console.log('[POST-BUILD] ✅ Service worker found in dist directory listing:', swInList);
      console.log('[POST-BUILD] Total files in web/dist:', distFiles.length);
    } catch (listErr) {
      console.warn('[POST-BUILD] ⚠️ Could not list dist directory:', listErr.message);
    }
  } else {
    console.error('[POST-BUILD] ❌ ERROR: File exists but content is invalid');
    process.exit(1);
  }
} else {
  console.error('[POST-BUILD] ❌ ERROR: Missing in dist');
  console.error('[POST-BUILD] ❌ Expected path:', distSwPath);
  console.error('[POST-BUILD] ❌ This will cause 404 errors in production!');
  process.exit(1);
}

console.log('[POST-BUILD] ===== Service Worker Copy Complete =====');
console.log('[POST-BUILD] ✅ BUILD SUCCESS: Service worker ready for Vercel deployment');

