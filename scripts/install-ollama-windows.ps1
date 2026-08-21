# Installs Ollama for LogStudio's "With AI" installer path (Windows).
# Prefer a bundled ollama.exe next to this script; otherwise download OllamaSetup.
param(
  [string]$BundledOllamaDir = "",
  [string]$InstallDir = ""
)

$ErrorActionPreference = "Stop"

function Test-OllamaPresent {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"),
    (Join-Path ${env:ProgramFiles} "Ollama\ollama.exe")
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $true }
  }
  try {
    $null = Get-Command ollama -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

if ($BundledOllamaDir) {
  $bundled = Join-Path $BundledOllamaDir "ollama.exe"
  if (Test-Path $bundled) {
    Write-Host "Bundled Ollama present at $bundled"
    exit 0
  }
  $bundledSetup = Join-Path $BundledOllamaDir "OllamaSetup.exe"
  if (Test-Path $bundledSetup) {
    Write-Host "Running bundled OllamaSetup..."
    $p = Start-Process -FilePath $bundledSetup -ArgumentList "/VERYSILENT","/NORESTART" -Wait -PassThru
    exit $(if ($null -eq $p.ExitCode) { 0 } else { $p.ExitCode })
  }
}

if (Test-OllamaPresent) {
  Write-Host "Ollama already installed on system"
  exit 0
}

$setup = Join-Path $env:TEMP "OllamaSetup-LogStudio.exe"
$uri = "https://ollama.com/download/OllamaSetup.exe"
Write-Host "Downloading Ollama from $uri ..."
Invoke-WebRequest -Uri $uri -OutFile $setup -UseBasicParsing
Write-Host "Running silent Ollama setup..."
$p = Start-Process -FilePath $setup -ArgumentList "/VERYSILENT","/NORESTART" -Wait -PassThru
if ($p.ExitCode -ne 0 -and $null -ne $p.ExitCode) {
  Write-Host "Ollama setup exited with $($p.ExitCode)"
  exit $p.ExitCode
}
Write-Host "Ollama setup finished"
exit 0
