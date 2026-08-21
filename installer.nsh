# Custom NSIS macros for LogStudio installer
# Install-time choice: Standard (ohne KI) vs. Mit KI-Assistent (Ollama)

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var AiDialog
Var AiRadioNone
Var AiRadioWith
Var InstallAI

!macro customPageAfterChangeDir
  !insertmacro skipPageIfUpdated
  Page custom aiComponentPageCreate aiComponentPageLeave
!macroend

Function aiComponentPageCreate
  nsDialogs::Create 1018
  Pop $AiDialog
  ${If} $AiDialog == error
    Abort
  ${EndIf}

  ; Default: with AI
  StrCpy $InstallAI "1"

  ${NSD_CreateLabel} 0 0 100% 28u "Welche Installation? / Which installation?"
  Pop $0

  ${NSD_CreateRadioButton} 10 40u 100% 16u "Standard - ohne KI / without AI"
  Pop $AiRadioNone

  ${NSD_CreateRadioButton} 10 62u 100% 28u "Mit KI-Assistent (Ollama) / With AI$\nOllama-Setup ~1.5 GB Download, Modell spaeter beim ersten Chat"
  Pop $AiRadioWith
  ${NSD_Check} $AiRadioWith

  ${NSD_CreateLabel} 10 100u 100% 28u "Ohne KI bleibt LogStudio schlank. KI kannst du spaeter in den Einstellungen aktivieren."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function aiComponentPageLeave
  ${NSD_GetState} $AiRadioWith $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $InstallAI "1"
  ${Else}
    StrCpy $InstallAI "0"
  ${EndIf}
FunctionEnd

!macro customInstall
  ; Context menu: Open with LogStudio
  WriteRegStr HKCU "Software\Classes\*\shell\Open with LogStudio" "" "Open with LogStudio"
  WriteRegStr HKCU "Software\Classes\*\shell\Open with LogStudio" "Icon" "$INSTDIR\LogStudio.exe,0"
  WriteRegStr HKCU "Software\Classes\*\shell\Open with LogStudio\command" "" '"$INSTDIR\LogStudio.exe" "%1"'

  ${If} $InstallAI == "1"
    FileOpen $0 "$INSTDIR\ai-component.json" w
    FileWrite $0 '{"aiEnabled":true,"source":"installer"}$\r$\n'
    FileClose $0
    WriteRegStr HKCU "Software\LogStudio" "AiEnabled" "1"

    DetailPrint "Installing AI component (Ollama)..."
    ; Script is shipped inside the app resources via electron-builder files
    IfFileExists "$INSTDIR\resources\scripts\install-ollama-windows.ps1" 0 ai_ps1_fallback
      nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\install-ollama-windows.ps1" -BundledOllamaDir "$INSTDIR\resources\ollama"'
      Pop $0
      DetailPrint "AI component script exit: $0"
      Goto ai_done
    ai_ps1_fallback:
      DetailPrint "AI install script missing; opening Ollama download page is deferred to the app."
    ai_done:
  ${ElseIf} $InstallAI == "0"
    FileOpen $0 "$INSTDIR\ai-component.json" w
    FileWrite $0 '{"aiEnabled":false,"source":"installer"}$\r$\n'
    FileClose $0
    WriteRegStr HKCU "Software\LogStudio" "AiEnabled" "0"
    RMDir /r "$INSTDIR\resources\ollama"
  ${EndIf}
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\*\shell\Open with LogStudio"
  DeleteRegKey HKCU "Software\LogStudio"
  Delete "$INSTDIR\ai-component.json"
!macroend
