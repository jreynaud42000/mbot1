"""Recopie les fichiers de la page dans site_web/ (site statique a heberger) et verifie que les copies sont identiques.

A relancer apres chaque modification. Sur le site statique, il n'y a pas de serveur : blocs, simulateur, mode direct
et enregistrement .ino fonctionnent, l'envoi compile (« Envoyer au robot ») demande le serveur local.
"""

import filecmp
import os
import shutil

DOSSIER = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(DOSSIER, "site_web")
FICHIERS = ["index.html", "app.js", "bandeau.js", "blocs.js", "direct.js", "simulateur.js", "televersement.js", "tuto.js",
            "logo.png", "logo_ts.png", "mbot1.png"]

os.makedirs(SITE, exist_ok=True)
for nom in FICHIERS:
    shutil.copy2(os.path.join(DOSSIER, nom), os.path.join(SITE, nom))
if os.path.isdir(os.path.join(SITE, "lib")):
    shutil.rmtree(os.path.join(SITE, "lib"))
shutil.copytree(os.path.join(DOSSIER, "lib"), os.path.join(SITE, "lib"))
open(os.path.join(SITE, ".nojekyll"), "w").close()   # GitHub Pages : servir les fichiers tels quels

differences = [n for n in FICHIERS if not filecmp.cmp(os.path.join(DOSSIER, n), os.path.join(SITE, n), shallow=False)]
comparaison = filecmp.dircmp(os.path.join(DOSSIER, "lib"), os.path.join(SITE, "lib"))
pile = [comparaison]
while pile:
    c = pile.pop()
    differences += c.diff_files + c.left_only + c.right_only
    pile += c.subdirs.values()
print("site_web : copies identiques." if not differences else "DIFFERENCES : %s" % differences)
