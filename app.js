// app.js — editeur mBot1 : espace de blocs, boite a outils, themes, fichiers, code C++, console, aide.
// Meme ergonomie que les editeurs micro:bit (blockly_ts_mode_classe) et mBot2 (blocky_ts_mbot2) : blocs de la couleur
// de la puce de leur categorie, titres de groupe avec trait de separation, themes clair / sombre / contraste eleve / saisons.

(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const { genererArduino, genererSimu, CHAPEAUX, Arduino } = window.BLOCS_MBOT1;

    // ==========================================
    // 1. CONSOLE
    // ==========================================
    const sortie = $('console-sortie');
    window.consoleAjouterLigne = function (texte, classe) {
        const ligne = document.createElement('div');
        if (classe) ligne.className = classe;
        ligne.textContent = texte;
        sortie.appendChild(ligne);
        while (sortie.childNodes.length > 500) sortie.removeChild(sortie.firstChild);
        sortie.scrollTop = sortie.scrollHeight;
    };
    $('btn-console-effacer').addEventListener('click', () => { sortie.textContent = ''; });

    // ==========================================
    // 2. BOITE A OUTILS ET COULEURS
    // ==========================================
    // Une couleur par categorie, utilisee a la fois par la puce et par TOUS ses blocs. Aucune couleur en double.
    const PALETTE_CATEGORIES = {
        'Événements': '#f59f00',
        'Contrôle': '#e8590c',
        'Déplacements': '#1c7ed6',
        'Moteurs': '#0b7285',
        'Capteurs': '#2b8a3e',
        'Carte et télécommande': '#82c91e',
        'LED': '#f03e3e',
        'Son': '#be4bdb',
        'Ports RJ25': '#7048e8',
        'Ordinateur': '#868e96',
        'Logique': '#5c7cfa',
        'Maths': '#20c997',
        'Texte': '#a9746e',
        'Variables': '#e64980',
        'Fonctions': '#495057',
    };
    const BLOCS_PALETTE_SUPPLEMENTAIRES = {
        'Variables': ['variables_get', 'variables_set', 'math_change'],
        'Fonctions': ['procedures_defnoreturn', 'procedures_defreturn', 'procedures_callnoreturn', 'procedures_callreturn', 'procedures_ifreturn'],
    };
    // Texte fonce sur les blocs clairs (blanc a moins de 3:1, seuil WCAG), comme dans les editeurs micro:bit.
    (function texteSombreSurBlocsClairs() {
        const lum = hex => {
            const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
            return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        };
        const claires = Object.values(PALETTE_CATEGORIES).filter(h => 1.05 / (lum(h) + 0.05) < 3);
        if (!claires.length) return;
        const style = document.createElement('style');
        style.textContent = claires.map(h => ':root:not([data-contrast="high"]) g:has(> path.blocklyPath[fill="' + h + '" i]) > g > text.blocklyText:not(.blocklyDropdownText)')
            .join(',\n') + ' { fill: #1a1a1a; }';
        document.head.appendChild(style);
    })();

    const nb = (n) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
    const txt = (t) => ({ shadow: { type: 'text', fields: { TEXT: t } } });
    const bloc = (type, inputs, extra) => Object.assign({ kind: 'block', type }, inputs ? { inputs } : {}, extra || {});
    const titre = (texte, premier) => premier ? { kind: 'label', text: texte } : { kind: 'label', text: texte, 'web-class': 'groupe-flyout' };

    const TOOLBOX = {
        kind: 'categoryToolbox',
        contents: [
            { kind: 'category', name: 'Événements', contents: [
                titre('Début du programme', true),
                bloc('mb_demarrage'),
            ] },
            { kind: 'category', name: 'Contrôle', contents: [
                titre('Attendre', true),
                bloc('mb_attendre', { S: nb(1) }), bloc('mb_attendre_jusqua'),
                titre('Répéter'),
                bloc('mb_toujours'), bloc('controls_repeat_ext', { TIMES: nb(4) }), bloc('controls_whileUntil'),
                bloc('controls_for', { FROM: nb(1), TO: nb(10), BY: nb(1) }), bloc('controls_flow_statements'),
                titre('Conditions'),
                bloc('controls_if'), bloc('controls_if', null, { extraState: { hasElse: true } }),
            ] },
            { kind: 'category', name: 'Déplacements', contents: [
                titre('Pendant une durée', true),
                bloc('mb_avancer_pendant', { V: nb(50), T: nb(1) }),
                titre('Sans fin'),
                bloc('mb_mouvement', { V: nb(50) }), bloc('mb_roues', { G: nb(50), D: nb(50) }), bloc('mb_stop'),
            ] },
            { kind: 'category', name: 'Moteurs', contents: [
                titre('Moteurs M1 et M2', true),
                bloc('mb_moteur', { V: nb(50) }), bloc('mb_moteur_stop'),
            ] },
            { kind: 'category', name: 'Capteurs', contents: [
                titre('Ultrasons', true),
                bloc('mb_distance'),
                bloc('logic_compare', { A: { block: { type: 'mb_distance' } }, B: nb(20) }, { fields: { OP: 'LT' } }),
                titre('Suiveur de ligne'),
                bloc('mb_capteur_ligne'), bloc('mb_ligne_est'), bloc('mb_ligne_valeur'),
                titre('Lumière'),
                bloc('mb_lumiere'),
            ] },
            { kind: 'category', name: 'Carte et télécommande', contents: [
                titre('Bouton de la carte', true),
                bloc('mb_bouton'),
                titre('Télécommande infrarouge'),
                bloc('mb_ir'),
                titre('Chronomètre'),
                bloc('mb_chrono'), bloc('mb_chrono_raz'),
            ] },
            { kind: 'category', name: 'LED', contents: [
                titre('LED de la carte', true),
                bloc('mb_led_couleur'), bloc('mb_led_rvb', { R: nb(255), V: nb(0), B: nb(0) }), bloc('mb_led_eteindre'),
            ] },
            { kind: 'category', name: 'Son', contents: [
                titre('Buzzer de la carte', true),
                bloc('mb_son_note'), bloc('mb_son_frequence', { F: nb(440), T: nb(0.5) }),
            ] },
            { kind: 'category', name: 'Ports RJ25', contents: [
                titre('Lire une broche', true),
                bloc('mb_port_analogique'), bloc('mb_port_numerique'),
                titre('Écrire sur une broche'),
                bloc('mb_port_ecrire'),
            ] },
            { kind: 'category', name: 'Ordinateur', contents: [
                titre('Console (câble USB)', true),
                bloc('mb_print', { TEXTE: txt('mesure') }),
                bloc('mb_print', { TEXTE: { block: { type: 'text_join', inputs: { ADD0: txt('distance : '), ADD1: { block: { type: 'mb_distance' } } } } } }),
            ] },
            { kind: 'sep' },
            { kind: 'category', name: 'Logique', contents: [
                bloc('logic_compare', { B: nb(0) }), bloc('logic_operation'), bloc('logic_negate'), bloc('logic_boolean'),
            ] },
            { kind: 'category', name: 'Maths', contents: [
                bloc('math_number'), bloc('math_arithmetic', { A: nb(1), B: nb(1) }),
                bloc('math_random_int', { FROM: nb(1), TO: nb(10) }), bloc('math_round', { NUM: nb(3.1) }),
                bloc('math_single', { NUM: nb(9) }), bloc('math_modulo', { DIVIDEND: nb(10), DIVISOR: nb(3) }),
                bloc('math_constrain', { VALUE: nb(50), LOW: nb(0), HIGH: nb(100) }),
            ] },
            { kind: 'category', name: 'Texte', contents: [
                bloc('text'), bloc('text_join'), bloc('text_length', { VALUE: txt('mBot1') }),
            ] },
            { kind: 'category', name: 'Variables', custom: 'VARIABLE' },
            { kind: 'category', name: 'Fonctions', custom: 'PROCEDURE' },
        ],
    };

    function appliquerPalette(toolbox) {
        const parType = {};
        // A l'envers : un bloc general montre aussi dans une categorie du robot (« distance < 20 » dans Capteurs)
        // garde la couleur de sa categorie d'origine (Logique), placee plus bas.
        for (const cat of toolbox.contents.slice().reverse()) {
            if (cat.kind !== 'category') continue;
            const couleur = PALETTE_CATEGORIES[cat.name];
            cat.colour = couleur;
            for (const type of BLOCS_PALETTE_SUPPLEMENTAIRES[cat.name] || []) parType[type] = parType[type] || couleur;
            for (const e of cat.contents || []) if (e.kind === 'block' && !parType[e.type]) parType[e.type] = couleur;
        }
        for (const [type, couleur] of Object.entries(parType)) {
            const def = Blockly.Blocks[type];
            if (!def || def.__palette) continue;
            const init = def.init;
            def.init = function () { init.apply(this, arguments); this.setColour(couleur); };
            def.__palette = true;
        }
        return toolbox;
    }

    // ==========================================
    // 3. THEMES BLOCKLY
    // ==========================================
    const POLICE_BLOCS = { family: 'sans-serif', weight: 'normal', size: 11 };
    const theme = (nom, base, styles) => Blockly.Theme.defineTheme(nom, { base, fontStyle: POLICE_BLOCS, componentStyles: styles });
    const THEME_SOMBRE = theme('sombreMbot1', Blockly.Themes.Classic, {
        workspaceBackgroundColour: '#1e1f23', toolboxBackgroundColour: '#141517', toolboxForegroundColour: '#dddddd',
        flyoutBackgroundColour: '#2a2c31', flyoutForegroundColour: '#b5b8bf', flyoutOpacity: 1, scrollbarColour: '#5a5e66',
        insertionMarkerColour: '#ffffff', insertionMarkerOpacity: 0.3, cursorColour: '#ffffff' });
    const THEME_SOMBRE_ELEVE = theme('sombreEleveMbot1', Blockly.Themes.Classic, {
        workspaceBackgroundColour: '#000000', toolboxBackgroundColour: '#000000', toolboxForegroundColour: '#ffffff',
        flyoutBackgroundColour: '#000000', flyoutForegroundColour: '#ffffff', flyoutOpacity: 1, scrollbarColour: '#ffffff',
        insertionMarkerColour: '#ffffff', insertionMarkerOpacity: 0.5, cursorColour: '#ffffff' });
    const THEME_CLAIR_ELEVE = theme('clairEleveMbot1', Blockly.Themes.Classic, {
        workspaceBackgroundColour: '#ffffff', toolboxBackgroundColour: '#ffffff', toolboxForegroundColour: '#000000',
        flyoutBackgroundColour: '#ffffff', flyoutForegroundColour: '#000000', flyoutOpacity: 1, scrollbarColour: '#000000',
        insertionMarkerColour: '#000000', insertionMarkerOpacity: 0.3, cursorColour: '#000000' });
    const THEME_CLAIR = theme('clairMbot1', Blockly.Themes.Classic, {
        workspaceBackgroundColour: '#ffffff', toolboxBackgroundColour: '#2e2e2e', toolboxForegroundColour: '#dddddd',
        flyoutBackgroundColour: '#d9d9d9', flyoutForegroundColour: '#555555', flyoutOpacity: 1 });
    const THEMES_SAISON = {
        halloween: theme('halloweenMbot1', THEME_SOMBRE, { workspaceBackgroundColour: '#141414', toolboxBackgroundColour: '#0f0d12', flyoutBackgroundColour: '#1f1a24', scrollbarColour: '#6b4a80' }),
        noel: theme('noelMbot1', THEME_SOMBRE, { workspaceBackgroundColour: '#0d1b2a', toolboxBackgroundColour: '#08131f', flyoutBackgroundColour: '#13263a', scrollbarColour: '#4a6a8a' }),
        salon: theme('salonMbot1', THEME_SOMBRE, { workspaceBackgroundColour: '#12163a', toolboxBackgroundColour: '#0c1030', flyoutBackgroundColour: '#171c47', scrollbarColour: '#4b5bb0' }),
    };
    const racine = document.documentElement;
    function themeCourant() {
        const clair = racine.dataset.theme === 'light', eleve = racine.dataset.contrast === 'high';
        if (clair) return eleve ? THEME_CLAIR_ELEVE : THEME_CLAIR;
        return eleve ? THEME_SOMBRE_ELEVE : (THEMES_SAISON[racine.dataset.saison] || THEME_SOMBRE);
    }

    // ==========================================
    // 4. ESPACE DE TRAVAIL
    // ==========================================
    const ws = Blockly.inject('blocklyDiv', {
        media: 'lib/blockly/media/',
        toolbox: appliquerPalette(TOOLBOX),
        theme: themeCourant(),
        zoom: { controls: true, wheel: true, pinch: true, startScale: 0.95, minScale: 0.3, maxScale: 3, scaleSpeed: 1.2 },
        move: { scrollbars: true, drag: true, wheel: false },
        grid: { spacing: 20, length: 3, colour: '#e8e8e8', snap: true },
        trashcan: true,
        maxInstances: { mb_demarrage: 1 },
    });
    window.workspace = ws;
    new MutationObserver(() => ws.setTheme(themeCourant()))
        .observe(racine, { attributes: true, attributeFilter: ['data-theme', 'data-contrast', 'data-saison'] });
    if (window.ResizeObserver) new ResizeObserver(() => Blockly.svgResize(ws)).observe($('blocklyDiv'));

    // Trait au-dessus des titres de groupe du tiroir (titres « groupe-flyout »).
    const tiroir = ws.getToolbox() && ws.getToolbox().getFlyout();
    if (tiroir) {
        const afficher = tiroir.show.bind(tiroir);
        tiroir.show = function (contenu) {
            afficher(contenu);
            const largeur = tiroir.getWidth ? tiroir.getWidth() : 0;
            tiroir.getWorkspace().getCanvas().querySelectorAll('.groupe-flyout').forEach(t => {
                if (t.querySelector('.trait-groupe-flyout')) return;
                const m = t.transform.baseVal.consolidate(), x = m ? m.matrix.e : 0;
                t.insertBefore(Blockly.utils.dom.createSvgElement('line', { class: 'trait-groupe-flyout', x1: 0, y1: -12, x2: Math.max(40, largeur - 2 * x), y2: -12 }, null), t.firstChild);
            });
        };
    }

    // Un bloc pose hors du programme ne s'execute jamais : il est grise (meme regle que les editeurs micro:bit).
    const estRacine = b => CHAPEAUX.includes(b.type) || b.type.startsWith('procedures_def');
    // Seul le bloc du haut d'une pile orpheline est grise (ses enfants le sont par heritage) ; un bloc grise
    // automatiquement (__griseAuto) redevient actif des qu'il est accroche sous le debut du programme ou une fonction.
    function griserOrphelins() {
        for (const b of ws.getAllBlocks(false)) {
            const haut = b.getRootBlock();
            if (b === haut && !estRacine(b)) {
                if (b.isEnabled()) { b.setEnabled(false); b.__griseAuto = true; }
            } else if (b.__griseAuto) {
                b.setEnabled(true); b.__griseAuto = false;
            }
        }
    }

    // ==========================================
    // 5. CODE C++
    // ==========================================
    const MOTS_CLES = /\b(void|int|long|unsigned|float|double|bool|char|String|if|else|for|while|do|return|break|continue|true|false|HIGH|LOW)\b/g;
    function colorer(code) {
        const echapper = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return code.split('\n').map(ligne => {
            if (/^\s*#/.test(ligne)) return '<span class="deco">' + echapper(ligne) + '</span>';
            const i = ligne.search(/\/\/(?=(?:[^"]|"(?:[^"\\]|\\.)*")*$)/);
            const corps = i >= 0 ? ligne.slice(0, i) : ligne, com = i >= 0 ? ligne.slice(i) : '';
            const morceaux = corps.split(/("(?:[^"\\]|\\.)*")/);
            const html = morceaux.map((m, k) => k % 2 ? '<span class="str">' + echapper(m) + '</span>'
                : echapper(m).replace(MOTS_CLES, '<span class="kw">$1</span>').replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="num">$1</span>')).join('');
            return html + (com ? '<span class="com">' + echapper(com) + '</span>' : '');
        }).join('\n');
    }
    let codeArduino = '';
    window.codeArduinoCourant = () => codeArduino;
    function majCode() {
        try { codeArduino = genererArduino(ws); } catch (e) { codeArduino = '// Erreur de génération : ' + e.message + '\n'; console.error(e); }
        $('code-display').innerHTML = colorer(codeArduino);
    }
    $('btn-copier-code').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(codeArduino); window.consoleAjouterLigne('Code C++ copié dans le presse-papiers.', 'info'); }
        catch (e) { window.consoleAjouterLigne('Copie impossible : sélectionnez le code à la main.', 'err'); }
    });

    // ==========================================
    // 6. SAUVEGARDE : fichier .ino (code + blocs) et sauvegarde automatique
    // ==========================================
    // Le fichier .ino est un vrai programme Arduino (on peut l'ouvrir dans l'IDE Arduino avec la bibliotheque Makeblock) ;
    // les blocs y sont ajoutes en derniere ligne, dans un commentaire, pour pouvoir les retrouver a l'ouverture.
    const MARQUE = '// blocs-mbot1:';
    const CLE_AUTO = 'mbot1_espace_v1';
    const enBase64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
    const deBase64 = s => new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
    const nomProgramme = () => ($('nom-fichier').value.trim() || 'mon_programme').replace(/[\\/:*?"<>|]/g, '_');

    function enregistrer() {
        majCode();
        const etat = JSON.stringify({ nom: nomProgramme(), blocs: Blockly.serialization.workspaces.save(ws) });
        const contenu = codeArduino + '\n' + MARQUE + enBase64(etat) + '\n';
        const lien = document.createElement('a');
        lien.href = URL.createObjectURL(new Blob([contenu], { type: 'text/plain;charset=utf-8' }));
        lien.download = nomProgramme() + '.ino';
        document.body.appendChild(lien); lien.click(); lien.remove();
        setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
        window.consoleAjouterLigne('Programme enregistré : ' + lien.download + ' (dossier Téléchargements).', 'ok');
    }
    function chargerEtat(etat) {
        Blockly.Events.disable();
        try { ws.clear(); Blockly.serialization.workspaces.load(etat.blocs, ws); }
        finally { Blockly.Events.enable(); }
        for (const b of ws.getAllBlocks(false)) if (!b.isEnabled()) b.__griseAuto = true;   // grises par l'editeur avant l'enregistrement
        if (etat.nom) $('nom-fichier').value = etat.nom;
        griserOrphelins(); majCode(); sauverAuto();
        const cadre = ws.getBlocksBoundingBox(), z = ws.getScale();   // coin haut gauche du programme visible, pres de la boite a outils
        ws.scroll(20 - cadre.left * z, 20 - cadre.top * z);
    }
    function ouvrir(fichier) {
        const lecteur = new FileReader();
        lecteur.onload = () => {
            const ligne = String(lecteur.result).split('\n').find(l => l.startsWith(MARQUE));
            if (!ligne) {
                window.consoleAjouterLigne('« ' + fichier.name + ' » ne contient pas de blocs : seuls les fichiers enregistrés par cet éditeur peuvent être rouverts en blocs.', 'err');
                return;
            }
            try {
                chargerEtat(JSON.parse(deBase64(ligne.slice(MARQUE.length).trim())));
                $('nom-fichier').value = $('nom-fichier').value || fichier.name.replace(/\.ino$/i, '');
                window.consoleAjouterLigne('Programme ouvert : ' + fichier.name, 'ok');
            } catch (e) { window.consoleAjouterLigne('Fichier illisible : ' + e.message, 'err'); }
        };
        lecteur.readAsText(fichier, 'utf-8');
    }
    let minuterieAuto = null;
    function sauverAuto() {
        clearTimeout(minuterieAuto);
        minuterieAuto = setTimeout(() => {
            try { localStorage.setItem(CLE_AUTO, JSON.stringify({ nom: nomProgramme(), blocs: Blockly.serialization.workspaces.save(ws) })); }
            catch (e) { /* navigation privee ou stockage plein : pas de sauvegarde automatique */ }
        }, 400);
    }

    // ==========================================
    // 7. EXEMPLES ET ESPACE DE DEPART
    // ==========================================
    const n = v => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
    const chaine = (...blocs) => { for (let i = blocs.length - 2; i >= 0; i--) blocs[i].next = { block: blocs[i + 1] }; return blocs[0]; };
    const B = (type, fields, inputs, extraState) => Object.assign({ type }, fields ? { fields } : {}, inputs ? { inputs } : {}, extraState ? { extraState } : {});
    const depart = (...suite) => ({ blocks: { languageVersion: 0, blocks: [Object.assign(B('mb_demarrage'), { x: 40, y: 40 }, suite.length ? { next: { block: chaine(...suite) } } : {})] } });
    const toujours = (contenu) => B('mb_toujours', null, { DO: { block: contenu } });
    const EXEMPLES = {
        vide: { nom: 'mon_programme', piste: null, blocs: depart(B('mb_led_couleur', { LED: '0', COULEUR: '#00ff00' })) },
        // Pas d'encodeur sur le mBot1 : les virages se reglent par la duree (0,33 s a 50 % ≈ un quart de tour dans le simulateur).
        carre: { nom: 'carre', piste: 'libre', blocs: depart(
            B('controls_repeat_ext', null, { TIMES: n(4), DO: { block: chaine(
                B('mb_avancer_pendant', { SENS: 'forward' }, { V: n(50), T: n(1) }),
                B('mb_avancer_pendant', { SENS: 'turn_right' }, { V: n(50), T: n(0.33) })) } }),
            B('mb_son_note', { NOTE: '523', DUREE: '0.5' })) },
        obstacle: { nom: 'eviter_obstacles', piste: 'obstacles', blocs: depart(
            toujours(B('controls_if', null, {
                IF0: { block: B('logic_compare', { OP: 'LT' }, { A: { block: B('mb_distance', { PORT: '3' }) }, B: n(20) }) },
                DO0: { block: chaine(B('mb_led_couleur', { LED: '0', COULEUR: '#ff0000' }),
                    B('mb_avancer_pendant', { SENS: 'turn_right' }, { V: n(50), T: n(0.4) })) },
                ELSE: { block: chaine(B('mb_led_couleur', { LED: '0', COULEUR: '#00ff00' }),
                    B('mb_mouvement', { SENS: 'forward' }, { V: n(50) })) },
            }, { hasElse: true }))) },
        ligne: { nom: 'suivre_ligne', piste: 'ovale', blocs: depart(
            toujours(B('controls_if', null, {
                IF0: { block: B('mb_ligne_est', { ETAT: '0', PORT: '2' }) },
                DO0: { block: B('mb_roues', null, { G: n(40), D: n(40) }) },
                IF1: { block: B('mb_ligne_est', { ETAT: '1', PORT: '2' }) },
                DO1: { block: B('mb_roues', null, { G: n(5), D: n(40) }) },
                IF2: { block: B('mb_ligne_est', { ETAT: '2', PORT: '2' }) },
                DO2: { block: B('mb_roues', null, { G: n(40), D: n(5) }) },
                ELSE: { block: B('mb_roues', null, { G: n(-30), D: n(-30) }) },
            }, { elseIfCount: 2, hasElse: true }))) },
        lumieres: { nom: 'lumieres_et_sons', piste: null, blocs: depart(
            B('mb_led_couleur', { LED: '1', COULEUR: '#ff0000' }), B('mb_led_couleur', { LED: '2', COULEUR: '#0066ff' }),
            B('mb_son_note', { NOTE: '262', DUREE: '0.25' }), B('mb_son_note', { NOTE: '330', DUREE: '0.25' }), B('mb_son_note', { NOTE: '392', DUREE: '0.5' }),
            toujours(chaine(
                B('mb_attendre_jusqua', null, { COND: { block: B('mb_bouton') } }),
                B('mb_led_rvb', { LED: '0' }, { R: { block: B('math_random_int', null, { FROM: n(0), TO: n(255) }) },
                    V: { block: B('math_random_int', null, { FROM: n(0), TO: n(255) }) }, B: { block: B('math_random_int', null, { FROM: n(0), TO: n(255) }) } }),
                B('mb_son_frequence', null, { F: n(880), T: n(0.1) }),
                B('mb_attendre_jusqua', null, { COND: { block: B('logic_negate', null, { BOOL: { block: B('mb_bouton') } }) } })))) },
        telecommande: { nom: 'telecommande', piste: 'libre', blocs: depart(
            toujours(B('controls_if', null, {
                IF0: { block: B('mb_ir', { TOUCHE: '64' }) }, DO0: { block: B('mb_mouvement', { SENS: 'forward' }, { V: n(60) }) },
                IF1: { block: B('mb_ir', { TOUCHE: '25' }) }, DO1: { block: B('mb_mouvement', { SENS: 'backward' }, { V: n(60) }) },
                IF2: { block: B('mb_ir', { TOUCHE: '7' }) }, DO2: { block: B('mb_mouvement', { SENS: 'turn_left' }, { V: n(40) }) },
                IF3: { block: B('mb_ir', { TOUCHE: '9' }) }, DO3: { block: B('mb_mouvement', { SENS: 'turn_right' }, { V: n(40) }) },
                ELSE: { block: B('mb_stop') },
            }, { elseIfCount: 3, hasElse: true }))) },
    };

    function chargerExemple(cle) {
        const ex = EXEMPLES[cle];
        chargerEtat({ nom: ex.nom, blocs: ex.blocs });
        if (ex.piste) { $('choix-piste').value = ex.piste; window.Simulateur.chargerPiste(ex.piste); }
    }

    // ==========================================
    // 8. MENUS, BOUTONS DU BANDEAU, PANNEAUX
    // ==========================================
    document.querySelectorAll('[data-menu]').forEach(bouton => {
        const panneau = $(bouton.dataset.menu);
        bouton.addEventListener('click', e => {
            e.stopPropagation();
            const ouvert = panneau.classList.contains('open');
            document.querySelectorAll('.tb-dropdown-menu.open').forEach(p => p.classList.remove('open'));
            if (!ouvert) panneau.classList.add('open');
        });
        panneau.addEventListener('click', e => { if (e.target.closest('button')) panneau.classList.remove('open'); });
    });
    document.addEventListener('click', () => document.querySelectorAll('.tb-dropdown-menu.open').forEach(p => p.classList.remove('open')));

    $('fichier-nouveau').addEventListener('click', () => {
        if (ws.getAllBlocks(false).length > 1 && !confirm('Effacer le programme actuel et en commencer un nouveau ?')) return;
        chargerExemple('vide');
    });
    $('fichier-ouvrir').addEventListener('click', () => $('fichier-entree').click());
    $('fichier-entree').addEventListener('change', e => { if (e.target.files[0]) ouvrir(e.target.files[0]); e.target.value = ''; });
    $('fichier-enregistrer').addEventListener('click', enregistrer);
    document.querySelectorAll('[data-exemple]').forEach(b => b.addEventListener('click', () => {
        if (ws.getAllBlocks(false).length > 1 && !confirm('Remplacer le programme actuel par l\'exemple « ' + b.textContent + ' » ?')) return;
        chargerExemple(b.dataset.exemple);
    }));
    $('nom-fichier').addEventListener('input', sauverAuto);
    $('btn-annuler').addEventListener('click', () => ws.undo(false));
    $('btn-refaire').addEventListener('click', () => ws.undo(true));

    function basculer(idBouton, idPanneau, cle) {
        const bouton = $(idBouton), panneau = $(idPanneau);
        const appliquer = (visible) => {
            panneau.classList.toggle('replie', !visible);
            bouton.classList.toggle('inactif', !visible);
            try { localStorage.setItem(cle, visible ? '1' : '0'); } catch (e) { /* navigation privee */ }
            Blockly.svgResize(ws);
        };
        let visible = !panneau.classList.contains('replie');
        try { const m = localStorage.getItem(cle); if (m !== null) visible = m === '1'; } catch (e) { /* defaut */ }
        appliquer(visible);
        bouton.addEventListener('click', () => appliquer(panneau.classList.contains('replie')));
    }
    basculer('btn-vue-simu', 'simulator-container', 'mbot1_vue_simu');
    basculer('btn-vue-code', 'code-container', 'mbot1_vue_code');
    basculer('btn-vue-console', 'console-panneau', 'mbot1_vue_console');

    // Lancer / arreter la simulation
    const lancer = $('tb-lancer');
    function majLancer() {
        const enCours = window.Simulateur.enCours();
        lancer.classList.toggle('running', enCours);
        $('tb-lancer-label').textContent = enCours ? 'Arrêter' : 'Lancer la simulation';
        $('tb-lancer-icone').innerHTML = enCours ? '<rect x="5" y="5" width="14" height="14" rx="1"/>' : '<polygon points="5,3 19,12 5,21"/>';
    }
    lancer.addEventListener('click', () => {
        if (window.Simulateur.enCours()) window.Simulateur.arreter();
        else {
            if ($('simulator-container').classList.contains('replie')) $('btn-vue-simu').click();
            window.Simulateur.lancer(genererSimu(ws));
        }
        majLancer();
    });

    // ==========================================
    // 9. AIDE
    // ==========================================
    let exempleAffiche = null;
    function ouvrirAide(titre, html, exemple) {
        $('aide-titre').textContent = titre;
        $('aide-contenu').innerHTML = html;
        exempleAffiche = exemple || null;
        $('aide-exemple').hidden = !exemple;
        $('aide-inserer').hidden = !exemple;
        if (exemple) {
            $('aide-exemple-titre').textContent = 'Exemple : ' + exemple.titre;
            $('aide-exemple-desc').textContent = exemple.texte;
            $('aide-exemple-code').textContent = codeExemple(exemple);
            $('aide-exemple-details').open = false;
        }
        $('aide-bloc').classList.add('ouvert');
        if (exemple) afficherExempleEnBlocs(exemple);   // apres l'ouverture : Blockly mesure son conteneur, qui doit etre visible
        $('aide-fermer').focus();
    }
    const fermerAide = () => $('aide-bloc').classList.remove('ouvert');
    $('aide-fermer').addEventListener('click', fermerAide);
    $('aide-bloc').addEventListener('keydown', e => { if (e.key === 'Escape') fermerAide(); });
    $('aide-bloc').addEventListener('mousedown', e => { if (e.target === $('aide-bloc')) fermerAide(); });
    $('aide-inserer').addEventListener('click', () => { if (exempleAffiche) { insererExemple(exempleAffiche); fermerAide(); } });

    // Exemple d'un bloc (exemples_aide.js), repris de l'editeur mBot2 : petit espace Blockly en lecture seule,
    // cree une fois puis reutilise, au theme de l'editeur.
    const piles = ex => JSON.parse(JSON.stringify(ex.blocs)).map((b, i) => Object.assign(b, { x: 0, y: i * 1000 }));
    let espaceExemple = null;
    function afficherExempleEnBlocs(ex) {
        const conteneur = $('aide-exemple-blocs');
        try {
            if (!espaceExemple) {
                espaceExemple = Blockly.inject(conteneur, {
                    media: 'lib/blockly/media/', theme: themeCourant(),
                    readOnly: true, sounds: false, trashcan: false,
                    zoom: { controls: false, wheel: false, pinch: false, startScale: 1 },
                    move: { scrollbars: true, drag: true, wheel: false },
                });
                // inject() fait de ce petit espace l'espace « principal » de Blockly (copier-coller, annulation) :
                // ce role revient au vrai programme.
                Blockly.common.setMainWorkspace(ws);
                new MutationObserver(() => espaceExemple.setTheme(themeCourant()))
                    .observe(racine, { attributes: true, attributeFilter: ['data-theme', 'data-contrast', 'data-saison'] });
            }
            espaceExemple.clear();
            espaceExemple.setScale(1);
            Blockly.svgResize(espaceExemple);
            Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: piles(ex) } }, espaceExemple);
            let y = 0;   // piles rangees les unes sous les autres
            for (const b of espaceExemple.getTopBlocks(true)) {
                const pos = b.getRelativeToSurfaceXY();
                b.moveBy(-pos.x, y - pos.y);
                y += b.getHeightWidth().height + 24;
            }
            // Echelle reduite si le programme depasse la zone, pour le voir en entier.
            const zone = espaceExemple.getBlocksBoundingBox();
            const echelle = Math.max(0.4, Math.min(1, (conteneur.clientWidth - 24) / (zone.right - zone.left),
                                                      (conteneur.clientHeight - 24) / (zone.bottom - zone.top)));
            espaceExemple.setScale(echelle);
            espaceExemple.scroll(12 - zone.left * echelle, 12 - zone.top * echelle);
        } catch (e) {
            console.error('Exemple en blocs :', e);
        }
    }
    /** Code C++ de l'exemple, calcule dans un espace temporaire (le programme en cours n'est pas touche). */
    function codeExemple(ex) {
        const espace = new Blockly.Workspace();
        try {
            Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: piles(ex) } }, espace);
            return genererArduino(espace).trim();
        } catch (e) {
            console.error('Code de l\'exemple :', e);
            return '';
        } finally {
            espace.dispose();
            majCode();   // le generateur C++ est partage : on le remet sur le vrai programme
        }
    }
    /**
     * Ajoute l'exemple sous les blocs existants, en un seul pas d'annulation (Ctrl+Z). « quand le programme démarre »
     * est unique : si le programme en a deja un, les blocs de l'exemple s'ajoutent a la fin du sien.
     */
    function insererExemple(ex) {
        let x = 40, y = 40;
        const existants = ws.getTopBlocks(false);
        if (existants.length) {
            const zones = existants.map(b => b.getBoundingRectangle());
            x = Math.min(...zones.map(r => r.left));
            y = Math.max(...zones.map(r => r.bottom)) + 60;
        }
        let premier = null, nonAccroche = false;
        Blockly.Events.setGroup(true);
        try {
            for (const def of piles(ex)) {
                const demarrage = def.type === 'mb_demarrage' && ws.getBlocksByType('mb_demarrage', false)[0];
                if (demarrage) {
                    if (!def.next) continue;
                    let dernier = demarrage;
                    while (dernier.getNextBlock()) dernier = dernier.getNextBlock();
                    const b = Blockly.serialization.blocks.append(def.next.block, ws, { recordUndo: true });
                    if (dernier.nextConnection && b.previousConnection) dernier.nextConnection.connect(b.previousConnection);
                    else {   // « répéter indéfiniment » termine deja la pile : rien ne peut s'accrocher dessous
                        const pos = b.getRelativeToSurfaceXY();
                        b.moveBy(x - pos.x, y - pos.y); y = b.getBoundingRectangle().bottom + 40;
                        nonAccroche = true;
                    }
                    premier = premier || b;
                    continue;
                }
                const b = Blockly.serialization.blocks.append(def, ws, { recordUndo: true });
                const pos = b.getRelativeToSurfaceXY();
                b.moveBy(x - pos.x, y - pos.y);
                y = b.getBoundingRectangle().bottom + 40;
                premier = premier || b;
            }
        } finally {
            Blockly.Events.setGroup(false);
        }
        griserOrphelins();
        if (nonAccroche) window.consoleAjouterLigne('Exemple ajouté à part (grisé) : votre « quand le programme démarre » se termine par « répéter indéfiniment ». ' +
            'Déplacez les blocs de l\'exemple là où vous les voulez.', 'info');
        if (premier) {
            try { ws.centerOnBlock(premier.id); } catch (e) { /* le centrage n'est qu'un confort */ }
            premier.select();
        }
    }
    const echapper = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    Blockly.ContextMenuRegistry.registry.register({
        id: 'aide_bloc_mbot1', scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK, weight: -1,
        displayText: 'Aide sur ce bloc',
        preconditionFn: () => 'enabled',
        callback: (scope) => {
            const b = scope.block;
            const aide = typeof b.tooltip === 'function' ? b.tooltip() : b.tooltip;
            let cpp = '';
            try {
                // Un bloc grise (hors du programme) ne produit aucun code : il est reactive le temps de la
                // generation, sans evenement (ni annulation, ni sauvegarde, ni regrisage pendant ce temps).
                const grise = !b.isEnabled();
                Blockly.Events.disable();
                try {
                    if (grise) b.setEnabled(true);
                    Arduino.init(ws);
                    const r = Arduino.blockToCode(b, true);
                    cpp = (Array.isArray(r) ? r[0] : r) || '';
                } finally {
                    if (grise) b.setEnabled(false);
                    Blockly.Events.enable();
                }
                if (b.type.startsWith('procedures_def')) cpp = Object.entries(Arduino.definitions_).filter(([k]) => k.startsWith('f_')).map(([, d]) => d)[0] || '';
            } catch (e) { cpp = ''; }
            if (CHAPEAUX.includes(b.type)) cpp = 'void setup() {\n  // les blocs placés dessous\n}';
            majCode();   // le generateur C++ est partage : on le remet sur le vrai programme
            ouvrirAide('Aide : « ' + b.toString(60, '…') + ' »',
                '<p>' + echapper(aide || 'Pas d\'aide pour ce bloc.') + '</p>' +
                (cpp.trim() ? '<p>En C++ (Arduino, bibliothèque MeMCore) :</p><pre><code>' + echapper(cpp.trim()) + '</code></pre>' : ''),
                (window.EXEMPLES_AIDE_MBOT1 || {})[b.type]);
        },
    });
    $('aide-envoi').addEventListener('click', () => ouvrirAide('Brancher et programmer le mBot1',
        '<p><b>Navigateur :</b> Chrome ou Edge sur ordinateur (le robot est relié par Web Serial).</p>' +
        '<p><b>Pilote :</b> sous Windows, la carte mCore apparaît comme « USB-SERIAL CH340 » dans le Gestionnaire de périphériques. ' +
        'Si elle n\'apparaît pas, installez le pilote CH340 (fourni avec mBlock).</p>' +
        '<p><b>Envoyer au robot :</b> le programme est compilé sur cet ordinateur (serveur local lancé par <code>lancer_projet.bat</code>), ' +
        'puis enregistré dans la carte. Le robot fonctionne ensuite seul, même débranché, et garde le programme après l\'extinction.</p>' +
        '<p><b>Mode direct :</b> le programme s\'exécute dans l\'ordinateur et pilote le robot par le câble, sans compiler : pratique pour ' +
        'essayer vite. Il faut le microprogramme du mode direct (installé d\'usine ; sinon : « Envoyer au robot » puis « Installer le microprogramme du mode direct »). ' +
        'Envoyer un programme remplace ce microprogramme.</p>' +
        '<p><b>Mesures :</b> le bloc « écrire … dans la console de l\'ordinateur » envoie un texte par le câble ; ' +
        'cliquez sur « Écouter le robot » dans la console pour le lire.</p>' +
        '<p><b>Programme bloqué :</b> éteignez puis rallumez le robot, ou renvoyez un programme.</p>'));
    $('aide-simulateur').addEventListener('click', () => ouvrirAide('Utiliser le simulateur',
        '<p>Le robot est vu de dessus, sur une piste de 200 × 150 cm. Choisissez la piste dans la liste, puis « Lancer la simulation ».</p>' +
        '<p>Glissez le robot ou un obstacle avec la souris ; la molette au-dessus du robot le fait pivoter ; un double-clic retire un obstacle.</p>' +
        '<p>Le bouton de la carte et les touches de la télécommande se maintiennent appuyés avec la souris. Le curseur règle la lumière ambiante.</p>' +
        '<p>Les deux points sous l\'avant du robot sont les capteurs du suiveur de ligne (verts quand ils voient la ligne) ; le trait bleu pointillé est le faisceau des ultrasons.</p>' +
        '<p class="remarque">Le simulateur est une approximation : roues de 6,6 cm et entraxe de 10,9 cm mesurés sur la photo, vitesse de 150 tr/min à 100 % estimée. ' +
        'Sur le vrai robot, la vitesse dépend aussi des piles : réglez les durées des virages en essayant.</p>'));

    // ==========================================
    // 10. DEMARRAGE
    // ==========================================
    ws.addChangeListener(e => {
        if (e.isUiEvent) return;
        if (e.type === Blockly.Events.BLOCK_MOVE || e.type === Blockly.Events.BLOCK_CREATE) griserOrphelins();
        majCode();
        sauverAuto();
    });
    let etatInitial = null;
    try { etatInitial = JSON.parse(localStorage.getItem(CLE_AUTO)); } catch (e) { etatInitial = null; }
    if (etatInitial && etatInitial.blocs) {
        try { chargerEtat(etatInitial); } catch (e) { chargerExemple('vide'); }
    } else chargerExemple('vide');
    majLancer();
    window.consoleAjouterLigne('Éditeur mBot1 prêt. Assemblez vos blocs sous « quand le programme démarre », puis lancez la simulation, essayez en mode direct ou envoyez le programme au robot.', 'info');
    window.mbot1Test = { ws, genererArduino: () => genererArduino(ws), genererSimu: () => genererSimu(ws), chargerExemple, EXEMPLES };
})();
