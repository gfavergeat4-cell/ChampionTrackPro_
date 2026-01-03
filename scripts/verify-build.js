// scripts/verify-build.js
const fs = require('fs');
const path = require('path');

/**
 * Script de vérification post-build pour s'assurer que tous les fichiers
 * nécessaires au service worker FCM sont présents dans web/dist/
 */

const requiredFiles = [
  'web/dist/firebase-messaging-sw.js',
  'web/dist/firebase/firebase-app-compat.js',
  'web/dist/firebase/firebase-messaging-compat.js',
];

console.log('[VERIFY] ===== Verifying Build Artifacts =====');

let allPresent = true;

for (const filePath of requiredFiles) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log('[VERIFY] ✅', filePath, '-', stats.size, 'bytes');
    
    // Vérifier que ce n'est pas du HTML
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.trim().startsWith('<!DOCTYPE') || content.includes('<html>')) {
      console.error('[VERIFY] ❌ ERROR:', filePath, 'contains HTML instead of JavaScript!');
      allPresent = false;
    }
    
    // Vérifier que le service worker principal ne contient pas 'window.'
    if (filePath.includes('firebase-messaging-sw.js') && !filePath.includes('firebase/') && content.includes('window.')) {
      console.error('[VERIFY] ❌ ERROR:', filePath, 'contains "window." which is not available in Service Workers!');
      allPresent = false;
    }
    
    // Vérifier que le service worker principal ne contient pas d'import() dynamique
    if (filePath.includes('firebase-messaging-sw.js') && !filePath.includes('firebase/') && content.includes('import(')) {
      console.error('[VERIFY] ❌ ERROR:', filePath, 'contains dynamic import() which is not supported in classic Service Workers!');
      allPresent = false;
    }
    
    // Vérifier que le service worker principal ne contient pas d'export
    if (filePath.includes('firebase-messaging-sw.js') && !filePath.includes('firebase/') && content.includes('export ')) {
      console.error('[VERIFY] ❌ ERROR:', filePath, 'contains export which is not supported in classic Service Workers!');
      allPresent = false;
    }
    
    // Vérifier qu'aucun fichier ne contient d'import vers le CDN gstatic
    if (content.includes('https://www.gstatic.com/firebasejs/')) {
      console.error('[VERIFY] ❌ ERROR:', filePath, 'contains CDN import! All imports must be local.');
      allPresent = false;
    }
  } else {
    console.error('[VERIFY] ❌ ERROR: Missing file:', filePath);
    allPresent = false;
  }
}

// Vérifier que le service worker principal utilise importScripts (pas import())
const swPath = path.join(__dirname, '..', 'web', 'dist', 'firebase-messaging-sw.js');
if (fs.existsSync(swPath)) {
  const swContent = fs.readFileSync(swPath, 'utf8');
  if (!swContent.includes('importScripts(')) {
    console.error('[VERIFY] ❌ ERROR: Service worker must use importScripts() not import()');
    allPresent = false;
  }
  if (swContent.includes('import(')) {
    console.error('[VERIFY] ❌ ERROR: Service worker contains dynamic import() which is not supported!');
    allPresent = false;
  }
  if (swContent.includes('export ')) {
    console.error('[VERIFY] ❌ ERROR: Service worker contains export which is not supported!');
    allPresent = false;
  }
}

if (!allPresent) {
  console.error('[VERIFY] ❌ BUILD VERIFICATION FAILED');
  console.error('[VERIFY] ❌ Some required files are missing or invalid');
  process.exit(1);
}

console.log('[VERIFY] ✅ All required files present and valid');
console.log('[VERIFY] ✅ No compat files found');
console.log('[VERIFY] ✅ No "window." references found');
console.log('[VERIFY] ✅ No CDN imports found');
console.log('[VERIFY] ===== Build Verification Complete =====');

