#!/usr/bin/env bash
# Optional: fetch a Windows Ollama build into vendor/ollama for offline AI installers.
# Usage: ./scripts/fetch-ollama-win.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/vendor/ollama"
mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading Ollama Windows setup (large)..."
curl -L --fail -o "$TMP/OllamaSetup.exe" "https://ollama.com/download/OllamaSetup.exe"
echo "Note: Official Windows distribution is an installer EXE."
echo "For CI offline bundles, prefer running OllamaSetup during install (default NSIS path)."
echo "Place a portable ollama.exe tree under vendor/ollama/ if you have one."
ls -lh "$TMP/OllamaSetup.exe"
cp "$TMP/OllamaSetup.exe" "$OUT/OllamaSetup.exe"
echo "Saved to $OUT/OllamaSetup.exe"
