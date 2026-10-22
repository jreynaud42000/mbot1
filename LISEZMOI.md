# Éditeur mBot1 (Technologie Services)

Éditeur de programmation par blocs, en français, pour le robot **mBot (v1) de Makeblock** (carte mCore, ATmega328P
compatible Arduino Uno). Même ergonomie que les éditeurs micro:bit (`blockly_ts_mode_classe`) et mBot2
(`blocky_ts_mbot2`) : bandeau orange, thèmes clair / sombre / contraste élevé / saisons, blocs de la couleur de la puce
de leur catégorie, titres de groupe avec trait de séparation, console, visite guidée.

La carte mCore ne fait pas tourner Python : les blocs sont traduits en **C++ Arduino** (bibliothèque MeMCore de
Makeblock). Il y a trois façons d'exécuter un programme :

| Bouton | Ce qui se passe | Besoin |
|---|---|---|
| **Lancer la simulation** | robot 2D sur une piste à l'échelle | rien |
| **Mode direct** | le programme tourne dans le navigateur et pilote le robot par le câble (comme le mode « en direct » de mBlock) | microprogramme du mode direct dans le robot |
| **Envoyer au robot** | compilation sur le poste (arduino-cli), puis téléversement : le robot fonctionne seul | serveur local + outils de compilation |

## Lancer

- Une seule fois : `installer_outils.bat` télécharge arduino-cli, le noyau Arduino AVR et la bibliothèque Makeblock
  (environ 130 Mo à télécharger, 450 Mo sur le disque) dans `outils/` (exclu de git, rien n'est installé ailleurs ; supprimer `outils/` désinstalle tout).
- Ensuite : double-cliquer sur `lancer_projet.bat` (ou `python app.py`) : l'éditeur s'ouvre sur http://localhost:8030.
- Pour relier le robot : **Chrome ou Edge** (Web Serial). Fermer mBlock et l'IDE Arduino avant.
- Aucune dépendance Python (bibliothèque standard) ; Blockly 10.4.3 est embarqué dans `lib/blockly` (aucun CDN).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | page, styles (thèmes repris des éditeurs micro:bit), bandeau, panneaux, fenêtres |
| `blocs.js` | blocs mBot1, générateur C++ Arduino (MeMCore), générateur « SIMU » pour le simulateur et le mode direct |
| `app.js` | espace Blockly, boîte à outils et couleurs, thèmes Blockly, code C++, fichiers `.ino`, exemples, aide, console |
| `simulateur.js` | robot 2D sur piste à l'échelle (200 × 150 cm), ultrasons, suiveur de ligne, LED, buzzer, bouton, télécommande |
| `direct.js` | mode direct : même code que le simulateur, commandes envoyées au robot (protocole série Makeblock FF 55) |
| `televersement.js` | lecture du `.hex`, téléversement STK500 (Optiboot) par Web Serial, console du robot |
| `bandeau.js` | thème, contraste, saisons et décors, puces, recherche de blocs (repris de `blocky_ts_mbot2`) |
| `tuto.js` | visite guidée (moteur repris de `blockly_ts_mode_classe`, étapes mBot1) |
| `app.py`, `lancer_projet.bat` | serveur local sans cache ; compile les programmes (`POST /compiler`, `POST /microprogramme`) |
| `installer_outils.py`, `.bat` | installation des outils de compilation dans `outils/` |
| `copier_site_web.py` | recopie la page dans `site_web/` et vérifie que les copies sont identiques |
| `site_web/` | copie statique à héberger (GitHub Pages…) : **à régénérer après chaque modification** (`python copier_site_web.py`) |

Sur le site statique, il n'y a pas de serveur : blocs, simulateur, mode direct et « Enregistrer (.ino) » fonctionnent ;
« Envoyer au robot » explique qu'il faut le serveur local.

## Programme généré

```cpp
// Programme créé avec l'éditeur mBot1 (Technologie Services)
#include <Arduino.h>
#include <Wire.h>
#include <SoftwareSerial.h>
#include <MeMCore.h>

MeDCMotor motor_9(M1);   // moteur gauche, monté en miroir : son signe est inversé
MeDCMotor motor_10(M2);  // moteur droit
...
void setup() {
  for (int i = 0; i < 4; i++) {
    _roues(50, 50);
    _delay(1);
    _roues(0, 0);
    ...
```

- Seuls les blocs placés sous « quand le programme démarre » (qui devient `setup()`) ou dans une fonction s'exécutent ;
  un bloc posé seul est grisé. `loop()` ne fait que les tâches de fond (`_loop()` : lecture de la télécommande).
- Vitesses en % (-100 à 100), **positif = la roue fait avancer** ; 100 % = 255. Le moteur gauche (M1) étant monté en
  miroir, son signe est inversé (comme le code produit par mBlock : avancer = `motor_9.run(-v)`, `motor_10.run(v)`).
- `_delay()` remplace `delay()` pour que la télécommande reste lue pendant les attentes ; chaque boucle appelle `_loop()`.
- Variables : `float` (texte : `String` si on leur donne un texte) ; `7 / 2` donne bien 3,5.
- Pas d'encodeur sur le mBot1 : pas de bloc « avancer de … cm » ni « tourner de … ° » ; on règle vitesse et durée.
- Le mBot1 n'a pas d'événements simultanés comme le CyberPi : un seul chapeau, « quand le programme démarre ».
- « Enregistrer » produit un vrai fichier `.ino` ; les blocs y sont ajoutés en dernière ligne (commentaire
  `// blocs-mbot1:`) pour pouvoir le rouvrir dans l'éditeur. Le dernier programme est aussi gardé dans le navigateur.

## Envoi au robot (téléversement)

1. `app.py` écrit le code dans un croquis temporaire et lance
   `arduino-cli compile --fqbn arduino:avr:uno` (dossier de construction gardé dans `outils/construction` :
   environ 8 s par compilation). Les erreurs du compilateur s'affichent dans la console.
   Vérifié : les 6 exemples (4 à 7 Ko) et le microprogramme du mode direct (27 Ko sur 31,5 Ko) compilent.
   La bibliothèque téléchargée (branche master de Makeblock-Libraries, version 3.31.0) compile `src/MeMegaPi.cpp`
   (carte MegaPi) sans garde, ce qui casse la compilation pour la carte mCore : `installer_outils.py` l'entoure
   d'un `#if defined(__AVR_ATmega2560__)` (liste `CORRECTIONS`).
2. La page téléverse le `.hex` par Web Serial avec le protocole **STK500 v1** (celui d'`avrdude -c arduino`,
   documentation Atmel AVR061) : impulsion DTR, `30 20` → `14 10`, signature `1E 95 0F`, `50 20`, puis pour chaque page
   de 128 octets `55` (adresse en mots) + `64` (écriture) + `74` (relecture et comparaison), enfin `51 20`.
   Pas besoin d'avrdude.

Le programme envoyé remplace le **microprogramme du mode direct**. Le bouton « Installer le microprogramme du mode
direct » de la fenêtre d'envoi le recompile depuis les exemples de la bibliothèque Makeblock et le réinstalle.

## Mode direct

Protocole série des microprogrammes Makeblock (`mbot_firmware`), 115 200 bauds :
`FF 55 | longueur | indice | action | appareil | données` ; réponse `FF 55 | indice | type | valeur | 0D 0A`.
Appareils utilisés : 0 version, 1 ultrasons, 3 lumière (port 6), 5 deux moteurs, 8 LED (port 7, emplacement 2),
10 moteur, 14 télécommande, 17 suiveur de ligne, 30/31 broches, 34 buzzer, 35 bouton (port 7) ; `FF 55 02 00 04` arrête tout.
Les lectures de capteurs sont des questions au robot (`await`), une à la fois.

## À vérifier sur un vrai mBot1

1. **Envoi réel et mode direct** : jamais testés sur le matériel (vérifiés contre une carte et un microprogramme simulés
   dans la page). Si la carte ne répond pas : pilote CH340, case « Afficher tous les ports série », port déjà ouvert.
2. **Numéros des LED** : « LED 1 » = indice 1 de `rgbled_7.setColor`, « LED 2 » = indice 2 ; le simulateur dessine la
   LED 1 à droite, à confirmer.
3. Formats du mode direct : **relus dans le code du microprogramme** (`mbot_firmware.ino` de la bibliothèque, version
   06.01.107) : bouton (appareil 35, octet 0 → 1 si appuyé), télécommande (14), LED (indice 0 = toutes), moteurs (5),
   buzzer (34). Reste à confirmer sur le robot que le microprogramme d'usine d'un mBot donné parle le même protocole.
4. **Dimensions** du simulateur : roues de 6,4 cm, entraxe de 11,5 cm et 150 tr/min à 100 % sont **estimés** ; à mesurer
   (`ROUE_D`, `ENTRAXE`, `RPM_100` en tête de `simulateur.js`), puis régler la durée du quart de tour de l'exemple « carré ».
5. **Écart des 2 capteurs** du suiveur de ligne (1,6 cm estimé, `LIGNE_L`).

## Tests rapides (console du navigateur)

- `mbot1Test.chargerExemple('ligne'); mbot1Test.genererArduino()` : code C++ d'un exemple.
- `Simulateur.etat()` : position, vitesses, capteurs du robot simulé.
- `TeleversementTest.lireHex(':0400000001020304F2\n:00000001FF')` → `[1, 2, 3, 4]`.
