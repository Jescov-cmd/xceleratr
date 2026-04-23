; Remove the startup Run key on uninstall (the app adds this itself, not the installer)
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Xceleratr"
!macroend
