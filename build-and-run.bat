@echo off
REM Build and Run Script fuer LogStudio
REM Diese Batch-Datei umgeht die PowerShell Execution Policy

powershell -ExecutionPolicy Bypass -File "%~dp0build-and-run.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo FEHLER: Script konnte nicht ausgefuehrt werden!
    pause
    exit /b %ERRORLEVEL%
)
