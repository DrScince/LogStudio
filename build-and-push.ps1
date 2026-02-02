# Build and Push Script fuer LogStudio
# Dieses Skript baut die Anwendung, verifiziert den Erfolg und pusht bei Erfolg

Write-Host "=== LogStudio Build & Push Script ===" -ForegroundColor Cyan

# Pruefe ob npm verfuegbar ist
try {
    $npmVersion = npm --version
    Write-Host "npm Version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "FEHLER: npm ist nicht verfuegbar. Bitte installieren Sie Node.js." -ForegroundColor Red
    exit 1
}

# Pruefe ob Git verfuegbar ist
try {
    $gitVersion = git --version
    Write-Host "Git Version: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "FEHLER: Git ist nicht verfuegbar." -ForegroundColor Red
    exit 1
}

# Installiere Abhängigkeiten
Write-Host "`n[1/4] Installiere Abhaengigkeiten..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "FEHLER: npm install fehlgeschlagen!" -ForegroundColor Red
    exit 1
}
Write-Host "Abhaengigkeiten erfolgreich installiert." -ForegroundColor Green

# Baue Main-Prozess
Write-Host "`n[2/4] Baue Electron Main-Prozess..." -ForegroundColor Yellow
npm run build:main
if ($LASTEXITCODE -ne 0) {
    Write-Host "FEHLER: Build des Main-Prozesses fehlgeschlagen!" -ForegroundColor Red
    exit 1
}
Write-Host "Main-Prozess erfolgreich gebaut." -ForegroundColor Green

# Baue Renderer-Prozess
Write-Host "`n[3/4] Baue React Renderer-Prozess..." -ForegroundColor Yellow
npm run build:renderer
if ($LASTEXITCODE -ne 0) {
    Write-Host "FEHLER: Build des Renderer-Prozesses fehlgeschlagen!" -ForegroundColor Red
    exit 1
}
Write-Host "Renderer-Prozess erfolgreich gebaut." -ForegroundColor Green

# Pruefe ob dist-Verzeichnis existiert und Dateien enthaelt
Write-Host "`n[4/4] Verifiziere Build-Ergebnis..." -ForegroundColor Yellow
if (-not (Test-Path "dist")) {
    Write-Host "FEHLER: dist-Verzeichnis wurde nicht erstellt!" -ForegroundColor Red
    exit 1
}

$mainFiles = Get-ChildItem -Path "dist" -Filter "main.js" -Recurse
$rendererFiles = Get-ChildItem -Path "dist" -Filter "index.html" -Recurse

if ($mainFiles.Count -eq 0) {
    Write-Host "FEHLER: main.js wurde nicht gefunden!" -ForegroundColor Red
    exit 1
}

if ($rendererFiles.Count -eq 0) {
    Write-Host "FEHLER: index.html wurde nicht gefunden!" -ForegroundColor Red
    exit 1
}

Write-Host "Build erfolgreich verifiziert!" -ForegroundColor Green
Write-Host "  - Main-Prozess: $($mainFiles.Count) Datei(en) gefunden" -ForegroundColor Gray
Write-Host "  - Renderer: $($rendererFiles.Count) Datei(en) gefunden" -ForegroundColor Gray

# Git Status pruefen
Write-Host "`n=== Git Status ===" -ForegroundColor Cyan
git status --short

# Pruefe ob es Aenderungen gibt
git diff --quiet
$hasStagedChanges = $LASTEXITCODE -ne 0

$untrackedFiles = git ls-files --others --exclude-standard
$hasUntracked = $untrackedFiles.Count -gt 0

if ($hasStagedChanges -or $hasUntracked) {
    Write-Host "`nEs gibt Aenderungen zum Committen." -ForegroundColor Yellow
    
    # Alle Aenderungen hinzufuegen
    git add .
    
    # Commit erstellen
    $commitMessage = "Build: Automatischer Build nach Aenderungen"
    git commit -m $commitMessage
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Commit erfolgreich erstellt: $commitMessage" -ForegroundColor Green
        
        # Push durchfuehren
        Write-Host "`nPushe Aenderungen zu origin/main..." -ForegroundColor Yellow
        git push origin main
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n=== ERFOLG ===" -ForegroundColor Green
            Write-Host "Build erfolgreich und Aenderungen wurden gepusht!" -ForegroundColor Green
        } else {
            Write-Host "FEHLER: Push fehlgeschlagen!" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "FEHLER: Commit fehlgeschlagen!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`nKeine Änderungen zum Committen." -ForegroundColor Gray
}

Write-Host "`n=== Fertig ===" -ForegroundColor Cyan
