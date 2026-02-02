# Build and Run Script fuer LogStudio
# Dieses Skript baut die Anwendung und fuehrt sie aus

Write-Host "=== LogStudio Build & Run Script ===" -ForegroundColor Cyan

# Pruefe ob npm verfuegbar ist
$npmFound = $false
$npmPath = $null

# Versuche npm ueber Get-Command zu finden
try {
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmCmd) {
        $npmPath = $npmCmd.Source
        $npmFound = $true
    }
} catch {
    # npm nicht im PATH gefunden
}

# Falls nicht gefunden, suche in typischen Installationspfaden
if (-not $npmFound) {
    $commonPaths = @(
        "$env:ProgramFiles\nodejs\npm.cmd",
        "$env:ProgramFiles (x86)\nodejs\npm.cmd",
        "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd",
        "$env:APPDATA\npm\npm.cmd"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $npmPath = $path
            $npmFound = $true
            # Fuege zum PATH hinzu fuer diese Session
            $nodeDir = Split-Path $path -Parent
            $env:Path = "$nodeDir;$env:Path"
            break
        }
    }
}

if (-not $npmFound) {
    Write-Host "FEHLER: npm ist nicht verfuegbar." -ForegroundColor Red
    Write-Host ""
    Write-Host "Bitte installieren Sie Node.js von einer der folgenden Quellen:" -ForegroundColor Yellow
    Write-Host "  - https://nodejs.org/ (offizielle Website)" -ForegroundColor Gray
    Write-Host "  - https://github.com/coreybutler/nvm-windows (Node Version Manager)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Nach der Installation starten Sie PowerShell neu." -ForegroundColor Yellow
    exit 1
}

# Teste npm
try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "npm gefunden: $npmPath" -ForegroundColor Green
        Write-Host "npm Version: $npmVersion" -ForegroundColor Green
    } else {
        throw "npm konnte nicht ausgefuehrt werden"
    }
} catch {
    Write-Host "FEHLER: npm wurde gefunden, kann aber nicht ausgefuehrt werden." -ForegroundColor Red
    Write-Host "Pfad: $npmPath" -ForegroundColor Gray
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
