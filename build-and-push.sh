#!/bin/bash
# Build and Push Script für LogStudio
# Dieses Skript baut die Anwendung, verifiziert den Erfolg und pusht bei Erfolg

echo "=== LogStudio Build & Push Script ==="

# Prüfe ob npm verfügbar ist
if ! command -v npm &> /dev/null; then
    echo "FEHLER: npm ist nicht verfügbar. Bitte installieren Sie Node.js."
    exit 1
fi
echo "npm Version: $(npm --version)"

# Prüfe ob Git verfügbar ist
if ! command -v git &> /dev/null; then
    echo "FEHLER: Git ist nicht verfügbar."
    exit 1
fi
echo "Git Version: $(git --version)"

# Installiere Abhängigkeiten
echo ""
echo "[1/4] Installiere Abhängigkeiten..."
npm install
if [ $? -ne 0 ]; then
    echo "FEHLER: npm install fehlgeschlagen!"
    exit 1
fi
echo "Abhängigkeiten erfolgreich installiert."

# Baue Main-Prozess
echo ""
echo "[2/4] Baue Electron Main-Prozess..."
npm run build:main
if [ $? -ne 0 ]; then
    echo "FEHLER: Build des Main-Prozesses fehlgeschlagen!"
    exit 1
fi
echo "Main-Prozess erfolgreich gebaut."

# Baue Renderer-Prozess
echo ""
echo "[3/4] Baue React Renderer-Prozess..."
npm run build:renderer
if [ $? -ne 0 ]; then
    echo "FEHLER: Build des Renderer-Prozesses fehlgeschlagen!"
    exit 1
fi
echo "Renderer-Prozess erfolgreich gebaut."

# Prüfe ob dist-Verzeichnis existiert und Dateien enthält
echo ""
echo "[4/4] Verifiziere Build-Ergebnis..."
if [ ! -d "dist" ]; then
    echo "FEHLER: dist-Verzeichnis wurde nicht erstellt!"
    exit 1
fi

MAIN_FILES=$(find dist -name "main.js" | wc -l)
RENDERER_FILES=$(find dist -name "index.html" | wc -l)

if [ $MAIN_FILES -eq 0 ]; then
    echo "FEHLER: main.js wurde nicht gefunden!"
    exit 1
fi

if [ $RENDERER_FILES -eq 0 ]; then
    echo "FEHLER: index.html wurde nicht gefunden!"
    exit 1
fi

echo "Build erfolgreich verifiziert!"
echo "  - Main-Prozess: $MAIN_FILES Datei(en) gefunden"
echo "  - Renderer: $RENDERER_FILES Datei(en) gefunden"

# Git Status prüfen
echo ""
echo "=== Git Status ==="
git status --short

# Prüfe ob es Änderungen gibt
if ! git diff --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    echo ""
    echo "Es gibt Änderungen zum Committen."
    
    # Alle Änderungen hinzufügen
    git add .
    
    # Commit erstellen
    COMMIT_MESSAGE="Build: Automatischer Build nach Änderungen"
    git commit -m "$COMMIT_MESSAGE"
    
    if [ $? -eq 0 ]; then
        echo "Commit erfolgreich erstellt: $COMMIT_MESSAGE"
        
        # Push durchführen
        echo ""
        echo "Pushe Änderungen zu origin/main..."
        git push origin main
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "=== ERFOLG ==="
            echo "Build erfolgreich und Änderungen wurden gepusht!"
        else
            echo "FEHLER: Push fehlgeschlagen!"
            exit 1
        fi
    else
        echo "FEHLER: Commit fehlgeschlagen!"
        exit 1
    fi
else
    echo ""
    echo "Keine Änderungen zum Committen."
fi

echo ""
echo "=== Fertig ==="
