@echo off
TITLE Installation des outils de compilation mBot1
cd /d "%~dp0"
echo ========================================================
echo   OUTILS DE COMPILATION DE L'EDITEUR mBot1
echo   (arduino-cli, compilateur AVR, bibliotheque Makeblock)
echo   Environ 130 Mo a telecharger (450 Mo sur le disque),
echo   installes dans le dossier outils\
echo ========================================================
echo.
python installer_outils.py
echo.
pause
