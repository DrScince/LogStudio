# Build and Run Script fuer LogStudio
# Dieses Skript baut die Anwendung und fuehrt sie aus

Write-Host "=== LogStudio Build & Run Script ===" -ForegroundColor Cyan

# Pruefe ob npm verfuegbar ist
try {
    $npmVersion = npm --version
    Write-Host "npm Version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "FEHLER: npm ist nicht verfuegbar. Bitte installieren Sie Node.js." -ForegroundColor Red
    exit 1
}

# Installiere Abhaengigkeiten (falls noetig)
if (-not (Test-Path "node_modules")) {
    Write-Host "`n[1/5] Installiere Abhaengigkeiten..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FEHLER: npm install fehlgeschlagen!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Abhaengigkeiten erfolgreich installiert." -ForegroundColor Green
} else {
    Write-Host "`n[1/5] Abhaengigkeiten bereits installiert." -ForegroundColor Gray
}

# Baue Main-Prozess
Write-Host "`n[2/5] Baue Electron Main-Prozess..." -ForegroundColor Yellow
npm run build:main
if ($LASTEXITCODE -ne 0) {
    Write-Host "FEHLER: Build des Main-Prozesses fehlgeschlagen!" -ForegroundColor Red
    exit 1
}
Write-Host "Main-Prozess erfolgreich gebaut." -ForegroundColor Green

# Baue Renderer-Prozess
Write-Host "`n[3/5] Baue React Renderer-Prozess..." -ForegroundColor Yellow
npm run build:renderer
if ($LASTEXITCODE -ne 0) {
    Write-Host "FEHLER: Build des Renderer-Prozesses fehlgeschlagen!" -ForegroundColor Red
    exit 1
}
Write-Host "Renderer-Prozess erfolgreich gebaut." -ForegroundColor Green

# Pruefe ob dist-Verzeichnis existiert und Dateien enthaelt
Write-Host "`n[4/5] Verifiziere Build-Ergebnis..." -ForegroundColor Yellow
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

# Starte die Anwendung
Write-Host "`n[5/5] Starte LogStudio..." -ForegroundColor Yellow
Write-Host "Die Anwendung wird jetzt gestartet..." -ForegroundColor Green
Write-Host ""

npm start

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nFEHLER: Anwendung konnte nicht gestartet werden!" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Fertig ===" -ForegroundColor Cyan
