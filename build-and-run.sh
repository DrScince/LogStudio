#!/bin/bash
# Build and Run Script fuer LogStudio
# Dieses Skript baut die Anwendung und fuehrt sie aus

echo "=== LogStudio Build & Run Script ==="

# Pruefe ob npm verfuegbar ist
if ! command -v npm &> /dev/null; then
    echo "FEHLER: npm ist nicht verfuegbar. Bitte installieren Sie Node.js."
    exit 1
fi
echo "npm Version: $(npm --version)"

# Installiere Abhaengigkeiten (falls noetig)
if [ ! -d "node_modules" ]; then
    echo ""
    echo "[1/5] Installiere Abhaengigkeiten..."
    npm install
    if [ $? -ne 0 ]; then
        echo "FEHLER: npm install fehlgeschlagen!"
        exit 1
    fi
    echo "Abhaengigkeiten erfolgreich installiert."
else
    echo ""
    echo "[1/5] Abhaengigkeiten bereits installiert."
fi

# Baue Main-Prozess
echo ""
echo "[2/5] Baue Electron Main-Prozess..."
npm run build:main
if [ $? -ne 0 ]; then
    echo "FEHLER: Build des Main-Prozesses fehlgeschlagen!"
    exit 1
fi
echo "Main-Prozess erfolgreich gebaut."

# Baue Renderer-Prozess
echo ""
echo "[3/5] Baue React Renderer-Prozess..."
npm run build:renderer
if [ $? -ne 0 ]; then
    echo "FEHLER: Build des Renderer-Prozesses fehlgeschlagen!"
    exit 1
fi
echo "Renderer-Prozess erfolgreich gebaut."

# Pruefe ob dist-Verzeichnis existiert und Dateien enthaelt
echo ""
echo "[4/5] Verifiziere Build-Ergebnis..."
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

# Starte die Anwendung
echo ""
echo "[5/5] Starte LogStudio..."
echo "Die Anwendung wird jetzt gestartet..."
echo ""

npm start

if [ $? -ne 0 ]; then
    echo ""
    echo "FEHLER: Anwendung konnte nicht gestartet werden!"
    exit 1
fi

echo ""
echo "=== Fertig ==="
