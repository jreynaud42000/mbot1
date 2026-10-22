// televersement.js — envoi du programme dans la carte mCore du mBot1, par le cable USB (Web Serial : Chrome, Edge).
//
// La carte mCore est une carte Arduino Uno (ATmega328P, chargeur d'amorcage Optiboot a 115 200 bauds, puce USB CH340).
// 1. Compilation : le code C++ est envoye au serveur local (app.py, adresse /compiler) qui le compile avec arduino-cli
//    et la bibliotheque Makeblock ; il renvoie le fichier .hex (format Intel HEX).
// 2. Televersement : protocole STK500 version 1, celui d'avrdude « -c arduino » (documentation Atmel AVR061) :
//    impulsion sur DTR (redemarrage de la carte), synchronisation 30 20 -> 14 10, lecture de la signature
//    (1E 95 0F = ATmega328P), passage en programmation, pages de 128 octets (adresse 55 en mots de 16 bits,
//    ecriture 64), relecture de chaque page (74) pour verifier, sortie de programmation (51).
// Les octets recus en dehors d'un envoi sont la sortie Serial.println() du programme : ils vont dans la console.

(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const VENDEUR_WCH = 0x1A86;           // puce USB-serie CH340 de la carte mCore
    const DEBIT = 115200;
    const PAGE = 128;                     // taille d'une page de memoire flash de l'ATmega328P (octets)
    const TAILLE_MAX = 32256;             // 32 Ko moins les 512 octets d'Optiboot
    const SIGNATURE = [0x1E, 0x95, 0x0F]; // ATmega328P
    const STK = { OK: 0x10, INSYNC: 0x14, EOP: 0x20, SYNC: 0x30, ENTER: 0x50, LEAVE: 0x51, ADRESSE: 0x55, ECRIRE: 0x64, LIRE: 0x74, SIGNATURE: 0x75 };

    const pause = ms => new Promise(r => setTimeout(r, ms));

    // ---------- Fichier Intel HEX -> octets du programme ----------
    function lireHex(texte) {
        const memoire = new Uint8Array(TAILLE_MAX + PAGE).fill(0xFF);
        let base = 0, fin = 0;
        for (const brute of texte.split(/\r?\n/)) {
            const ligne = brute.trim();
            if (!ligne) continue;
            if (ligne[0] !== ':') throw new Error('fichier .hex invalide');
            const o = ligne.slice(1).match(/../g).map(h => parseInt(h, 16));
            const n = o[0], adresse = o[1] << 8 | o[2], type = o[3];
            if (o.reduce((s, x) => (s + x) & 0xFF, 0) !== 0) throw new Error('somme de contrôle fausse dans le fichier .hex');
            if (type === 0x00) {
                const debut = base + adresse;
                if (debut + n > TAILLE_MAX) throw new Error('programme trop gros pour la carte (' + (debut + n) + ' octets, ' + TAILLE_MAX + ' au plus)');
                memoire.set(o.slice(4, 4 + n), debut);
                fin = Math.max(fin, debut + n);
            } else if (type === 0x01) break;
            else if (type === 0x02) base = (o[4] << 8 | o[5]) * 16;
            else if (type === 0x04) base = (o[4] << 8 | o[5]) * 65536;
        }
        return memoire.slice(0, fin);
    }

    // ---------- Partage du port USB entre l'envoi, la console et le mode direct (direct.js) ----------
    // Le dernier port choisi est reutilise : la fenetre de choix du navigateur ne s'ouvre qu'une fois par seance.
    const PortRobot = {
        port: null,
        async choisir(tous, nouveau) {
            if (!('serial' in navigator)) throw new Error('ce navigateur ne sait pas utiliser le port USB : ouvrez l\'éditeur dans Chrome ou Edge');
            if (this.port && !nouveau) return this.port;
            this.port = await navigator.serial.requestPort(tous ? {} : { filters: [{ usbVendorId: VENDEUR_WCH }] });
            return this.port;
        },
        liberations: [],   // fonctions qui ferment le port (console, mode direct) avant qu'un autre l'ouvre
        async liberer() { for (const f of this.liberations) await f(); },
    };
    window.PortRobot = PortRobot;

    // ---------- Liaison serie ----------
    class Liaison {
        constructor(port, surTexte) {
            this.port = port; this.surTexte = surTexte;
            this.tampon = []; this.capture = false; this.lecture = null; this.lecteur = null; this.signal = null;
            this.decodeur = new TextDecoder();
        }
        async ouvrir() {
            await this.port.open({ baudRate: DEBIT });
            this.lecture = this.lire();
        }
        async lire() {
            while (this.port.readable) {
                this.lecteur = this.port.readable.getReader();
                try {
                    for (;;) {
                        const { value, done } = await this.lecteur.read();
                        if (done) return;
                        if (this.capture) { this.tampon.push(...value); if (this.signal) this.signal(); }
                        else if (this.surTexte) this.surTexte(this.decodeur.decode(value, { stream: true }));
                    }
                } catch (e) { return; /* port debranche ou ferme */ }
                finally { try { this.lecteur.releaseLock(); } catch (e) { /* deja libere */ } }
            }
        }
        async ecrire(octets) {
            const ecrivain = this.port.writable.getWriter();
            try { await ecrivain.write(new Uint8Array(octets)); } finally { ecrivain.releaseLock(); }
        }
        /** Attend n octets recus (ou echoue apres « delai » ms). */
        async recevoir(n, delai) {
            const limite = performance.now() + delai;
            while (this.tampon.length < n) {
                const reste = limite - performance.now();
                if (reste <= 0) throw new Error('pas de réponse de la carte');
                await Promise.race([new Promise(r => { this.signal = r; }), pause(reste)]);
            }
            return this.tampon.splice(0, n);
        }
        /** Commande STK500 : envoie octets + EOP, attend INSYNC, « n » octets de donnees, puis OK. */
        async commande(octets, n, delai) {
            this.tampon.length = 0;
            await this.ecrire([...octets, STK.EOP]);
            const r = await this.recevoir(n + 2, delai || 500);
            if (r[0] !== STK.INSYNC || r[n + 1] !== STK.OK) throw new Error('réponse inattendue de la carte');
            return r.slice(1, n + 1);
        }
        async redemarrer() {   // impulsion sur DTR/RTS : le condensateur de la carte la remet a zero
            await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
            await pause(250);
            await this.port.setSignals({ dataTerminalReady: true, requestToSend: true });
            await pause(50);
        }
        async fermer() {
            try { if (this.lecteur) await this.lecteur.cancel(); } catch (e) { /* deja ferme */ }
            try { await this.lecture; } catch (e) { /* rien */ }
            try { await this.port.close(); } catch (e) { /* deja ferme */ }
        }
    }

    /** Televerse « programme » (octets) dans la carte ; avance(fraction) suit la progression. */
    async function televerserOctets(liaison, programme, avance, etat) {
        liaison.capture = true;
        etat('Redémarrage de la carte…');
        let synchro = false;
        for (let essai = 0; essai < 3 && !synchro; essai++) {
            await liaison.redemarrer();
            for (let i = 0; i < 8 && !synchro; i++) {
                try { await liaison.commande([STK.SYNC], 0, 200); synchro = true; } catch (e) { /* le chargeur demarre */ }
            }
        }
        if (!synchro) throw new Error('la carte ne répond pas au chargeur (câble, pilote CH340, port déjà utilisé ?)');
        const sig = await liaison.commande([STK.SIGNATURE], 3);
        if (sig.some((o, i) => o !== SIGNATURE[i]))
            throw new Error('ce n\'est pas une carte mCore (signature ' + sig.map(o => o.toString(16).padStart(2, '0')).join(' ') + ')');
        await liaison.commande([STK.ENTER], 0);
        const pages = Math.ceil(programme.length / PAGE);
        for (let p = 0; p < pages; p++) {
            const debut = p * PAGE, mot = debut >> 1;
            const morceau = Array.from(programme.slice(debut, debut + PAGE));
            while (morceau.length < PAGE) morceau.push(0xFF);
            etat('Écriture du programme : page ' + (p + 1) + ' / ' + pages + '…');
            await liaison.commande([STK.ADRESSE, mot & 0xFF, mot >> 8], 0);
            await liaison.commande([STK.ECRIRE, PAGE >> 8, PAGE & 0xFF, 0x46, ...morceau], 0, 1000);
            await liaison.commande([STK.ADRESSE, mot & 0xFF, mot >> 8], 0);
            const relu = await liaison.commande([STK.LIRE, PAGE >> 8, PAGE & 0xFF, 0x46], PAGE, 1000);
            if (relu.some((o, i) => o !== morceau[i])) throw new Error('vérification échouée à la page ' + (p + 1));
            avance((p + 1) / pages);
        }
        await liaison.commande([STK.LEAVE], 0);   // Optiboot lance alors le programme
        liaison.capture = false;
    }

    // ---------- Compilation par le serveur local ----------
    async function compiler(adresse, code) {
        let reponse;
        try {
            reponse = await fetch(adresse, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
        } catch (e) {
            throw new Error('le serveur local ne répond pas : lancez l\'éditeur avec lancer_projet.bat');
        }
        let r = null;
        try { if (reponse.ok) r = await reponse.json(); } catch (e) { r = null; }
        // Site web statique (site_web/) : pas de serveur pour compiler.
        if (!r) throw new Error('la compilation demande le serveur local (lancer_projet.bat) : sur le site web, utilisez le mode direct ou « Enregistrer le programme (.ino) »');
        if (!r.ok) {
            const e = new Error(r.message || 'compilation impossible');
            e.journal = r.journal;
            throw e;
        }
        return r;
    }

    // ---------- Interface ----------
    const fenetre = $('fenetre-envoi'), etat = $('envoi-etat'), barre = $('envoi-barre').firstElementChild;
    const go = $('envoi-go'), goMicro = $('envoi-microprogramme');
    let liaison = null, occupe = false;
    const console_ = (t, c) => window.consoleAjouterLigne && window.consoleAjouterLigne(t, c);
    let ligneRobot = '';
    function texteRobot(t) {   // sortie Serial.println() du programme : affichee ligne par ligne
        ligneRobot += t;
        const lignes = ligneRobot.split(/\r?\n/);
        ligneRobot = lignes.pop();
        for (const l of lignes) console_('[robot] ' + l, 'robot');
    }
    function majVoyant() {
        const v = $('voyant-robot');
        v.classList.toggle('connecte', !!liaison);
        v.title = liaison ? 'Robot connecté (console)' : 'Robot non connecté';
        $('btn-console-robot').textContent = liaison ? 'Déconnecter le robot' : 'Écouter le robot';
    }
    function afficherEtat(t, classe) { etat.textContent = t; etat.className = classe || ''; }
    async function deconnecter() {
        if (liaison) { const l = liaison; liaison = null; await l.fermer(); console_('Robot déconnecté.', 'info'); }
        majVoyant();
    }
    PortRobot.liberations.push(deconnecter);

    async function envoyer(adresse, code, nom) {
        if (occupe) return;
        occupe = true; go.disabled = goMicro.disabled = true;
        barre.style.width = '0';
        try {
            afficherEtat('Compilation du programme…');
            const resultat = await compiler(adresse, code);
            const programme = lireHex(resultat.hex);
            barre.style.width = '10%';
            console_('Compilation réussie : ' + programme.length + ' octets sur ' + TAILLE_MAX + ' (' + Math.round(programme.length / TAILLE_MAX * 100) + ' %).', 'info');
            await PortRobot.liberer();
            afficherEtat('Choix du robot…');
            const port = await PortRobot.choisir($('envoi-tous-ports').checked);
            liaison = new Liaison(port, texteRobot);
            afficherEtat('Connexion au robot…');
            await liaison.ouvrir();
            majVoyant();
            await televerserOctets(liaison, programme, f => { barre.style.width = (10 + 90 * f) + '%'; }, afficherEtat);
            afficherEtat(nom + ' envoyé : le robot a démarré.', 'ok');
            console_(nom + ' envoyé au mBot1 (' + programme.length + ' octets). Console du robot ouverte.', 'ok');
        } catch (e) {
            const message = e && e.name === 'NotFoundError' ? 'Aucun robot choisi.' : 'Échec de l\'envoi : ' + (e && e.message ? e.message : e) + '.';
            afficherEtat(message, 'err');
            if (e && e.journal) console_(e.journal, 'err');
            if (e && e.name === 'NotFoundError') PortRobot.port = null;
            else {
                console_(message, 'err');
                if (e && e.name === 'NetworkError') console_('Le port est peut-être déjà utilisé par un autre logiciel (mBlock, IDE Arduino) ou un autre onglet.', 'err');
            }
            await deconnecter();
        } finally {
            occupe = false; go.disabled = goMicro.disabled = false; majVoyant();
        }
    }

    async function ecouter() {
        if (liaison) { await deconnecter(); return; }
        try {
            await PortRobot.liberer();
            const port = await PortRobot.choisir($('envoi-tous-ports').checked);
            liaison = new Liaison(port, texteRobot);
            await liaison.ouvrir();
            console_('Robot connecté : le programme redémarre, ce qu\'il écrit avec « écrire … dans la console de l\'ordinateur » s\'affiche ici.', 'ok');
        } catch (e) {
            liaison = null;
            if (e && e.name === 'NotFoundError') PortRobot.port = null;
            else console_('Connexion impossible : ' + (e && e.message ? e.message : e), 'err');
        }
        majVoyant();
    }

    $('btn-envoyer').addEventListener('click', () => {
        afficherEtat(''); barre.style.width = '0';
        fenetre.classList.add('ouvert');
        go.focus();
    });
    $('envoi-fermer').addEventListener('click', () => fenetre.classList.remove('ouvert'));
    fenetre.addEventListener('keydown', e => { if (e.key === 'Escape' && !occupe) fenetre.classList.remove('ouvert'); });
    go.addEventListener('click', () => envoyer('compiler', window.codeArduinoCourant ? window.codeArduinoCourant() : '', 'Programme'));
    goMicro.addEventListener('click', () => envoyer('microprogramme', '', 'Microprogramme du mode direct'));
    $('envoi-autre-port').addEventListener('click', () => { PortRobot.port = null; afficherEtat('Le prochain envoi demandera le port à utiliser.'); });
    $('btn-console-robot').addEventListener('click', ecouter);
    if ('serial' in navigator) navigator.serial.addEventListener('disconnect', e => {
        if (e.target === PortRobot.port) PortRobot.port = null;
        if (liaison && e.target === liaison.port) deconnecter();
    });
    majVoyant();

    // Pour les tests (console du navigateur) : lecture d'un .hex et televersement contre une carte simulee.
    window.TeleversementTest = { lireHex, televerserOctets, Liaison, STK, compiler };
})();
