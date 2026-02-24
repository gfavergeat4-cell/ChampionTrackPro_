# Script de rollback vers b503c52
# Usage: .\rollback-to-b503c52.ps1

Write-Host "🔄 ROLLBACK VERS b503c52" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Vérifier qu'on est sur la branche prod
$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne "prod") {
    Write-Host "⚠️  ATTENTION: Vous n'êtes pas sur la branche 'prod'" -ForegroundColor Yellow
    Write-Host "   Branche actuelle: $currentBranch" -ForegroundColor Yellow
    $confirm = Read-Host "Continuer quand même? (o/N)"
    if ($confirm -ne "o" -and $confirm -ne "O") {
        Write-Host "❌ Rollback annulé" -ForegroundColor Red
        exit 1
    }
}

# Vérifier que b503c52 existe
$commitExists = git rev-parse --verify b503c52 2>$null
if (-not $commitExists) {
    Write-Host "❌ ERREUR: Le commit b503c52 n'existe pas!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Commit b503c52 trouvé: $commitExists" -ForegroundColor Green
Write-Host ""

# Créer une branche de sauvegarde
$backupBranch = "backup-before-rollback-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Host "📦 Création d'une branche de sauvegarde: $backupBranch" -ForegroundColor Yellow
git checkout -b $backupBranch
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR: Impossible de créer la branche de sauvegarde" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Branche de sauvegarde créée" -ForegroundColor Green
Write-Host ""

# Revenir sur prod
Write-Host "🔄 Retour sur la branche prod..." -ForegroundColor Yellow
git checkout prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR: Impossible de revenir sur prod" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Sur la branche prod" -ForegroundColor Green
Write-Host ""

# Restaurer les fichiers depuis b503c52
Write-Host "📥 Restauration des fichiers depuis b503c52..." -ForegroundColor Yellow
Write-Host ""

$filesToRestore = @(
    "scripts/copy-service-worker.js",
    "scripts/verify-build.js",
    "public/firebase-messaging-sw.js",
    "src/services/webNotifications.ts"
)

foreach ($file in $filesToRestore) {
    Write-Host "  - Restauration de $file..." -ForegroundColor Gray
    git checkout b503c52 -- $file
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ $file restauré" -ForegroundColor Green
    } else {
        Write-Host "    ⚠️  $file n'existe pas dans b503c52 (peut être normal)" -ForegroundColor Yellow
    }
}

Write-Host ""

# Vérifier et restaurer les fichiers Firebase
Write-Host "📥 Vérification des fichiers Firebase..." -ForegroundColor Yellow
$firebaseFiles = @(
    "public/firebase/firebase-app.js",
    "public/firebase/firebase-messaging-sw.js"
)

foreach ($file in $firebaseFiles) {
    if (Test-Path $file) {
        Write-Host "  - Restauration de $file..." -ForegroundColor Gray
        git checkout b503c52 -- $file 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    ✅ $file restauré" -ForegroundColor Green
        }
    }
}

Write-Host ""

# Supprimer PROJECT_AUDIT_REPORT.md si présent
if (Test-Path "PROJECT_AUDIT_REPORT.md") {
    Write-Host "🗑️  Suppression de PROJECT_AUDIT_REPORT.md..." -ForegroundColor Yellow
    git rm PROJECT_AUDIT_REPORT.md
    Write-Host "✅ PROJECT_AUDIT_REPORT.md supprimé" -ForegroundColor Green
    Write-Host ""
}

# Afficher le statut
Write-Host "📊 Statut des modifications:" -ForegroundColor Cyan
git status --short
Write-Host ""

# Demander confirmation avant commit
Write-Host "⚠️  PRÊT POUR COMMIT" -ForegroundColor Yellow
Write-Host ""
Write-Host "Les fichiers suivants seront restaurés depuis b503c52:" -ForegroundColor White
foreach ($file in $filesToRestore) {
    if (Test-Path $file) {
        Write-Host "  - $file" -ForegroundColor Gray
    }
}
Write-Host ""

$confirm = Read-Host "Voulez-vous commit et push ces changements? (o/N)"
if ($confirm -ne "o" -and $confirm -ne "O") {
    Write-Host "❌ Rollback annulé. Les fichiers sont restaurés mais non commités." -ForegroundColor Yellow
    Write-Host "   Vous pouvez vérifier avec 'git status' et commit manuellement si nécessaire." -ForegroundColor Yellow
    exit 0
}

# Commit
Write-Host ""
Write-Host "💾 Création du commit..." -ForegroundColor Yellow
git add -A
git commit -m "rollback: restore stable FCM setup from b503c52, remove experimental changes

- Restore scripts/copy-service-worker.js from b503c52
- Restore scripts/verify-build.js from b503c52
- Restore public/firebase-messaging-sw.js from b503c52
- Restore src/services/webNotifications.ts from b503c52
- Remove PROJECT_AUDIT_REPORT.md (experimental file)

This rollback removes experimental FCM changes that broke Vercel build.
Returning to stable b503c52 configuration."

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR: Le commit a échoué" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Commit créé" -ForegroundColor Green
Write-Host ""

# Push
Write-Host "🚀 Push vers origin/prod..." -ForegroundColor Yellow
$pushConfirm = Read-Host "Voulez-vous push maintenant? (o/N)"
if ($pushConfirm -eq "o" -or $pushConfirm -eq "O") {
    git push origin prod
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Push réussi!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎉 ROLLBACK TERMINÉ" -ForegroundColor Green
        Write-Host ""
        Write-Host "Prochaines étapes:" -ForegroundColor Cyan
        Write-Host "  1. Vérifier le build Vercel" -ForegroundColor White
        Write-Host "  2. Tester que /firebase-messaging-sw.js est accessible" -ForegroundColor White
        Write-Host "  3. Vérifier que le service worker s'enregistre en prod" -ForegroundColor White
    } else {
        Write-Host "❌ ERREUR: Le push a échoué" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⏸️  Push annulé. Vous pouvez push manuellement avec:" -ForegroundColor Yellow
    Write-Host "   git push origin prod" -ForegroundColor Gray
}

Write-Host ""
Write-Host "📦 Branche de sauvegarde: $backupBranch" -ForegroundColor Cyan
Write-Host "   (Vous pouvez la supprimer plus tard avec: git branch -D $backupBranch)" -ForegroundColor Gray

