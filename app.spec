# -*- mode: python ; coding: utf-8 -*-
# Exe de l'editeur mBot1 (nov. 2026), sur le modele de l'editeur micro:bit : mode dossier ("onedir"),
# dist/Mbot1Easybloc_V1.0/ contient l'exe et _internal/. Distribuer le dossier entier (zip), jamais l'exe seul.
#
# Les outils de compilation (outils/, installes une fois par installer_outils.py) sont EMBARQUES : « Envoyer au
# robot » fonctionne sans rien installer. Sont laisses de cote : les archives telechargees (outils/telechargements),
# l'ancien dossier de construction (outils/construction), l'index des bibliotheques (57 Mo, inutile pour compiler)
# et outils/arduino-cli.yaml (chemins absolus du poste d'installation : l'exe ecrit le sien, voir app.py).
import os

def dossier(source, cible, exclus=()):
    """Liste (fichier, dossier cible) d'un dossier, sans les sous-chemins exclus (relatifs a source)."""
    paires = []
    for racine, sous, fichiers in os.walk(source):
        rel = os.path.relpath(racine, source)
        if any(rel == e or rel.startswith(e + os.sep) for e in exclus):
            continue
        for f in fichiers:
            chemin = os.path.join(racine, f)
            if os.path.relpath(chemin, source) in exclus:
                continue
            paires.append((chemin, os.path.normpath(os.path.join(cible, rel))))
    return paires

PAGE = ['index.html', 'app.js', 'bandeau.js', 'blocs.js', 'exemples_aide.js', 'direct.js', 'simulateur.js',
        'televersement.js', 'tuto.js', 'logo.png', 'logo_ts.png', 'logo_ts_clair.png', 'mbot1.png']
OUTILS_EXCLUS = ('telechargements', 'construction', 'arduino-cli.yaml',
                 os.path.join('arduino15', 'library_index.json'), os.path.join('arduino15', 'library_index.json.sig'),
                 os.path.join('arduino15', 'tmp'))

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[(f, '.') for f in PAGE] + [('lib', 'lib')] + dossier('outils', 'outils', OUTILS_EXCLUS),
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Mbot1Easybloc_V1.0',
    version='version_info.txt',
    icon='icone.ico',   # robot dessine sur fond bleu nuit (creer_icone.py, nov. 2026)
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='Mbot1Easybloc_V1.0',
)
