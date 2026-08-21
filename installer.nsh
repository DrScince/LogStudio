# Custom NSIS macros for LogStudio installer

!macro customInstall
  ; Add "Open with LogStudio" to the Windows context menu for all files
  WriteRegStr HKCU "Software\Classes\*\shell\Open with LogStudio" "" "Open with LogStudio"
  WriteRegStr HKCU "Software\Classes\*\shell\Open with LogStudio" "Icon" "$INSTDIR\LogStudio.exe,0"
  WriteRegStr HKCU "Software\Classes\*\shell\Open with LogStudio\command" "" '"$INSTDIR\LogStudio.exe" "%1"'
!macroend

!macro customUnInstall
  ; Remove "Open with LogStudio" from context menu on uninstall
  DeleteRegKey HKCU "Software\Classes\*\shell\Open with LogStudio"
!macroend
