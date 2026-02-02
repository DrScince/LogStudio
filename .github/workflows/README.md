# Release Pipeline

Diese GitHub Actions Pipeline erstellt automatisch eine selbstständige Windows EXE-Datei bei jedem Release.

## Verwendung

### Automatisches Release

1. Erstelle einen Git-Tag:
   ```bash
   git tag -a v1.0.1 -m "Release v1.0.1"
   git push origin v1.0.1
   ```

2. Die Pipeline wird automatisch ausgelöst und erstellt:
   - Eine portable Windows EXE-Datei
   - Ein GitHub Release mit der EXE als Asset

### Manuelles Release

1. Gehe zu "Actions" → "Release Build" → "Run workflow"
2. Gib die Version ein (z.B. `v1.0.1`)
3. Klicke auf "Run workflow"

## Output

Die erstellte EXE-Datei wird:
- Im `release/` Verzeichnis gespeichert
- Als GitHub Release Asset hochgeladen
- Als Artifact für 90 Tage gespeichert

## Dateiname

Die EXE wird benannt als: `LogStudio-{version}-x64.exe`
