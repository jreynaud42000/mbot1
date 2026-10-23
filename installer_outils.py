"""Installe les outils de compilation de l'editeur mBot1 dans le dossier outils/ (une seule fois : environ 130 Mo
à télécharger, 450 Mo sur le disque).

1. arduino-cli (outil officiel Arduino en ligne de commande) : downloads.arduino.cc ;
2. le noyau « Arduino AVR » (compilateur avr-gcc, carte Arduino Uno = carte mCore), par arduino-cli ;
3. la bibliotheque Makeblock (MeMCore.h, exemples dont le microprogramme du mode direct) : github.com/Makeblock-official.

Tout reste dans outils/ (configuration arduino-cli.yaml propre a l'editeur) : rien n'est installe ailleurs sur
l'ordinateur, et supprimer outils/ suffit a tout desinstaller.
"""

import io
import os
import shutil
import subprocess
import sys
import urllib.request
import zipfile

DOSSIER = os.path.dirname(os.path.abspath(__file__))
OUTILS = os.path.join(DOSSIER, "outils")
CLI_DOSSIER = os.path.join(OUTILS, "arduino-cli")
CLI = os.path.join(CLI_DOSSIER, "arduino-cli.exe" if os.name == "nt" else "arduino-cli")
CONFIG = os.path.join(OUTILS, "arduino-cli.yaml")
BIBLIOTHEQUES = os.path.join(OUTILS, "arduino", "libraries")
URL_CLI = "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip"
URL_MAKEBLOCK = "https://github.com/Makeblock-official/Makeblock-Libraries/archive/refs/heads/master.zip"


def telecharger(url):
    print("Téléchargement :", url)
    with urllib.request.urlopen(url, timeout=120) as reponse:
        donnees = reponse.read()
    print("  %.1f Mo reçus" % (len(donnees) / 1e6))
    return donnees


def lancer_cli(*arguments):
    commande = [CLI, "--config-file", CONFIG] + list(arguments)
    print(">", " ".join(arguments))
    subprocess.run(commande, check=True)


def corriger_bibliotheque(cible):
    """Fichiers propres a la carte MegaPi (ATmega2560) compiles sans garde : ils empechent de compiler pour la carte
    mCore (Arduino Uno). On les entoure d'un #if, sans rien changer d'autre (correction refaite a chaque installation)."""
    garde = "#if defined(__AVR_ATmega2560__)  // ajoute par installer_outils.py (editeur mBot1)\n"
    for nom in CORRECTIONS:
        chemin = os.path.join(cible, "src", nom)
        if not os.path.isfile(chemin):
            continue
        with open(chemin, encoding="utf-8", errors="surrogateescape") as f:
            texte = f.read()
        if texte.startswith(garde):
            continue
        with open(chemin, "w", encoding="utf-8", errors="surrogateescape", newline="") as f:
            f.write(garde + texte + "\n#endif\n")
        print("  correction (carte MegaPi seulement) :", nom)


CORRECTIONS = ["MeMegaPi.cpp"]


def main():
    os.makedirs(OUTILS, exist_ok=True)

    # 1. arduino-cli
    if not os.path.isfile(CLI):
        if os.name != "nt":
            sys.exit("Installation automatique prévue pour Windows : installez arduino-cli à la main (arduino.cc).")
        os.makedirs(CLI_DOSSIER, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(telecharger(URL_CLI))) as archive:
            archive.extract("arduino-cli.exe", CLI_DOSSIER)
    print("arduino-cli :", CLI)

    # Configuration propre a l'editeur : tout dans outils/.
    with open(CONFIG, "w", encoding="utf-8") as f:
        f.write("directories:\n  data: '%s'\n  downloads: '%s'\n  user: '%s'\n" % (
            os.path.join(OUTILS, "arduino15"), os.path.join(OUTILS, "telechargements"), os.path.join(OUTILS, "arduino")))

    # 2. Noyau Arduino AVR
    lancer_cli("core", "update-index")
    lancer_cli("core", "install", "arduino:avr")

    # 3. Bibliotheque Makeblock (dossier src/ + library.properties + examples/)
    cible = os.path.join(BIBLIOTHEQUES, "Makeblock-Libraries")
    if not os.path.isdir(cible):
        os.makedirs(BIBLIOTHEQUES, exist_ok=True)
        with zipfile.ZipFile(io.BytesIO(telecharger(URL_MAKEBLOCK))) as archive:
            racine = archive.namelist()[0].split("/")[0]
            archive.extractall(BIBLIOTHEQUES)
        shutil.move(os.path.join(BIBLIOTHEQUES, racine), cible)
    corriger_bibliotheque(cible)
    print("Bibliothèque Makeblock :", cible)
    print("\nOutils installés. Lancez lancer_projet.bat : « Envoyer au robot » compile et téléverse les programmes.")


if __name__ == "__main__":
    main()
