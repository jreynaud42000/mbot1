// bandeau.js — comportement du bandeau du haut : theme, contraste, saisons (decors), puces des categories,
// recherche de blocs. Repris des editeurs micro:bit (blockly_ts_mode_classe/bandeau.js), sans les parties propres
// a la micro:bit (selecteur de cartes, multi-editeur radio). Le theme Blockly suit les attributs de <html> (app.js).

const $ = id => document.getElementById(id);
const racine = document.documentElement;

// ---------- Affichage : theme et contraste (memorises dans themeApp / contrasteApp, comme les editeurs micro:bit) ----------
const themeClair = () => racine.dataset.theme === 'light';
const contrasteEleve = () => racine.dataset.contrast === 'high';
function choisirTheme(clair) {
    if (clair) racine.dataset.theme = 'light'; else delete racine.dataset.theme;
    try { localStorage.setItem('themeApp', clair ? 'light' : 'dark'); } catch (erreur) { /* navigation privee */ }
}
function choisirContraste(eleve) {
    if (eleve) racine.dataset.contrast = 'high'; else delete racine.dataset.contrast;
    try { localStorage.setItem('contrasteApp', eleve ? 'high' : 'normal'); } catch (erreur) { /* navigation privee */ }
}

// ---------- Affichage : theme de saison (Halloween, Noel, salon Educatech Expo) ----------
// Choix memorise dans saisonApp : aucune, halloween, noel, salon ou auto (selon la date). L'attribut data-saison
// est pose des le chargement par le petit script en tete de index.html ; un.js y accorde le theme Blockly.
// Un theme de saison est une variante du sombre en contraste normal : le choisir y ramene, et choisir
// le theme clair ou le contraste eleve revient a « Aucune ».
const SAISONS = ['aucune', 'halloween', 'noel', 'salon', 'auto'];
const SALON = { titre: 'Educatech Expo', dates: '2-4 déc. 2026', stand: 'K3' };   // a mettre a jour pour un autre salon
function saisonDuJour(d = new Date()) {
    const m = d.getMonth() + 1, j = d.getDate();
    if ((m === 10 && j >= 15) || (m === 11 && j <= 2)) return 'halloween';
    if (d.getFullYear() === 2026 && m === 12 && j >= 2 && j <= 4) return 'salon';   // meme regle qu'en tete de index.html
    return m === 12 ? 'noel' : '';
}
function choixSaison() {
    let choix = 'aucune';
    try { choix = localStorage.getItem('saisonApp') || 'aucune'; } catch (erreur) { /* navigation privee */ }
    return SAISONS.includes(choix) ? choix : 'aucune';
}
function appliquerSaison(choix) {
    try { localStorage.setItem('saisonApp', choix); } catch (erreur) { /* le choix ne survivra pas au rechargement */ }
    const saison = choix === 'auto' ? saisonDuJour() : (choix === 'aucune' ? '' : choix);
    if (saison) { racine.dataset.saison = saison; choisirTheme(false); choisirContraste(false); }
    else delete racine.dataset.saison;
    majCoches();
}
SAISONS.forEach(choix => {
    const b = $('aff-saison-' + choix);
    if (b) b.addEventListener('click', () => appliquerSaison(choix));
});
const quitterSaison = () => { if (choixSaison() !== 'aucune') appliquerSaison('aucune'); };

// Decorations : un repere dans le bandeau, juste apres le logo, et un calque sur la zone de programmation.
if ($('tb-logo') && !$('tb-saison')) {
    const repere = document.createElement('span');
    repere.id = 'tb-saison';
    repere.setAttribute('aria-hidden', 'true');
    $('tb-logo').after(repere);
}
// Dessins des decors (SVG dans la page, aucun fichier a telecharger) : Halloween « Nuit hantee », Noel « Village enneige ».
const svg = (classe, vue, contenu) => '<svg class="' + classe + '" viewBox="' + vue + '" aria-hidden="true">' + contenu + '</svg>';
function dessinToile() {   // toile d'araignee accrochee au coin haut droit
    const coin = [110, 0], bouts = [[8, 0], [12, 44], [38, 82], [74, 106], [110, 110]];
    let d = bouts.map(([x, y]) => 'M110 0 L' + x + ' ' + y).join(' ');
    for (const f of [0.28, 0.52, 0.76, 0.98]) {
        const pts = bouts.map(([x, y]) => [coin[0] + (x - coin[0]) * f, coin[1] + (y - coin[1]) * f]);
        d += ' M' + pts[0].join(' ');
        for (let i = 1; i < pts.length; i++) {
            const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
            d += ' Q' + ((ax + bx) / 2 + (coin[0] - (ax + bx) / 2) * 0.12) + ' ' + ((ay + by) / 2 + (coin[1] - (ay + by) / 2) * 0.12) + ' ' + bx + ' ' + by;
        }
    }
    return '<path d="' + d + '" fill="none" stroke="#e6e6e6" stroke-width="1"/>';
}
const citrouille = (x, y, s) => '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
    '<ellipse cx="12" cy="13" rx="11" ry="9" fill="#e8590c"/><ellipse cx="12" cy="13" rx="5" ry="9" fill="#fd7e14"/>' +
    '<rect x="10.5" y="1" width="3" height="5" rx="1" fill="#2b8a3e"/>' +
    '<path class="deco-lueur" d="M6 11 L9 9 L9 12Z M18 11 L15 9 L15 12Z M6 15 Q12 20 18 15 Q12 17 6 15Z" fill="#ffd43b"/></g>';
const chauve = (x, y, s) => '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><g class="chauve">' +
    '<path d="M0 4 C3 -2 7 -2 9 3 C10 1 11 1 12 3 C14 -2 18 -2 21 4 C18 3 16 5 15 7 C13 5 12 6 10.5 8 C9 6 8 5 6 7 C5 5 3 3 0 4Z" fill="#06030a" stroke="#ffd68a" stroke-opacity="0.55" stroke-width="0.6"/></g></g>';   // liseré clair : visibles sur la nuit
const sapin = (x, y, s) => '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
    '<path d="M10 0 L20 14 L15 14 L22 24 L-2 24 L5 14 L0 14Z" fill="#2b8a3e"/>' +
    '<path d="M10 0 L14 6 L6 6Z M5 14 L15 14 L16 16 L4 16Z M-2 24 L22 24 L20 21 L0 21Z" fill="#f1f6fb"/>' +
    '<rect x="8" y="24" width="4" height="4" fill="#6b3e1f"/></g>';
function dessinGuirlande() {   // fil en festons et ampoules qui clignotent, sur toute la largeur du bandeau
    const COULEURS = ['#ffd43b', '#4dabf7', '#ff6b6b', '#69db7c'];
    let fil = 'M0 2', ampoules = '';
    for (let i = 0; i < 100; i++) {
        const x = i * 36;
        fil += ' Q' + (x + 18) + ' 16 ' + (x + 36) + ' 2';
        ampoules += '<rect x="' + (x + 16) + '" y="8" width="4" height="4" fill="#495057"/>' +
            '<ellipse class="' + (i % 2 ? 'deco-lueur' : 'deco-lueur-2') + '" cx="' + (x + 18) + '" cy="17.5" rx="4.6" ry="6" fill="' + COULEURS[i % 4] + '"/>';
    }
    return '<path d="' + fil + '" fill="none" stroke="#212529" stroke-width="1.4"/>' + ampoules;
}
if ($('blockly-wrapper') && !$('deco-saison')) {
    const deco = document.createElement('div');
    deco.id = 'deco-saison';
    deco.setAttribute('aria-hidden', 'true');
    deco.innerHTML =
        '<div class="deco-halloween deco-brume"></div>' +
        svg('deco-halloween deco-lune', '0 0 70 70', '<circle cx="35" cy="35" r="30" fill="#ffe8a3"/>' +
            '<circle cx="26" cy="28" r="5" fill="#f2d47a"/><circle cx="44" cy="44" r="7" fill="#f2d47a"/><circle cx="46" cy="23" r="3" fill="#f2d47a"/>') +
        svg('deco-halloween deco-toile', '0 0 110 110', dessinToile()) +
        svg('deco-halloween deco-chauves', '0 0 280 110', chauve(200, 20, 2.2) + chauve(110, 50, 1.6) + chauve(30, 14, 1.2)) +
        svg('deco-halloween deco-manoir', '0 0 190 130',
            '<path d="M0 130 L0 70 L20 70 L20 40 L30 22 L40 40 L40 70 L60 70 L60 50 L95 18 L130 50 L130 70 L150 70 L150 30 L160 12 L170 30 L170 130Z" fill="#06030a"/>' +
            '<g fill="#ffd43b"><rect class="deco-lueur" x="27" y="48" width="6" height="8"/><rect class="deco-lueur-2" x="84" y="55" width="8" height="10"/>' +
            '<rect class="deco-lueur" x="99" y="55" width="8" height="10"/><rect class="deco-lueur-2" x="157" y="42" width="6" height="8"/>' +
            '<rect class="deco-lueur-2" x="68" y="88" width="8" height="10"/><rect class="deco-lueur" x="114" y="88" width="8" height="10"/></g>' +
            '<rect x="89" y="104" width="12" height="26" rx="6" fill="#ffa94d" opacity="0.8"/>') +
        svg('deco-halloween deco-citrouilles', '0 0 96 46', citrouille(0, 6, 1.8) + citrouille(50, 18, 1.25)) +
        '<div class="deco-noel deco-neige"></div><div class="deco-noel deco-neige deco-neige-2"></div><div class="deco-noel deco-neige deco-neige-3"></div>' +
        '<svg class="deco-noel deco-collines" viewBox="0 0 1000 70" preserveAspectRatio="none" aria-hidden="true">' +
            '<path d="M0 70 L0 40 Q120 10 260 34 T520 30 T780 26 T1000 32 L1000 70Z" fill="#dde9f5"/>' +
            '<path d="M0 70 L0 56 Q200 32 420 50 T1000 46 L1000 70Z" fill="#f5f9fd"/></svg>' +
        svg('deco-noel deco-sapins', '0 0 150 70', sapin(10, 26, 1.4) + sapin(62, 14, 1.9) + sapin(118, 32, 1.2)) +
        svg('deco-noel deco-etoile', '0 0 34 34', '<path class="deco-lueur" d="M17 1 L21 12 L33 12 L23.5 19 L27 31 L17 24 L7 31 L10.5 19 L1 12 L13 12Z" fill="#ffd43b"/>') +
        svg('deco-salon deco-circuit-haut', '0 0 320 190',
            '<g fill="none" stroke-width="2"><path class="deco-piste" d="M320 120 H250 V160 H190" stroke="#2bb3a0"/>' +
            '<path class="deco-piste" d="M320 176 H280 V140" stroke="#7b5cff" style="animation-delay:-1s"/>' +
            '<path class="deco-piste" d="M200 0 V40 H150 V90" stroke="#e0218a" style="animation-delay:-2s"/></g>' +
            '<g><circle class="deco-lueur" cx="190" cy="160" r="4" fill="#2bb3a0"/><circle class="deco-lueur-2" cx="280" cy="140" r="4" fill="#7b5cff"/>' +
            '<circle class="deco-lueur" cx="150" cy="90" r="4" fill="#e0218a"/></g>') +
        svg('deco-salon deco-circuit-bas', '0 0 260 120',
            '<g fill="none" stroke-width="2"><path class="deco-piste" d="M0 110 H60 V70 H130" stroke="#e0218a"/>' +
            '<path class="deco-piste" d="M0 30 H40 V50 H90" stroke="#2bb3a0" style="animation-delay:-1.5s"/></g>' +
            '<circle class="deco-lueur-2" cx="130" cy="70" r="4" fill="#e0218a"/><circle class="deco-lueur" cx="90" cy="50" r="4" fill="#2bb3a0"/>') +
        '<div class="deco-salon deco-badge-salon">' + SALON.titre + ' · ' + SALON.dates +
            '<b>Technologie Services</b><span class="stand">Stand ' + SALON.stand + '</span></div>' +
        '<div class="deco-salon deco-banniere-salon"><span>' +
            ('Programmez le robot mBot1 : essayez ! · Technologie Services · Stand ' + SALON.stand + ' · ' + SALON.titre + ' · ').repeat(4) +
            '</span></div>';
    $('blockly-wrapper').appendChild(deco);
}
if ($('toolbar') && !$('guirlande-saison')) {
    const guirlande = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    guirlande.id = 'guirlande-saison';
    guirlande.setAttribute('aria-hidden', 'true');
    guirlande.setAttribute('height', '26');
    guirlande.innerHTML = dessinGuirlande();
    $('toolbar').appendChild(guirlande);
}
function majRepereSaison() {
    const repere = $('tb-saison');
    if (repere) repere.textContent = { halloween: '🎃', noel: '🎄', salon: '🎓' }[racine.dataset.saison] || '';
}

function majCoches() {
    const bascule = (id, vrai) => { const b = $(id); if (b) b.classList.toggle('choisi', !!vrai); };
    bascule('aff-theme-clair', themeClair());
    bascule('aff-theme-sombre', !themeClair());
    bascule('aff-contraste-normal', !contrasteEleve());
    bascule('aff-contraste-eleve', contrasteEleve());
    const saison = choixSaison();
    SAISONS.forEach(choix => bascule('aff-saison-' + choix, saison === choix));
    majRepereSaison();
}
if ($('aff-theme-clair')) $('aff-theme-clair').addEventListener('click', () => { quitterSaison(); choisirTheme(true); });
if ($('aff-theme-sombre')) $('aff-theme-sombre').addEventListener('click', () => choisirTheme(false));
if ($('aff-contraste-normal')) $('aff-contraste-normal').addEventListener('click', () => choisirContraste(false));
if ($('aff-contraste-eleve')) $('aff-contraste-eleve').addEventListener('click', () => { quitterSaison(); choisirContraste(true); });
new MutationObserver(majCoches).observe(racine, { attributes: true, attributeFilter: ['data-theme', 'data-contrast', 'data-saison'] });
majCoches();

// ---------- Puces rondes de la colonne de categories ----------
// Blockly colore chaque categorie par la bordure gauche de sa ligne (rectangle). On recopie cette couleur dans
// --puce (variable CSS) pour dessiner une puce ronde a la place ; la bordure est supprimee par le CSS (index.html).
// La puce a EXACTEMENT la couleur des blocs de sa categorie (table PALETTE_CATEGORIES, un.js) ; une sous-categorie
// prend la couleur de sa categorie principale.
function colorerPuces() {
    document.querySelectorAll('.blocklyToolboxCategory .blocklyTreeRow').forEach(ligne => {
        const base = getComputedStyle(ligne).borderLeftColor;
        if (!base || ligne.dataset.puceBase === base) return;
        ligne.dataset.puceBase = base;
        ligne.style.setProperty('--puce', base);
    });
}
colorerPuces();
const boiteOutils = document.querySelector('.blocklyToolboxDiv');
if (boiteOutils) {
    // La boite a outils est reconstruite (panneau administrateur, changement de langue...) : on recolore.
    new MutationObserver(colorerPuces).observe(boiteOutils, { childList: true, subtree: true });
}

// ---------- Recherche de blocs (au-dessus de la premiere categorie) ----------
// Zone de saisie placee en haut de la colonne de categories. Elle cherche dans TOUS les blocs de la boite a outils
// d'origine (toutes categories, sous-categories comprises) et affiche les resultats dans le tiroir, comme une
// categorie : les blocs se prennent et se deposent normalement. Le texte cherche = ce qui s'affiche sur le bloc
// (« attendre ... secondes »), le nom de sa categorie et, en second rang, son texte d'aide.
// Variables et Fonctions (tiroirs generes a la volee) sont interroges a chaque recherche (voir blocsDynamiques).
const normaliser = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let indexBlocs = null;                 // [{ def, texte, aide, categorie }]

function parcourirBoite(contenus, chemin, sortie) {
    for (const e of contenus || []) {
        if (e.kind === 'category') parcourirBoite(e.contents, chemin.concat(e.name), sortie);
        else if (e.kind === 'block' && e.type) sortie.push({ def: e, chemin });
    }
}

function construireIndex() {
    const ws = window.workspace;
    const arbre = ws && ws.options && ws.options.languageTree;
    const brut = [];
    if (arbre) parcourirBoite(arbre.contents, [], brut);
    const aides = (window.aideBlocTest && window.aideBlocTest.AIDE_BLOCS) || {};
    const scratch = new Blockly.Workspace();
    const resultat = [];
    for (const { def, chemin } of brut) {
        let texte = '';
        try {
            const b = Blockly.serialization.blocks.append(def, scratch);
            texte = b.toString(200, '?');
            b.dispose(false);
        } catch (erreur) { texte = def.type; }
        const nomCategorie = chemin.map(c => c === 'Communication' ? 'Radio' : c).join(' ');
        resultat.push({ def, texte: normaliser(texte + ' ' + def.type.replace(/_/g, ' ')), aide: normaliser(aides[def.type] || ''), categorie: normaliser(nomCategorie) });
    }
    scratch.dispose();
    return resultat;
}

// Variables et Fonctions : tiroirs generes par Blockly a la volee (selon les variables et fonctions creees). On interroge
// les memes generateurs que la boite a outils a chaque recherche, pour que le bouton « Creer une variable… », les blocs
// de variables et les appels des fonctions deja definies soient trouvables.
// Mots que l'on pense a taper pour ces blocs mais qui ne figurent pas dans leur libelle francais (« definir x a », « incrementer »...).
const SYNONYMES_DYNAMIQUES = {
    variables_set: 'mettre definir affecter donner valeur variable',
    variables_get: 'variable valeur lire utiliser',
    math_change: 'changer ajouter augmenter incrementer variable',
    procedures_defnoreturn: 'creer definir nouvelle fonction procedure',
    procedures_defreturn: 'creer definir nouvelle fonction retour resultat renvoyer',
    procedures_ifreturn: 'retourner renvoyer si fonction',
    procedures_callnoreturn: 'appeler appel executer lancer fonction procedure',
    procedures_callreturn: 'appeler appel utiliser resultat fonction procedure',
};
function blocsDynamiques() {
    const ws = window.workspace;
    const liste = [];
    const ajouter = (generateur, categorie) => {
        let defs = [];
        try { defs = Blockly.utils.toolbox.convertFlyoutDefToJsonArray(generateur(ws)); } catch (erreur) { return; }
        const scratch = new Blockly.Workspace();
        try { ws.getAllVariables().forEach(v => scratch.createVariable(v.name, v.type, v.getId())); } catch (erreur) { /* variables absentes : texte de repli */ }
        for (const def of defs) {
            let texte = '';
            if (String(def.kind).toUpperCase() === 'BUTTON') {
                texte = String(def.text || '').replace(/%\{BKY_(\w+)\}/g, (m, cle) => (Blockly.Msg && Blockly.Msg[cle]) || '');   // %{BKY_NEW_VARIABLE} -> « Creer une variable… »
            } else {
                try {
                    const b = Blockly.Xml.domToBlock(def.blockxml, scratch);
                    texte = b.toString(200, '?');
                    b.dispose(false);
                } catch (erreur) { texte = ''; }
            }
            const synonymes = SYNONYMES_DYNAMIQUES[def.type] || (String(def.kind).toUpperCase() === 'BUTTON' ? 'nouvelle variable ajouter' : '');
            liste.push({ def, texte: normaliser(texte + ' ' + synonymes + ' ' + String(def.type || '').replace(/_/g, ' ')), aide: '', categorie: normaliser(categorie) });
        }
        scratch.dispose();
    };
    ajouter(Blockly.Variables.flyoutCategory, 'Variables');
    ajouter(Blockly.Procedures.flyoutCategory, 'Fonctions');
    return liste;
}

function chercherBlocs(requete) {
    const mots = normaliser(requete).split(/\s+/).filter(Boolean);
    if (!mots.length) return [];
    if (!indexBlocs) indexBlocs = construireIndex();
    const premier = [], second = [];
    for (const e of indexBlocs.concat(blocsDynamiques())) {
        const base = e.texte + ' ' + e.categorie;
        if (mots.every(m => base.includes(m))) premier.push(e);
        else if (e.aide && mots.every(m => (base + ' ' + e.aide).includes(m))) second.push(e);
    }
    return premier.concat(second).slice(0, 40).map(e => e.def);
}

const zoneRecherche = document.createElement('div');
zoneRecherche.id = 'recherche-blocs';
zoneRecherche.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">' +
    '<circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>' +
    '<input type="search" id="recherche-blocs-champ" placeholder="Rechercher un bloc…" autocomplete="off" spellcheck="false" ' +
    'aria-label="Rechercher un bloc" title="Tapez un mot (« avancer », « LED », « distance »…) : les blocs correspondants s\'affichent">';
const champRecherche = zoneRecherche.querySelector('input');

function installerRecherche() {
    const boite = document.querySelector('.blocklyToolboxDiv');
    if (!boite) return;
    if (zoneRecherche.parentElement === boite) return;
    boite.insertBefore(zoneRecherche, boite.firstChild);
    // La zone elargit la colonne apres l'injection : Blockly doit recalculer sa largeur, sinon le bord gauche des
    // blocs (et le tiroir) passe sous la colonne de categories.
    const toolbox = window.workspace && window.workspace.getToolbox && window.workspace.getToolbox();
    if (toolbox && toolbox.handleToolboxItemResize) toolbox.handleToolboxItemResize();
}

let minuterieRecherche = null;
function lancerRecherche() {
    const toolbox = window.workspace && window.workspace.getToolbox && window.workspace.getToolbox();
    if (!toolbox) return;
    const tiroir = toolbox.getFlyout && toolbox.getFlyout();
    if (!tiroir) return;
    const requete = champRecherche.value;
    if (!requete.trim()) {
        if (toolbox.clearSelection) toolbox.clearSelection();
        tiroir.autoClose = true;                 // comportement normal des categories
        tiroir.hide();
        return;
    }
    const blocs = chercherBlocs(requete);
    if (toolbox.clearSelection) toolbox.clearSelection();
    tiroir.autoClose = false;                    // le tiroir de resultats RESTE ouvert apres un depot (Echap ou effacer pour le fermer)
    tiroir.show(blocs.length ? blocs : [{ kind: 'label', text: 'Aucun bloc ne correspond à « ' + requete.trim() + ' »' }]);
}
champRecherche.addEventListener('input', () => { clearTimeout(minuterieRecherche); minuterieRecherche = setTimeout(lancerRecherche, 150); });
champRecherche.addEventListener('keydown', e => {
    if (e.key === 'Escape') { champRecherche.value = ''; lancerRecherche(); e.stopPropagation(); }
});
// Choisir une categorie vide la recherche (le tiroir montre alors cette categorie).
document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('.blocklyToolboxCategory')) {
        if (champRecherche.value) champRecherche.value = '';
        const toolbox = window.workspace && window.workspace.getToolbox && window.workspace.getToolbox();
        const tiroir = toolbox && toolbox.getFlyout && toolbox.getFlyout();
        if (tiroir) tiroir.autoClose = true;     // une categorie se referme apres un depot, comme avant
    }
}, true);

installerRecherche();
{
    const boite = document.querySelector('.blocklyToolboxDiv');
    // La boite a outils est reconstruite (panneau administrateur) : la zone de recherche doit rester en tete.
    if (boite) new MutationObserver(installerRecherche).observe(boite, { childList: true });
}
