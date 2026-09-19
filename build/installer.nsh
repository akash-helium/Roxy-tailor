; Custom NSIS header for Roxy Tailor.
; Cross-building Windows NSIS from macOS can produce installers whose
; embedded CRC no longer matches after PE resource editing, which causes:
;   "Installer integrity check has failed"
; on install and uninstall. Disabling CRCCheck is the standard workaround
; when the installer is built on macOS (electron-builder #4875).
CRCCheck off
