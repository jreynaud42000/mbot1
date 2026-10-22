// tuto.js — visite guidee de l'editeur mBot1 (menu Aide > « Visite guidée de l'éditeur »).
// Moteur repris des editeurs micro:bit (blockly_ts_mode_classe/tuto.js) : une bulle se place a cote de l'element
// presente, le reste de l'ecran est assombri, mais les clics restent possibles (l'eleve manipule les vrais outils).
// Certaines etapes attendent une action reelle ; « Suivant » reste toujours disponible.
//
// Etape : titre, texte ; cible (selecteur CSS ou fonction, absent = bulle centree) ; avant() ; attendre() (true quand
// l'action est faite) ; consigne (phrase d'action en gras).

const $ = (sel, racine = document) => racine.querySelector(sel);
const bouton = id => document.getElementById(id);
function categorie(nom) {
    for (const e of document.querySelectorAll('.blocklyToolboxCategory')) {
        const lib = $('.blocklyTreeLabel', e);
        if (lib && lib.textContent.trim() === nom) return e;
    }
    return null;
}
const blocs = () => (window.workspace ? window.workspace.getAllBlocks(false) : []);
const sousDemarrage = type => blocs().some(b => b.type === type && b.getRootBlock().type === 'mb_demarrage');
const menuContextuel = () => { const m = $('.blocklyContextMenu'); return m && m.offsetWidth > 0 ? m : null; };
function ouvrirPanneau(idBouton) { const b = bouton(idBouton); if (b && b.classList.contains('inactif')) b.click(); }

const ETAPES_GENERAL = [
    {
        titre: 'Bienvenue 👋',
        texte: 'Cette visite présente l\'éditeur du robot mBot1 en 9 étapes. Vous pouvez manipuler l\'éditeur pendant la visite. ' +
            '« Suivant » passe à l\'étape d\'après, « Quitter » (ou Échap) arrête la visite ; le menu « Aide » la relance.',
    },
    {
        titre: 'Les catégories de blocs',
        texte: 'Chaque catégorie a sa couleur, et ses blocs ont la même couleur que sa puce. En haut : les blocs du robot ' +
            '(déplacements, capteurs, LED, son, ports). En bas : les blocs de programmation (logique, maths, variables…). ' +
            'Le champ « Rechercher un bloc » trouve un bloc par un mot.',
        cible: '.blocklyToolboxDiv',
    },
    {
        titre: 'Le début du programme',
        texte: 'Un programme commence toujours par le bloc jaune « quand le programme démarre ». Un bloc posé seul, ' +
            'sans être accroché sous ce bloc, est grisé : il ne s\'exécute pas.',
        cible: () => categorie('Événements'),
    },
    {
        titre: 'Faire avancer le robot',
        texte: 'La catégorie Déplacements contient les blocs qui font bouger le robot. Le mBot1 n\'a pas de compteur de tours de roue : ' +
            'on règle une vitesse (en % de la puissance des moteurs) et une durée.',
        cible: () => categorie('Déplacements'),
        consigne: 'Glissez « avancer à 50 % pendant 1 secondes » sous « quand le programme démarre ».',
        attendre: () => sousDemarrage('mb_avancer_pendant'),
    },
    {
        titre: 'La simulation',
        texte: 'Le robot est dessiné vu de dessus, sur une piste à l\'échelle. Les deux points à l\'avant sont les capteurs du suiveur de ligne, ' +
            'le trait pointillé bleu est le faisceau des ultrasons. Dessous, la carte mCore (LED, bouton) et la télécommande.',
        cible: '#simulator-container',
        avant: () => ouvrirPanneau('btn-vue-simu'),
    },
    {
        titre: 'Lancer la simulation',
        texte: 'Le bouton vert exécute le programme dans le simulateur. Il devient rouge « Arrêter » pendant l\'exécution.',
        cible: '#tb-lancer',
        consigne: 'Cliquez sur « Lancer la simulation » et regardez le robot avancer.',
        attendre: () => !!window.Simulateur && window.Simulateur.enCours(),
    },
    {
        titre: 'Le code C++',
        texte: 'Les blocs sont traduits en C++ pour Arduino, avec la bibliothèque MeMCore de Makeblock : c\'est ce programme qui est ' +
            'compilé puis envoyé dans la carte mCore. Le bouton « Code » l\'affiche ou le masque.',
        cible: '#code-container',
        avant: () => ouvrirPanneau('btn-vue-code'),
    },
    {
        titre: 'Envoyer au vrai robot',
        texte: 'Branchez le mBot1 avec son câble USB, allumez-le, puis cliquez ici (Chrome ou Edge). Le programme est compilé, ' +
            'enregistré dans la carte et démarre tout seul : le robot peut ensuite rouler débranché.',
        cible: '#btn-envoyer',
    },
    {
        titre: 'Essayer en mode direct',
        texte: 'Le mode direct exécute le programme dans l\'ordinateur et pilote le robot par le câble, sans compiler : idéal pour ' +
            'essayer vite. Il demande le microprogramme du mode direct (celui d\'usine du mBot).',
        cible: '#tb-direct',
    },
    {
        titre: 'Enregistrer son travail',
        texte: 'Le menu Fichier enregistre le programme dans un fichier .ino (que l\'on peut rouvrir ici, ou dans l\'IDE Arduino) et propose des ' +
            'exemples. L\'éditeur garde aussi automatiquement le dernier programme dans ce navigateur. Un clic droit sur un bloc ' +
            'donne « Aide sur ce bloc ».',
        cible: '#menu-fichier-btn',
    },
    {
        titre: 'À vous de jouer 🎉',
        texte: 'Essayez les exemples du menu Fichier : tracer un carré, éviter les obstacles, suivre une ligne, piloter avec la télécommande. Bonne programmation !',
    },
];
let ETAPES = ETAPES_GENERAL;

// ---------- interface ----------
let actif = false;
let indice = 0;
let voile = null, spot = null, bulle = null, minuteur = null, attenteFaite = false, clicAttendu = false;

function creer() {
    voile = document.createElement('div');
    voile.id = 'tuto-voile';
    spot = document.createElement('div');
    spot.id = 'tuto-spot';
    bulle = document.createElement('div');
    bulle.id = 'tuto-bulle';
    bulle.setAttribute('role', 'dialog');
    bulle.setAttribute('aria-live', 'polite');
    bulle.innerHTML =
        '<div id="tuto-compteur"></div>' +
        '<h4 id="tuto-titre"></h4>' +
        '<p id="tuto-texte"></p>' +
        '<p id="tuto-consigne"></p>' +
        '<p id="tuto-fait">✔ Bien joué !</p>' +
        '<div id="tuto-boutons">' +
        '<button id="tuto-quitter" class="btn-vue">Quitter</button>' +
        '<span id="tuto-nav">' +
        '<button id="tuto-precedent" class="btn-vue">← Précédent</button>' +
        '<button id="tuto-suivant" class="btn-vue">Suivant →</button>' +
        '</span></div>';
    document.body.append(voile, spot, bulle);
    $('#tuto-quitter', bulle).addEventListener('click', arreter);
    $('#tuto-precedent', bulle).addEventListener('click', () => aller(indice - 1));
    $('#tuto-suivant', bulle).addEventListener('click', () => (indice >= ETAPES.length - 1 ? arreter() : aller(indice + 1)));
}

function cibleDe(etape) {
    if (!etape.cible) return null;
    try {
        const c = typeof etape.cible === 'function' ? etape.cible() : $(etape.cible);
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return r.width > 0 && r.height > 0 ? c : null;
    } catch (erreur) {
        return null;
    }
}

function placer() {
    if (!actif) return;
    const etape = ETAPES[indice];
    const c = cibleDe(etape);
    const vw = window.innerWidth, vh = window.innerHeight;
    const r0 = c ? c.getBoundingClientRect() : null;
    // Cadre de mise en evidence : marge reduite pour les petits elements serres (ligne de categorie, bouton),
    // sinon il deborde sur les voisins et semble les entourer aussi.
    const marge = r0 && r0.height < 40 ? 3 : 8;
    if (!c) {
        spot.style.display = 'none';
        voile.style.display = 'block';
        bulle.style.left = Math.max(12, (vw - bulle.offsetWidth) / 2) + 'px';
        bulle.style.top = Math.max(12, (vh - bulle.offsetHeight) / 3) + 'px';
        return;
    }
    voile.style.display = 'none';          // le voile est porte par l'ombre du cadre de mise en evidence
    const r = c.getBoundingClientRect();
    const x = Math.max(0, r.left - marge), y = Math.max(0, r.top - marge);
    const l = Math.min(vw - x, r.width + 2 * marge), h = Math.min(vh - y, r.height + 2 * marge);
    Object.assign(spot.style, { display: 'block', left: x + 'px', top: y + 'px', width: l + 'px', height: h + 'px' });
    const bw = bulle.offsetWidth, bh = bulle.offsetHeight;
    // Cote prefere : sous la cible, sinon au-dessus (alignee a gauche puis a droite), a droite, a gauche, sinon dans la cible.
    const essais = [
        [r.left, r.bottom + marge + 6],
        [r.left, r.top - bh - marge - 6],
        [r.right - bw, r.bottom + marge + 6],          // cible collee au bord droit : bulle alignee sur son bord droit
        [r.right - bw, r.top - bh - marge - 6],
        [r.right + marge + 6, r.top],
        [r.left - bw - marge - 6, r.top],
        [r.left + 16, r.top + 16],
    ];
    let pos = essais[essais.length - 1];
    for (const [px, py] of essais) {
        if (px >= 8 && py >= 8 && px + bw <= vw - 8 && py + bh <= vh - 8) { pos = [px, py]; break; }
    }
    bulle.style.left = Math.min(Math.max(8, pos[0]), Math.max(8, vw - bw - 8)) + 'px';
    bulle.style.top = Math.min(Math.max(8, pos[1]), Math.max(8, vh - bh - 8)) + 'px';
}

function aller(i) {
    if (i < 0 || i >= ETAPES.length) return;
    indice = i;
    attenteFaite = false;
    const etape = ETAPES[i];
    clicAttendu = false;
    if (etape.attendreClic) {
        const el = $(etape.attendreClic);
        if (el) el.addEventListener('click', () => { if (indice === i) clicAttendu = true; }, { once: true });
    }
    try { if (etape.avant) etape.avant(); } catch (erreur) { /* l'etape s'affiche quand meme */ }
    $('#tuto-compteur', bulle).textContent = i === 0 || i === ETAPES.length - 1 ? '' : 'Étape ' + i + ' / ' + (ETAPES.length - 2);
    $('#tuto-titre', bulle).textContent = etape.titre;
    $('#tuto-texte', bulle).textContent = etape.texte;
    const consigne = $('#tuto-consigne', bulle);
    consigne.textContent = etape.consigne ? '👉 ' + etape.consigne : '';
    consigne.style.display = etape.consigne ? 'block' : 'none';
    $('#tuto-fait', bulle).style.display = 'none';
    $('#tuto-precedent', bulle).style.visibility = i === 0 ? 'hidden' : 'visible';
    const suivant = $('#tuto-suivant', bulle);
    suivant.textContent = i === 0 ? 'Commencer →' : i === ETAPES.length - 1 ? 'Terminer' : 'Suivant →';
    suivant.classList.remove('pret');
    // Les panneaux mettent un instant a s'ouvrir : on place la bulle apres leur mise en page.
    // Cible dans le panneau IA (a defilement) : on la ramene dans la zone visible, une seule fois par etape.
    setTimeout(placer, 150);
    placer();
    setTimeout(placer, 120);
    setTimeout(placer, 450);
}

function surveiller() {
    if (!actif) return;
    placer();
    const etape = ETAPES[indice];
    if ((etape.attendre || etape.attendreClic) && !attenteFaite) {
        let fait = false;
        try { fait = etape.attendreClic ? clicAttendu : !!etape.attendre(); } catch (erreur) { fait = false; }
        if (fait) {
            attenteFaite = true;
            $('#tuto-fait', bulle).style.display = 'block';
            $('#tuto-suivant', bulle).classList.add('pret');
            placer();
        }
    }
}

function demarrer(parcours) {
    if (actif) return;
    ETAPES = parcours || ETAPES_GENERAL;
    if (!voile) creer();
    actif = true;
    document.body.classList.add('tuto-actif');
    voile.style.display = spot.style.display = bulle.style.display = 'block';
    minuteur = setInterval(surveiller, 300);
    aller(0);
}

function arreter() {
    if (!actif) return;
    actif = false;
    clearInterval(minuteur);
    document.body.classList.remove('tuto-actif');
    voile.style.display = spot.style.display = bulle.style.display = 'none';
}

// Seule entree : menu Aide. (Re)demarre toujours la visite depuis le debut.
bouton('aide-visite').addEventListener('click', () => { arreter(); demarrer(ETAPES_GENERAL); });
window.addEventListener('resize', placer);
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !actif) return;
    if (menuContextuel() || bouton('aide-bloc').classList.contains('ouvert')) return;
    arreter();
}, true);
window.tutoTest = { demarrer, arreter, aller, etat: () => ({ actif, indice, attenteFaite }) };
