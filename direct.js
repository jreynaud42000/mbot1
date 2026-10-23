// direct.js — mode direct : le programme s'execute dans le navigateur et pilote le vrai mBot1 par le cable USB,
// sans compilation (comme le mode « en direct » de mBlock). Le robot doit contenir le microprogramme du mode direct
// (programme d'usine du mBot, ou « Installer le microprogramme du mode direct » dans la fenetre d'envoi).
//
// Le code execute est celui du simulateur (generateur « SIMU » de blocs.js) ; seul l'objet R change : chaque
// commande ou lecture devient une trame du protocole serie de Makeblock (microprogramme mbot_firmware) :
//   demande  FF 55 | longueur | indice | action (1 = lire, 2 = agir, 4 = tout arreter) | appareil | donnees
//   reponse  FF 55 | indice | type (1 octet, 2 decimal 4 octets, 3 entier 2 octets, 4 texte, 5 double) | valeur | 0D 0A
//   accuse   FF 55 0D 0A (apres une action)
// Codes des appareils : 0 version, 1 ultrasons, 3 lumiere, 5 deux moteurs, 8 LED RGB, 10 moteur, 14 telecommande,
// 17 suiveur de ligne, 30 broche numerique, 31 broche analogique, 34 buzzer, 35 bouton de la carte.

(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const DEBIT = 115200;
    const DEMARRAGE = 2000;      // ms : l'ouverture du port redemarre la carte (chargeur puis microprogramme)
    const DELAI = 300;           // ms d'attente d'une reponse
    const APPAREIL = { VERSION: 0, ULTRASONS: 1, LUMIERE: 3, ROUES: 5, LED: 8, MOTEUR: 10, TELECOMMANDE: 14, LIGNE: 17,
                       NUMERIQUE: 30, ANALOGIQUE: 31, BUZZER: 34, BOUTON: 35 };
    // Broches des ports RJ25 de la carte mCore (MeMCore.h) : [broche 1, broche 2] ; ANALOGIQUE = numero de l'entree An.
    const BROCHES = { 1: [11, 12], 2: [9, 10], 3: [16, 17], 4: [14, 15] };
    const ENTREES_ANALOGIQUES = { 3: [2, 3], 4: [0, 1] };

    const pause = ms => new Promise(r => setTimeout(r, ms));
    const court = n => { n = Math.round(Number(n) || 0); return [n & 0xFF, (n >> 8) & 0xFF]; };
    const console_ = (t, c) => window.consoleAjouterLigne && window.consoleAjouterLigne(t, c);

    // ---------- Liaison avec le microprogramme ----------
    class LiaisonDirecte {
        constructor(port) { this.port = port; this.tampon = []; this.attente = null; this.file = Promise.resolve(); this.indice = 0; }
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
                        this.tampon.push(...value);
                        this.analyser();
                    }
                } catch (e) { return; } finally { try { this.lecteur.releaseLock(); } catch (e) { /* deja libere */ } }
            }
        }
        analyser() {
            const t = this.tampon;
            for (;;) {
                const i = t.findIndex((o, k) => o === 0xFF && t[k + 1] === 0x55);
                if (i < 0) { t.splice(0, Math.max(0, t.length - 1)); return; }
                if (i > 0) t.splice(0, i);
                if (t.length < 4) return;
                if (t[2] === 0x0D && t[3] === 0x0A) { t.splice(0, 4); this.resoudre(null, null); continue; }   // accuse d'une action
                const indice = t[2], type = t[3];
                let taille = { 1: 1, 2: 4, 3: 2, 5: 4 }[type];
                if (type === 4) { if (t.length < 5) return; taille = 1 + t[4]; }
                if (taille === undefined) { t.splice(0, 2); continue; }
                if (t.length < 4 + taille + 2) return;
                const donnees = t.slice(4, 4 + taille);
                const bonneFin = t[4 + taille] === 0x0D && t[5 + taille] === 0x0A;
                t.splice(0, bonneFin ? 6 + taille : 2);
                if (!bonneFin) continue;
                let valeur;
                if (type === 1) valeur = donnees[0];
                else if (type === 3) valeur = new DataView(new Uint8Array(donnees).buffer).getInt16(0, true);
                else if (type === 4) valeur = String.fromCharCode(...donnees.slice(1));
                else valeur = new DataView(new Uint8Array(donnees).buffer).getFloat32(0, true);
                this.resoudre(indice, valeur);
            }
        }
        resoudre(indice, valeur) {
            const a = this.attente;
            if (a && (a.indice === null ? indice === null : indice === a.indice)) { this.attente = null; a.resoudre(valeur); }
        }
        /** Une demande a la fois (le microprogramme repond dans l'ordre) ; resolue par la reponse, rejetee sans reponse. */
        echanger(action, appareil, donnees, delai) {
            const tache = this.file.then(async () => {
                const indice = action === 1 ? (this.indice = (this.indice + 1) % 250) : 0;
                const corps = [indice, action, appareil, ...donnees];
                const reponse = new Promise(resoudre => { this.attente = { indice: action === 1 ? indice : null, resoudre }; });
                const ecrivain = this.port.writable.getWriter();
                try { await ecrivain.write(new Uint8Array([0xFF, 0x55, corps.length, ...corps])); } finally { ecrivain.releaseLock(); }
                const r = await Promise.race([reponse, pause(delai || DELAI).then(() => ARRIVE_PAS)]);
                if (r === ARRIVE_PAS) { this.attente = null; throw new Error('le robot ne répond pas'); }
                return r;
            });
            this.file = tache.catch(() => { /* la demande suivante part quand meme */ });
            return tache;
        }
        lireCapteur(appareil, ...donnees) { return this.echanger(1, appareil, donnees); }
        agir(appareil, ...donnees) { return this.echanger(2, appareil, donnees).catch(() => { /* accuse perdu : sans gravite */ }); }
        async toutArreter() {
            try { const e = this.port.writable.getWriter(); try { await e.write(new Uint8Array([0xFF, 0x55, 0x02, 0x00, 0x04])); } finally { e.releaseLock(); } }
            catch (e) { /* port deja ferme */ }
        }
        async fermer() {
            try { if (this.lecteur) await this.lecteur.cancel(); } catch (e) { /* deja ferme */ }
            try { await this.lecture; } catch (e) { /* rien */ }
            try { await this.port.close(); } catch (e) { /* deja ferme */ }
        }
    }
    const ARRIVE_PAS = {};

    // ---------- Execution du programme sur le vrai robot ----------
    let liaison = null, execution = null;
    function creerExecution(code) {
        const { AIDES, ROUES, ARRET } = window.Simulateur;
        const run = { actif: true, attentes: new Set(), debut: performance.now() };
        const dormir = (ms) => new Promise(res => {
            const fin = () => { run.attentes.delete(fin); clearTimeout(id); res(); };
            const id = setTimeout(fin, Math.max(0, Number(ms) || 0));
            run.attentes.add(fin);
        }).then(() => { if (!run.actif) throw ARRET; });
        const verifier = () => { if (!run.actif) throw ARRET; };
        const pwm = p => Math.max(-100, Math.min(100, Number(p) || 0)) * 2.55;
        // Moteur gauche (M1) monte en miroir : positif = avancer sur les deux roues, comme dans le code C++.
        const roues = (g, d) => liaison.agir(APPAREIL.ROUES, ...court(-pwm(g)), ...court(pwm(d)));
        const lire = async (appareil, ...donnees) => { verifier(); const v = await liaison.lireCapteur(appareil, ...donnees); verifier(); return v; };
        const gestionnaires = [];

        const R = Object.assign({}, AIDES, {
            sur(evenement, cle, fn) { gestionnaires.push(fn); },
            pas: () => dormir(0),
            attendre: (s) => dormir(Number(s) * 1000),

            async bouger(sens, v, t) {
                verifier();
                const [g, d] = ROUES[sens];
                await roues(g * Number(v), d * Number(v));
                if (t !== null && t !== undefined) { await dormir(Number(t) * 1000); await roues(0, 0); }
            },
            async roues(g, d) { verifier(); await roues(g, d); },
            async moteur(port, v) { verifier(); await liaison.agir(APPAREIL.MOTEUR, port === 'M1' ? 9 : 10, ...court(port === 'M1' ? -pwm(v) : pwm(v))); },

            distance: async (port) => Math.round(await lire(APPAREIL.ULTRASONS, Number(port)) * 10) / 10,
            capteurLigne: async (port, cote) => ((await lire(APPAREIL.LIGNE, Number(port))) & (cote === 'gauche' ? 2 : 1)) === 0,
            ligne: async (port) => Math.round(await lire(APPAREIL.LIGNE, Number(port))),
            lumiere: async () => Math.round(await lire(APPAREIL.LUMIERE, 6)),     // port 6 : capteur de la carte (A6)
            bouton: async () => (await lire(APPAREIL.BOUTON, 7, 0)) === 1,      // port 7 : bouton de la carte (A7)
            telecommande: async (code) => !!(await lire(APPAREIL.TELECOMMANDE, 0, Number(code))),
            chrono: () => Math.round((performance.now() - run.debut) / 10) / 100,
            razChrono() { run.debut = performance.now(); },

            portAnalogique: async (port, broche) => {
                const entree = (ENTREES_ANALOGIQUES[port] || [])[broche - 1];
                return entree === undefined ? 0 : Math.round(await lire(APPAREIL.ANALOGIQUE, entree));
            },
            portNumerique: async (port, broche) => !!(await lire(APPAREIL.NUMERIQUE, BROCHES[port][broche - 1])),
            async portEcrire(port, broche, etat) { verifier(); await liaison.agir(APPAREIL.NUMERIQUE, BROCHES[port][broche - 1], etat ? 1 : 0); },

            async led(id, r, g, b) {
                verifier();
                const c = [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(Number(x) || 0))));
                await liaison.agir(APPAREIL.LED, 7, 2, Number(id), ...c);   // port 7, emplacement 2 : LED de la carte
            },
            async son(f, t) {
                verifier();
                const ms = Math.max(0, Number(t) * 1000);
                await liaison.echanger(2, APPAREIL.BUZZER, [...court(f), ...court(ms)], ms + DELAI).catch(() => { /* accuse perdu */ });
                verifier();
            },
            print: (t) => console_('[mode direct] ' + t, 'robot'),
        });
        return {
            run,
            demarrer() {
                let preparer;
                try { preparer = new Function('R', 'V', 'FN', '"use strict";\n' + code); }
                catch (e) { console_('Le programme n\'a pas pu être préparé : ' + e.message, 'err'); return false; }
                try { preparer(R, {}, {}); } catch (e) { console_('Erreur au démarrage : ' + e.message, 'err'); return false; }
                Promise.all(gestionnaires.map(fn => fn().catch(e => {
                    if (e === ARRET) return;
                    console_('Erreur dans le programme : ' + (e && e.message ? e.message : e) + '.', 'err');
                    if (e && /ne répond pas/.test(e.message)) console_('Le robot contient-il le microprogramme du mode direct ? (fenêtre « Envoyer au robot »)', 'err');
                }))).then(() => { if (execution && execution.run === run) { console_('Programme terminé (mode direct).', 'info'); arreter(); } });
                return true;
            },
            arreter() { run.actif = false; for (const fin of Array.from(run.attentes)) fin(); },
        };
    }

    // ---------- Interface ----------
    const bouton = $('tb-direct');
    function majBouton() {
        bouton.classList.toggle('running', !!execution);
        $('tb-direct-label').textContent = execution ? 'Arrêter le robot' : 'Mode direct';
    }
    async function fermerLiaison() {
        if (execution) { execution.arreter(); execution = null; }
        if (liaison) { const l = liaison; liaison = null; await l.toutArreter(); await l.fermer(); }
        majBouton();
    }
    window.PortRobot.liberations.push(fermerLiaison);

    async function lancer(code) {
        try {
            await window.PortRobot.liberer();
            const port = await window.PortRobot.choisir($('envoi-tous-ports').checked);
            liaison = new LiaisonDirecte(port);
            await liaison.ouvrir();
            bouton.disabled = true;
            console_('Mode direct : connexion au robot…', 'info');
            await pause(DEMARRAGE);
            let version;
            try { version = await liaison.lireCapteur(APPAREIL.VERSION, 0); }
            catch (e) {
                console_('Le robot ne répond pas en mode direct. Installez le microprogramme du mode direct : « Envoyer au robot », ' +
                    'puis « Installer le microprogramme du mode direct ». (Un programme envoyé depuis l\'éditeur le remplace.)', 'err');
                await fermerLiaison();
                return;
            }
            console_('Mode direct : robot connecté (microprogramme ' + version + '). Le programme s\'exécute en pilotant le robot par le câble.', 'ok');
            execution = creerExecution(code);
            if (!execution.demarrer()) await fermerLiaison();
        } catch (e) {
            if (e && e.name === 'NotFoundError') window.PortRobot.port = null;
            else console_('Mode direct impossible : ' + (e && e.message ? e.message : e), 'err');
            await fermerLiaison();
        } finally {
            bouton.disabled = false; majBouton();
        }
    }
    async function arreter() {
        if (!execution && !liaison) return;
        await fermerLiaison();
        console_('Mode direct arrêté : moteurs, LED et buzzer coupés.', 'info');
    }

    bouton.addEventListener('click', () => {
        if (execution || liaison) arreter();
        else lancer(window.BLOCS_MBOT1.genererSimu(window.workspace));
    });
    majBouton();

    window.ModeDirect = { lancer, arreter, enCours: () => !!execution, LiaisonDirecte, APPAREIL };
})();
