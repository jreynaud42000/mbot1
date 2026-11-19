"""EasyBloc mBot1 - fabrication de l'icone de l'exe (icone.ico + icone.png), nov. 2026.

Meme principe que l'icone micro:bit (variante B choisie par l'utilisateur) : le robot dessine de face sur un carre
arrondi bleu nuit #1f2b6b, la couleur du bandeau. Dessin a 1024 px puis reduit (16 a 256 px). Aucune photo.
Lancement depuis le dossier du projet :  python creer_icone.py
"""
import os, sys
from PIL import Image, ImageDraw

G = 1024 / 100.0
def R(d, x, y, w, h, ray, c, contour=None, ep=0):
    d.rounded_rectangle([x * G, y * G, (x + w) * G, (y + h) * G], radius=ray * G, fill=c,
                        outline=contour, width=int(ep * G) if ep else 0)
def C(d, cx, cy, ray, c):
    d.ellipse([(cx - ray) * G, (cy - ray) * G, (cx + ray) * G, (cy + ray) * G], fill=c)

def fond(d):
    R(d, 2, 2, 96, 96, 22, '#1f2b6b')

def roues(d, y=58, h=30):
    for x in (9, 77):
        R(d, x, y, 14, h, 4, '#16161a')
        for k in range(5):
            R(d, x + 2, y + 3 + k * (h - 6) / 5, 10, 2.2, 1, '#3a3a42')

def mbot1():
    im = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    fond(d)
    roues(d)
    R(d, 20, 46, 60, 40, 7, '#1e88e5')                  # chassis bleu
    R(d, 20, 46, 60, 7, 4, '#64b5f6')                   # arete claire du chassis
    R(d, 27, 24, 46, 22, 4, '#1565c0')                  # carte du capteur a ultrasons
    for cx in (39, 61):                                 # les deux « yeux »
        C(d, cx, 35, 9.5, '#cfd8dc'); C(d, cx, 35, 6.5, '#37474f'); C(d, cx - 2, 33, 1.8, '#90a4ae')
    for x in (30, 44, 58):                              # LED de la carte mCore
        C(d, x + 6, 70, 2.6, '#ff5252' if x == 30 else '#69f0ae' if x == 44 else '#40c4ff')
    return im

def ecrire(im, dossier):
    tailles = [256, 128, 64, 48, 32, 24, 16]
    imgs = [im.resize((t, t), Image.LANCZOS) for t in tailles]
    imgs[0].save(os.path.join(dossier, 'icone.ico'), format='ICO', sizes=[(t, t) for t in tailles], append_images=imgs[1:])
    imgs[0].save(os.path.join(dossier, 'icone.png'))

if __name__ == '__main__':
    ecrire(mbot1(), os.path.dirname(os.path.abspath(__file__)))
    print('icone.ico et icone.png ecrits')
