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
  } else {
    console.error('[VERIFY] ❌ ERROR: Missing file:', filePath);
    allPresent = false;
  }
}

if (!allPresent) {
  console.error('[VERIFY] ❌ BUILD VERIFICATION FAILED');
  console.error('[VERIFY] ❌ Some required files are missing or invalid');
  process.exit(1);
}

console.log('[VERIFY] ✅ All required files present and valid');
console.log('[VERIFY] ===== Build Verification Complete =====');

