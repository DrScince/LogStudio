# Code Signing Guide für LogStudio

## Übersicht

Digitale Signierung ist der Prozess, bei dem eine Anwendung mit einem Code-Signing-Zertifikat signiert wird, um die Identität des Herausgebers zu verifizieren. Dies entfernt die Windows-Sicherheitswarnung "Unbekannter Herausgeber".

## Warum Code Signing?

- ✅ **Entfernt Windows-Sicherheitswarnung** - Keine "Unbekannter Herausgeber" Meldung mehr
- ✅ **Erhöht Vertrauen** - Benutzer sehen einen verifizierten Herausgeber
- ✅ **Bessere Benutzererfahrung** - Keine zusätzlichen Klicks nötig
- ✅ **Professioneller Eindruck** - Wichtig für kommerzielle Anwendungen

## Optionen für Code-Signing-Zertifikate

### 1. Kommerzielle Zertifikate (Empfohlen)

#### Option A: DigiCert (Premium)
- **Kosten**: ~$200-400/Jahr
- **Vorteile**: Sehr vertrauenswürdig, schnelle Ausstellung
- **Website**: https://www.digicert.com/

#### Option B: Sectigo (ehemals Comodo)
- **Kosten**: ~$100-300/Jahr
- **Vorteile**: Gute Balance zwischen Preis und Vertrauen
- **Website**: https://sectigo.com/

#### Option C: GlobalSign
- **Kosten**: ~$200-350/Jahr
- **Vorteile**: International anerkannt
- **Website**: https://www.globalsign.com/

### 2. Open Source / Community Optionen

#### Option A: Let's Encrypt (Nur für OV/EV, nicht für Code Signing)
- **Kosten**: Kostenlos
- **Einschränkung**: Let's Encrypt bietet KEINE Code-Signing-Zertifikate

#### Option B: Self-Signed Certificate (Nur für Entwicklung)
- **Kosten**: Kostenlos
- **Einschränkung**: Wird von Windows nicht als vertrauenswürdig erkannt
- **Verwendung**: Nur für interne/Entwicklungsumgebungen

## Schritt-für-Schritt Anleitung

### Schritt 1: Zertifikat kaufen

1. Wählen Sie einen Zertifikatsanbieter (z.B. Sectigo)
2. Bestellen Sie ein **Code Signing Certificate**
3. Führen Sie die Identitätsprüfung durch (benötigt je nach Zertifikatstyp)
4. Laden Sie das Zertifikat herunter (normalerweise als `.pfx` oder `.p12` Datei)

### Schritt 2: Zertifikat lokal installieren

#### Windows:
```powershell
# Zertifikat importieren
Import-PfxCertificate -FilePath "path/to/certificate.pfx" -CertStoreLocation Cert:\CurrentUser\My -Password (Read-Host -AsSecureString)
```

#### Oder über Windows UI:
1. Doppelklick auf die `.pfx` Datei
2. Zertifikat-Import-Assistent folgen
3. Zertifikat im "Persönlich" Store speichern

### Schritt 3: Electron-Builder konfigurieren

#### electron-builder.json aktualisieren:

```json
{
  "win": {
    "target": [
      {
        "target": "portable",
        "arch": ["x64"]
      }
    ],
    "icon": "public/LogStudio_Logo.ico",
    "publisherName": "LogStudio",
    "certificateFile": "path/to/certificate.pfx",
    "certificatePassword": "${env.CSC_KEY_PASSWORD}",
    "signingHashAlgorithms": ["sha256"],
    "sign": "path/to/signtool.exe"
  }
}
```

### Schritt 4: Umgebungsvariablen setzen

#### Für lokale Builds:

**Windows PowerShell:**
```powershell
$env:CSC_LINK="path/to/certificate.pfx"
$env:CSC_KEY_PASSWORD="your-certificate-password"
```

**Windows CMD:**
```cmd
set CSC_LINK=path/to/certificate.pfx
set CSC_KEY_PASSWORD=your-certificate-password
```

#### Für CI/CD (GitHub Actions):

Die Zertifikate sollten als **GitHub Secrets** gespeichert werden:

1. Gehen Sie zu: `Settings` → `Secrets and variables` → `Actions`
2. Fügen Sie folgende Secrets hinzu:
   - `CSC_LINK`: Base64-kodiertes Zertifikat (siehe unten)
   - `CSC_KEY_PASSWORD`: Passwort für das Zertifikat

**Zertifikat für GitHub Actions vorbereiten:**

```powershell
# Zertifikat zu Base64 konvertieren
$certBytes = [System.IO.File]::ReadAllBytes("path/to/certificate.pfx")
$base64Cert = [System.Convert]::ToBase64String($certBytes)
$base64Cert | Out-File -Encoding ASCII "certificate-base64.txt"
```

### Schritt 5: GitHub Actions Workflow aktualisieren

Aktualisieren Sie `.github/workflows/release.yml`:

```yaml
- name: Build Windows executable
  run: npm run package -- --win portable
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    CSC_LINK: ${{ secrets.CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
```

**Vollständiges Beispiel:**

```yaml
build-windows:
  runs-on: windows-latest
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm test -- --run

    - name: Build application
      run: npm run build

    - name: Prepare certificate
      run: |
        $certBytes = [System.Convert]::FromBase64String("${{ secrets.CSC_LINK }}")
        [System.IO.File]::WriteAllBytes("certificate.pfx", $certBytes)
      shell: pwsh

    - name: Build Windows executable
      run: npm run package -- --win portable
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        CSC_LINK: certificate.pfx
        CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}

    - name: Upload Windows executable
      uses: actions/upload-artifact@v4
      with:
        name: LogStudio-Windows-${{ github.ref_name }}
        path: release/*.exe
        retention-days: 90
```

## Alternative: SignTool direkt verwenden

Falls electron-builder Probleme hat, können Sie SignTool direkt verwenden:

```powershell
# SignTool installieren (Teil von Windows SDK)
# Download: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/

# Anwendung signieren
signtool sign /f certificate.pfx /p "password" /t http://timestamp.digicert.com /fd SHA256 "path/to/LogStudio.exe"
```

## Kostenübersicht

| Anbieter | Kosten/Jahr | Vertrauenswürdigkeit | Ausstellungszeit |
|----------|-------------|---------------------|------------------|
| DigiCert | $200-400 | ⭐⭐⭐⭐⭐ | 1-2 Tage |
| Sectigo | $100-300 | ⭐⭐⭐⭐ | 1-3 Tage |
| GlobalSign | $200-350 | ⭐⭐⭐⭐⭐ | 1-2 Tage |

## Wichtige Sicherheitshinweise

⚠️ **NIEMALS** Zertifikate oder Passwörter in Git committen!
- Verwenden Sie GitHub Secrets für CI/CD
- Verwenden Sie Umgebungsvariablen für lokale Builds
- Speichern Sie Zertifikate sicher (z.B. verschlüsselt)

## Verifizierung

Nach dem Signieren können Sie die Signatur überprüfen:

```powershell
# Signatur überprüfen
signtool verify /pa "path/to/LogStudio.exe"
```

Oder über Windows UI:
1. Rechtsklick auf die `.exe` Datei
2. `Eigenschaften` → `Digitale Signaturen`
3. Signatur sollte sichtbar sein

## Troubleshooting

### Problem: "Certificate not found"
- **Lösung**: Stellen Sie sicher, dass `CSC_LINK` korrekt gesetzt ist
- **Lösung**: Überprüfen Sie den Pfad zum Zertifikat

### Problem: "Invalid password"
- **Lösung**: Überprüfen Sie `CSC_KEY_PASSWORD`
- **Lösung**: Stellen Sie sicher, dass keine Sonderzeichen Probleme verursachen

### Problem: "Timestamp server error"
- **Lösung**: Verwenden Sie einen anderen Timestamp-Server:
  - `http://timestamp.digicert.com`
  - `http://timestamp.verisign.com/scripts/timstamp.dll`
  - `http://timestamp.globalsign.com/scripts/timestamp.dll`

## Weitere Ressourcen

- [Electron Builder Code Signing Docs](https://www.electron.build/code-signing)
- [Windows Code Signing Guide](https://docs.microsoft.com/en-us/windows/win32/win_cert/code-signing-best-practices)
- [DigiCert Code Signing](https://www.digicert.com/code-signing/)
- [Sectigo Code Signing](https://sectigo.com/ssl-certificates-tls/code-signing)

## Zusammenfassung

1. ✅ Code-Signing-Zertifikat kaufen (ca. $100-400/Jahr)
2. ✅ Zertifikat lokal installieren
3. ✅ `electron-builder.json` konfigurieren
4. ✅ Umgebungsvariablen setzen
5. ✅ GitHub Secrets für CI/CD einrichten
6. ✅ Workflow aktualisieren
7. ✅ Build und testen

Nach erfolgreicher Signierung sollte die Windows-Warnung verschwinden! 🎉
