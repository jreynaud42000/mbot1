"""Serveur local de l'editeur mBot1 (Technologie Services).

Sert le dossier de l'application sur http://localhost:8030 et ouvre le navigateur. Compile aussi les programmes :
la carte mCore du mBot1 (ATmega328P) ne fait pas tourner Python, le programme C++ produit par les blocs doit etre
compile pour elle. La page envoie le code a /compiler, ce serveur le compile avec arduino-cli (carte Arduino Uno,
bibliotheque Makeblock) et renvoie le fichier .hex ; la page le televerse ensuite dans le robot (Web Serial).
/microprogramme compile de la meme facon le microprogramme du mode direct fourni avec la bibliotheque Makeblock.

Les outils (arduino-cli, compilateur AVR, bibliotheque Makeblock) sont installes dans le dossier outils/ par
installer_outils.py ; sans eux, l'editeur fonctionne (blocs, simulateur, mode direct), seul l'envoi est impossible.

Options :
  --sans-navigateur   n'ouvre pas le navigateur (apercu integre, tests).
"""

import glob
import http.server
import json
import os
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import webbrowser

PORT = 8030
# Numero de version : a tenir identique dans le menu Aide (index.html).
VERSION = "V1.0"
CARTE = "arduino:avr:uno"          # la carte mCore est une Arduino Uno (ATmega328P, Optiboot)
DUREE_MAX = 300                    # s : la premiere compilation construit tout le noyau Arduino


def dossier_de_lapplication():
    """Le dossier contenant index.html et lib/ (sys._MEIPASS pour un exe PyInstaller)."""
    if getattr(sys, "frozen", False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


DOSSIER = dossier_de_lapplication()
OUTILS = os.path.join(DOSSIER, "outils")
CONFIG = os.path.join(OUTILS, "arduino-cli.yaml")
verrou_compilation = threading.Lock()   # une compilation a la fois (meme dossier de construction)


def arduino_cli():
    """Chemin d'arduino-cli : celui du dossier outils/, sinon celui du PATH, sinon None."""
    local = os.path.join(OUTILS, "arduino-cli", "arduino-cli.exe" if os.name == "nt" else "arduino-cli")
    if os.path.isfile(local):
        return local
    return shutil.which("arduino-cli")


def microprogramme_mode_direct():
    """Croquis du microprogramme du mode direct (exemple de la bibliotheque Makeblock), ou None."""
    for motif in ("**/mbot_firmware.ino", "**/Firmware_for_mBot*.ino", "**/*mbot*firmware*.ino"):
        trouves = glob.glob(os.path.join(OUTILS, "arduino", "libraries", motif), recursive=True)
        if trouves:
            return sorted(trouves)[0]
    return None


def compiler(code=None, croquis=None):
    """Compile un programme (texte C++) ou un croquis existant ; renvoie un dictionnaire pour la page."""
    cli = arduino_cli()
    if not cli:
        return {"ok": False, "message": "les outils de compilation ne sont pas installés : lancez installer_outils.bat "
                                        "(environ 130 Mo à télécharger une seule fois)"}
    with verrou_compilation, tempfile.TemporaryDirectory(prefix="mbot1_") as temporaire:
        if croquis is None:
            dossier = os.path.join(temporaire, "programme")
            os.makedirs(dossier)
            croquis = os.path.join(dossier, "programme.ino")
            with open(croquis, "w", encoding="utf-8", newline="\n") as f:
                f.write(code)
        sortie = os.path.join(temporaire, "sortie")
        nom = os.path.splitext(os.path.basename(croquis))[0]
        construction = os.path.join(OUTILS, "construction", nom)   # garde le noyau compile : compilations suivantes rapides
        commande = [cli, "compile", "--fqbn", CARTE, "--build-path", construction, "--output-dir", sortie, os.path.dirname(croquis)]
        if os.path.isfile(CONFIG):
            commande[1:1] = ["--config-file", CONFIG]
        try:
            fini = subprocess.run(commande, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=DUREE_MAX,
                                  creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        except subprocess.TimeoutExpired:
            return {"ok": False, "message": "la compilation a duré plus de %d s" % DUREE_MAX}
        journal = (fini.stdout + "\n" + fini.stderr).strip()
        hexa = os.path.join(sortie, nom + ".ino.hex")
        if fini.returncode != 0 or not os.path.isfile(hexa):
            # Seules les lignes d'erreur interessent l'eleve (le chemin du dossier temporaire est retire).
            erreurs = [l.replace(temporaire, "").replace(os.sep + "programme" + os.sep, "") for l in journal.splitlines()
                       if "error" in l.lower() or "erreur" in l.lower()]
            return {"ok": False, "message": "erreur de compilation", "journal": "\n".join(erreurs[:15]) or journal[-2000:]}
        with open(hexa, encoding="ascii") as f:
            return {"ok": True, "hex": f.read(), "journal": journal[-2000:]}


class Serveur(socketserver.ThreadingMixIn, socketserver.TCPServer):
    # Pas sous Windows : cette option y laisse deux serveurs ecouter le meme port.
    allow_reuse_address = os.name != "nt"
    daemon_threads = True


class Handler(http.server.SimpleHTTPRequestHandler):
    """Sert les fichiers en interdisant leur mise en cache, et compile les programmes (POST)."""

    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map,
                          **{".js": "text/javascript", ".ino": "text/plain; charset=utf-8"})

    def end_headers(self):
        # Sans ces en-tetes, le navigateur ressert un ancien fichier .js apres modification.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def repondre(self, donnees):
        corps = json.dumps(donnees, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def do_POST(self):
        chemin = self.path.split("?")[0].rstrip("/")
        if chemin not in ("/compiler", "/microprogramme"):
            self.send_error(404)
            return
        try:
            longueur = int(self.headers.get("Content-Length", "0"))
            demande = json.loads(self.rfile.read(longueur).decode("utf-8") or "{}")
        except (ValueError, UnicodeDecodeError):
            self.send_error(400)
            return
        if chemin == "/compiler":
            code = demande.get("code", "")
            if not code.strip():
                self.repondre({"ok": False, "message": "le programme est vide"})
                return
            print("Compilation d'un programme (%d caractères)…" % len(code))
            self.repondre(compiler(code=code))
        else:
            croquis = microprogramme_mode_direct()
            if not croquis:
                self.repondre({"ok": False, "message": "microprogramme du mode direct introuvable : lancez installer_outils.bat"})
                return
            print("Compilation du microprogramme du mode direct :", croquis)
            self.repondre(compiler(croquis=croquis))

    def log_message(self, format, *args):
        pass  # journal silencieux : la console reste lisible


if __name__ == "__main__":
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")

    os.chdir(DOSSIER)
    print("Programmation mBot1 - version %s" % VERSION)
    print("Dossier servi :", os.getcwd())
    print("Compilation :", arduino_cli() or "outils absents (lancez installer_outils.bat)")

    # Port 8030 de preference (micro:bit : 8000 a 8009, mBot2 : 8020 a 8029) ; sinon les neuf suivants.
    httpd = None
    for port in range(PORT, PORT + 10):
        try:
            httpd = Serveur(("", port), Handler)
            break
        except OSError as erreur:
            print("Port %d indisponible : %s" % (port, erreur))
    if httpd is None:
        print("Aucun port libre entre %d et %d." % (PORT, PORT + 9))
        sys.exit(1)

    url = "http://localhost:%d" % port
    if "--sans-navigateur" not in sys.argv:
        threading.Timer(0.5, webbrowser.open, [url]).start()
    print("Application disponible sur", url)
    print("Fermez cette fenetre pour arreter le serveur.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArret du serveur.")
    finally:
        httpd.server_close()
