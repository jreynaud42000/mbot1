@echo off
TITLE Serveur Projet mBot1
color 0A

REM Se placer dans le dossier du .bat : sinon le serveur sert le mauvais dossier.
cd /d "%~dp0"

echo ========================================================
echo   LANCEMENT DE L'EDITEUR mBot1 (Technologie Services)
echo ========================================================
echo.
echo Dossier servi : %CD%
echo.

if not exist "index.html" (
  echo ERREUR : index.html est introuvable dans ce dossier.
  pause
  exit /b 1
)

if not exist "outils\arduino-cli\arduino-cli.exe" (
  echo ATTENTION : outils de compilation absents. L'envoi au robot sera impossible
  echo tant que installer_outils.bat n'a pas ete lance une fois.
  echo Le simulateur et le mode direct fonctionnent sans ces outils.
  echo.
)

echo Le serveur web tourne dans cette fenetre.
echo ATTENTION : si vous fermez cette fenetre, le serveur s'arretera.
echo Pour envoyer un programme au robot : Chrome ou Edge (Web Serial).
echo.
python app.py

echo.
echo Le serveur s'est arrete.
pause
