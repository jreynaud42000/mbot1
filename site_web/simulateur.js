// simulateur.js — mBot1 simule en 2D, vue de dessus, sur une piste a l'echelle (unites : cm, s, degres).
//
// Le programme des blocs est traduit en JavaScript asynchrone par blocs.js (generateur « SIMU ») ; il appelle
// l'objet R cree ici a chaque lancement (direct.js fournit le meme objet R pour le vrai robot). Le robot avance
// selon la vitesse de ses deux roues (entrainement differentiel) ; les capteurs lisent la piste : ultrasons par
// lancer de rayons sur les obstacles et les murs, suiveur de ligne par lecture du sol sous ses 2 capteurs.
//
// Dimensions : mBot ≈ 17 × 13 cm (Makeblock), ultrasons 3 a 400 cm (MeUltrasonicSensor). Le robot est dessine avec
// la photo vue de dessus mbot1.png ; diametre des roues, entraxe et contour sont mesures sur cette photo (13 cm de
// large = 352 pixels, perspective comprise : a confirmer a la regle). Vitesse des moteurs NON documentee : estimee (RPM_100).

(function () {
    'use strict';
    const $ = id => document.getElementById(id);

    // ---------- Geometrie du robot (cm ; f = vers l'avant depuis l'axe des roues, l = vers la droite) ----------
    const ROUE_D = 6.6;             // diametre des roues (mesure sur la photo)
    const ENTRAXE = 10.9;           // distance entre les milieux des deux roues (mesuree sur la photo)
    const RPM_100 = 150;            // vitesse des roues a 100 % (moteurs 6 V, estimee)
    const CORPS = { arriere: -6, avant: 10.2, demiLargeur: 6.5 };
    const ULTRASONS_F = 9.4;
    // Photo vue de dessus (avant en haut) : echelle et position de l'axe des roues, en pixels de mbot1.png.
    const PHOTO = { pxParCm: 27.1, centreX: 175, axeY: 284 };
    // LED de la carte sur la photo (positions approximatives : les LED sont sous le capot).
    const LEDS_PHOTO = [[200, 74], [150, 74]];   // LED 1 a droite, LED 2 a gauche
    const photo = new Image();
    photo.src = 'mbot1.png';
    const LIGNE_F = 7;
    const LIGNE_L = { gauche: -0.8, droit: 0.8 };   // les 2 capteurs du suiveur de ligne (ecart estime 1,6 cm)
    const TAU_MOTEUR = 0.1;         // temps de reponse des moteurs (s)

    // ---------- Pistes (200 × 150 cm, dessinees a 4 px/cm) ----------
    const LARGEUR = 200, HAUTEUR = 150, ECH = 4;
    // Reglages du panneau (memes curseurs que les simulateurs micro:bit et mBot2, memorises pour ce navigateur) :
    //  - largeur de la ligne noire des pistes, en cm : plus etroite, plus facile de la perdre ;
    //  - echelle du robot : purement visuelle (dessin agrandi), sans effet sur sa position, ses capteurs ni les collisions.
    function lireReglage(cle, defaut, min, max) {
        let v = NaN;
        try { v = parseFloat(localStorage.getItem(cle)); } catch (e) { /* navigation privee */ }
        return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : defaut;
    }
    let LARGEUR_LIGNE = lireReglage('mbot1_largeur_ligne', 2.5, 1, 5);
    let ECHELLE_ROBOT = lireReglage('mbot1_echelle_robot', 1, 1, 4);
    function courbeFermee(ctx, pts) {   // Catmull-Rom fermee passant par tous les points
        const n = pts.length;
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 0; i < n; i++) {
            const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
            ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
                              p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
        }
    }
    function quadrillage(ctx) {
        ctx.strokeStyle = '#ececec'; ctx.lineWidth = 0.15;
        for (let x = 10; x < LARGEUR; x += 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HAUTEUR); ctx.stroke(); }
        for (let y = 10; y < HAUTEUR; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LARGEUR, y); ctx.stroke(); }
    }
    const SINUEUX = [[40, 28], [100, 48], [160, 28], [180, 75], [160, 122], [120, 100], [80, 126], [28, 112], [22, 70]];
    const PISTES = {
        libre: { nom: 'Sol libre', depart: [40, 75, 0], obstacles: [], dessin: quadrillage },
        ovale: {
            nom: 'Ovale (suivi de ligne)', depart: [92, 120, 0], obstacles: [],
            dessin(ctx) {
                quadrillage(ctx);
                ctx.strokeStyle = '#111'; ctx.lineWidth = LARGEUR_LIGNE;
                ctx.beginPath(); ctx.arc(55, 75, 45, Math.PI / 2, 3 * Math.PI / 2); ctx.lineTo(145, 30);
                ctx.arc(145, 75, 45, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.stroke();
            },
        },
        sinueux: {
            nom: 'Circuit sinueux (suivi de ligne)', obstacles: [],
            depart: (() => {   // sur la ligne, capteurs au-dessus du trait, dans le sens du parcours
                const [p0, p1, pn] = [SINUEUX[0], SINUEUX[1], SINUEUX[SINUEUX.length - 1]];
                const a = Math.atan2(p1[1] - pn[1], p1[0] - pn[0]);
                return [p0[0] - Math.cos(a) * LIGNE_F, p0[1] - Math.sin(a) * LIGNE_F, a * 180 / Math.PI];
            })(),
            dessin(ctx) {
                quadrillage(ctx);
                ctx.strokeStyle = '#111'; ctx.lineWidth = LARGEUR_LIGNE; ctx.lineJoin = 'round';
                ctx.beginPath(); courbeFermee(ctx, SINUEUX); ctx.closePath(); ctx.stroke();
            },
        },
        obstacles: {
            nom: 'Arène à obstacles', depart: [22, 75, 0],
            obstacles: [{ x: 70, y: 62, w: 20, h: 26 }, { x: 120, y: 18, w: 18, h: 30 }, { x: 125, y: 100, w: 30, h: 18 }, { x: 165, y: 60, w: 16, h: 16 }],
            dessin: quadrillage,
        },
        zone: {
            nom: 'Zone à ne pas quitter', depart: [100, 75, 0], obstacles: [],
            dessin(ctx) {
                quadrillage(ctx);
                ctx.strokeStyle = '#111'; ctx.lineWidth = LARGEUR_LIGNE;
                ctx.beginPath(); ctx.roundRect(20, 15, 160, 120, 10); ctx.stroke();
            },
        },
    };

    // ---------- Etat ----------
    const horloge = { t: 0, attentes: [] };   // temps de simulation (s) et attentes du programme
    const robot = { x: 40, y: 75, a: 0, cibleG: 0, cibleD: 0, rpmG: 0, rpmD: 0 };
    let piste = 'ovale', obstacles = [], sol = null;   // sol : pixels de la piste (lecture des capteurs)
    const fond = document.createElement('canvas');
    fond.width = LARGEUR * ECH; fond.height = HAUTEUR * ECH;
    fond.getContext('2d', { willReadFrequently: true });   // la piste est relue (getImageData) a chaque changement
    const canevas = $('piste'), ctx = canevas.getContext('2d');

    /** Dessine le sol de la piste et le relit pour les capteurs (sans toucher au robot ni aux obstacles). */
    function dessinerSol() {
        const c = fond.getContext('2d');
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, fond.width, fond.height);
        c.setTransform(ECH, 0, 0, ECH, 0, 0);
        PISTES[piste].dessin(c);
        sol = c.getImageData(0, 0, fond.width, fond.height).data;
    }
    function chargerPiste(cle) {
        piste = PISTES[cle] ? cle : 'ovale';
        const p = PISTES[piste];
        dessinerSol();
        obstacles = p.obstacles.map(o => Object.assign({}, o));
        replacer();
        try { localStorage.setItem('mbot1_piste', piste); } catch (e) { /* navigation privee */ }
    }
    function replacer() {
        const [x, y, a] = PISTES[piste].depart;
        Object.assign(robot, { x, y, a: a * Math.PI / 180, cibleG: 0, cibleD: 0, rpmG: 0, rpmD: 0 });
    }

    // ---------- Capteurs ----------
    const avant = (f, l) => [robot.x + Math.cos(robot.a) * f - Math.sin(robot.a) * l, robot.y + Math.sin(robot.a) * f + Math.cos(robot.a) * l];
    function couleurSolEn(x, y) {   // moyenne 3 × 3 pixels (0 a 255)
        let r = 0, g = 0, b = 0, n = 0;
        const cx = Math.round(x * ECH), cy = Math.round(y * ECH);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            const px = cx + dx, py = cy + dy;
            if (px < 0 || py < 0 || px >= fond.width || py >= fond.height) { n++; continue; }   // hors piste : noir
            const i = (py * fond.width + px) * 4;
            r += sol[i]; g += sol[i + 1]; b += sol[i + 2]; n++;
        }
        return [r / n, g / n, b / n];
    }
    const luminance = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const surLigne = cote => { const [x, y] = avant(LIGNE_F, LIGNE_L[cote]); return luminance(couleurSolEn(x, y)) < 0.5; };
    /** Valeur de MeLineFollower.readSensors() : bit 1 = gauche, bit 0 = droit, bit a 0 = capteur sur la ligne noire. */
    const valeurLigne = () => (surLigne('gauche') ? 0 : 2) + (surLigne('droit') ? 0 : 1);
    function rayon(x, y, dx, dy) {   // distance jusqu'au premier obstacle ou mur
        let t = Infinity;
        const tranche = (o) => {
            let tmin = -Infinity, tmax = Infinity;
            for (const [p, d, a, b] of [[x, dx, o.x, o.x + o.w], [y, dy, o.y, o.y + o.h]]) {
                if (Math.abs(d) < 1e-9) { if (p < a || p > b) return; continue; }
                let t1 = (a - p) / d, t2 = (b - p) / d;
                if (t1 > t2) [t1, t2] = [t2, t1];
                tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
            }
            if (tmax >= tmin && tmin > 0) t = Math.min(t, tmin);
        };
        obstacles.forEach(tranche);
        if (dx > 0) t = Math.min(t, (LARGEUR - x) / dx); else if (dx < 0) t = Math.min(t, -x / dx);
        if (dy > 0) t = Math.min(t, (HAUTEUR - y) / dy); else if (dy < 0) t = Math.min(t, -y / dy);
        return t;
    }
    function mesureUltrasons() {
        const [x, y] = avant(ULTRASONS_F, 0);
        let d = Infinity;
        for (const ecart of [-0.12, 0, 0.12]) d = Math.min(d, rayon(x, y, Math.cos(robot.a + ecart), Math.sin(robot.a + ecart)));
        return d > 400 ? 400 : Math.max(3, Math.round(d * 10) / 10);
    }

    // ---------- Mouvement ----------
    function collision() {
        const pts = [];
        for (const f of [CORPS.arriere, 2, CORPS.avant]) for (const l of [-CORPS.demiLargeur, 0, CORPS.demiLargeur]) if (f !== 2 || l !== 0) pts.push(avant(f, l));
        return pts.some(([x, y]) => x < 0 || y < 0 || x > LARGEUR || y > HAUTEUR ||
            obstacles.some(o => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h));
    }
    let bloque = false;
    function avancer(dt) {
        const k = 1 - Math.exp(-dt / TAU_MOTEUR);
        robot.rpmG += (robot.cibleG - robot.rpmG) * k;
        robot.rpmD += (robot.cibleD - robot.rpmD) * k;
        const ancien = { x: robot.x, y: robot.y, a: robot.a };
        const vG = robot.rpmG / 60 * Math.PI * ROUE_D, vD = robot.rpmD / 60 * Math.PI * ROUE_D;   // cm/s
        robot.a += (vG - vD) / ENTRAXE * dt;   // repere ecran (y vers le bas) : roue gauche plus rapide = virage a droite
        robot.x += Math.cos(robot.a) * (vG + vD) / 2 * dt;
        robot.y += Math.sin(robot.a) * (vG + vD) / 2 * dt;
        bloque = collision();
        if (bloque) Object.assign(robot, ancien);   // contre un mur : le robot reste en place, ses roues patinent
    }

    // ---------- Dessin ----------
    let voirCapteurs = true;
    const ledsRobot = [[0, 0, 0], [0, 0, 0]];   // LED 1, LED 2
    function dessiner() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(fond, 0, 0);
        ctx.setTransform(ECH, 0, 0, ECH, 0, 0);
        ctx.strokeStyle = '#495057'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, LARGEUR - 1, HAUTEUR - 1);
        for (const o of obstacles) {
            ctx.fillStyle = '#b07a46'; ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.strokeStyle = '#7a4f26'; ctx.lineWidth = 0.6; ctx.strokeRect(o.x, o.y, o.w, o.h);
            ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.moveTo(o.x + o.w, o.y); ctx.lineTo(o.x, o.y + o.h); ctx.stroke();
        }
        if (voirCapteurs) {
            const [x, y] = avant(ULTRASONS_F, 0), d = mesureUltrasons();
            ctx.strokeStyle = 'rgba(28, 126, 214, 0.75)'; ctx.lineWidth = 0.5; ctx.setLineDash([2, 1.5]);
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(robot.a) * d, y + Math.sin(robot.a) * d); ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.save();
        ctx.translate(robot.x, robot.y); ctx.rotate(robot.a);
        ctx.save();
        ctx.scale(ECHELLE_ROBOT, ECHELLE_ROBOT);   // echelle visuelle seulement : les capteurs restent a leur vraie place
        const k = PHOTO.pxParCm;
        if (photo.complete && photo.naturalWidth) {
            // Photo (avant en haut) tournee d'un quart de tour : le haut de l'image pointe vers l'avant du robot.
            ctx.save(); ctx.rotate(Math.PI / 2);
            ctx.drawImage(photo, -PHOTO.centreX / k, -PHOTO.axeY / k, photo.naturalWidth / k, photo.naturalHeight / k);
            ctx.restore();
        } else {   // photo pas encore chargee : silhouette simple
            ctx.fillStyle = '#222';
            ctx.fillRect(-ROUE_D / 2, -CORPS.demiLargeur, ROUE_D, 2);
            ctx.fillRect(-ROUE_D / 2, CORPS.demiLargeur - 2, ROUE_D, 2);
            ctx.fillStyle = '#2f7fd1';
            ctx.beginPath(); ctx.roundRect(CORPS.arriere, -CORPS.demiLargeur + 2, CORPS.avant - CORPS.arriere, 2 * CORPS.demiLargeur - 4, 1.5); ctx.fill();
        }
        if (bloque) {   // contre un mur ou un obstacle : voile rouge
            ctx.fillStyle = 'rgba(201, 42, 42, 0.45)';
            ctx.beginPath(); ctx.roundRect(CORPS.arriere, -CORPS.demiLargeur, CORPS.avant - CORPS.arriere, 2 * CORPS.demiLargeur, 1.5); ctx.fill();
        }
        // LED de la carte, allumees par-dessus la photo
        LEDS_PHOTO.forEach(([px, py], i) => {
            const [r, g, b] = ledsRobot[i];
            if (!(r || g || b)) return;
            const f = (PHOTO.axeY - py) / k, l = (px - PHOTO.centreX) / k;
            const halo = ctx.createRadialGradient(f, l, 0, f, l, 1.6);
            halo.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
            halo.addColorStop(0.4, 'rgba(' + r + ',' + g + ',' + b + ',0.8)');
            halo.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
            ctx.fillStyle = halo;
            ctx.beginPath(); ctx.arc(f, l, 1.6, 0, 2 * Math.PI); ctx.fill();
        });
        ctx.restore();
        // capteurs de ligne
        for (const [cote, l] of Object.entries(LIGNE_L)) {
            ctx.fillStyle = voirCapteurs && surLigne(cote) ? '#40c057' : '#adb5bd';
            ctx.beginPath(); ctx.arc(LIGNE_F, l, 0.55, 0, 2 * Math.PI); ctx.fill();
        }
        ctx.restore();
    }
    function majMesures() {
        $('m-distance').textContent = mesureUltrasons().toLocaleString('fr-FR') + ' cm';
        $('m-ligne').textContent = (surLigne('gauche') ? '●' : '○') + ' ' + (surLigne('droit') ? '●' : '○') + '  (' + valeurLigne() + ')';
        $('m-gauche').textContent = Math.round(robot.rpmG / RPM_100 * 100) + ' %';
        $('m-droite').textContent = Math.round(robot.rpmD / RPM_100 * 100) + ' %';
    }

    // ---------- LED de la carte ----------
    const ledsDom = [$('mc-led1'), $('mc-led2')];
    function majLeds() {
        ledsDom.forEach((el, i) => {
            const [r, g, b] = ledsRobot[i];
            const allumee = r || g || b;
            el.style.background = allumee ? 'rgb(' + r + ',' + g + ',' + b + ')' : '';
            el.style.boxShadow = allumee ? '0 0 10px 3px rgba(' + r + ',' + g + ',' + b + ',0.8)' : '';
        });
    }
    function poserLed(id, r, g, b) {
        const c = [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(Number(x) || 0))));
        if (Number(id) === 0) ledsRobot.forEach((_, i) => { ledsRobot[i] = c.slice(); });
        else { const i = Number(id) - 1; if (i >= 0 && i < 2) ledsRobot[i] = c; }
        majLeds();
    }

    // ---------- Buzzer (Web Audio) ----------
    let audio = null, oscillateur = null;
    function jouerFrequence(f, duree) {
        try {
            audio = audio || new (window.AudioContext || window.webkitAudioContext)();
            arreterSon();
            const o = audio.createOscillator(), g = audio.createGain();
            o.type = 'square'; o.frequency.value = Math.max(20, Math.min(5000, f));
            g.gain.value = 0.08;
            o.connect(g).connect(audio.destination);
            o.start(); o.stop(audio.currentTime + duree);
            oscillateur = o;
        } catch (e) { /* pas de son disponible : la simulation continue */ }
        $('v-son').textContent = 'Buzzer : ' + Math.round(f) + ' Hz';
    }
    function arreterSon() { if (oscillateur) { try { oscillateur.stop(); } catch (e) { /* deja arrete */ } oscillateur = null; } $('v-son').textContent = 'Buzzer : —'; }

    // ---------- Capteur de lumiere, bouton de la carte, telecommande ----------
    const majLumiere = () => { $('v-lumiere').textContent = $('r-lumiere').value; };
    $('r-lumiere').addEventListener('input', majLumiere); majLumiere();
    let boutonEnfonce = false;
    const btnCarte = $('mc-bouton');
    btnCarte.addEventListener('pointerdown', e => { e.preventDefault(); boutonEnfonce = true; btnCarte.classList.add('appuye'); });
    for (const ev of ['pointerup', 'pointerleave']) btnCarte.addEventListener(ev, () => { boutonEnfonce = false; btnCarte.classList.remove('appuye'); });
    let toucheIR = null;
    document.querySelectorAll('[data-ir]').forEach(el => {
        el.addEventListener('pointerdown', e => { e.preventDefault(); toucheIR = Number(el.dataset.ir); el.classList.add('appuye'); });
        for (const ev of ['pointerup', 'pointerleave']) el.addEventListener(ev, () => { if (toucheIR === Number(el.dataset.ir)) toucheIR = null; el.classList.remove('appuye'); });
    });
    const sortiesPorts = {};   // etats ecrits sur les broches des ports RJ25 (affiches dans les mesures)

    // ---------- Aides communes au simulateur et au mode direct ----------
    function texte(x) {   // conversion en texte proche de l'affichage Arduino (2 decimales au plus)
        if (x === true) return '1';
        if (x === false) return '0';
        if (x === null || x === undefined) return '';
        if (typeof x === 'number' && !Number.isInteger(x)) return String(Math.round(x * 100) / 100);
        return String(x);
    }
    const AIDES = {
        vrai: (x) => !!x,
        texte,
        modulo: (a, b) => { a = Number(a); b = Number(b); return a % b; },   // comme fmod en C++
        hasard: (a, b) => { a = Math.ceil(Number(a)); b = Math.floor(Number(b)); if (a > b) [a, b] = [b, a]; return a + Math.floor(Math.random() * (b - a + 1)); },
    };
    const ROUES = { forward: [1, 1], backward: [-1, -1], turn_left: [-1, 1], turn_right: [1, -1] };

    // ---------- Execution d'un programme ----------
    const ARRET = { arret: true };
    let execution = null;
    function console_(texte, classe) { if (window.consoleAjouterLigne) window.consoleAjouterLigne(texte, classe); }

    function creerExecution(code) {
        const run = { actif: true, gestionnaires: [], enCours: new Set(), attentes: new Set(), debut: horloge.t };
        // Attentes sur l'horloge de simulation (pas sur setTimeout) : voir la boucle d'animation.
        const dormir = (ms) => new Promise(res => {
            const a = { t: horloge.t + Math.max(0, Number(ms) || 0) / 1000 };
            a.fin = () => { run.attentes.delete(a.fin); const i = horloge.attentes.indexOf(a); if (i >= 0) horloge.attentes.splice(i, 1); res(); };
            horloge.attentes.push(a);
            run.attentes.add(a.fin);
        }).then(() => { if (!run.actif) throw ARRET; });
        const verifier = () => { if (!run.actif) throw ARRET; };
        const borne = (p) => Math.max(-100, Math.min(100, Number(p) || 0)) / 100 * RPM_100;
        const fixer = (g, d) => { robot.cibleG = borne(g); robot.cibleD = borne(d); };

        const R = Object.assign({}, AIDES, {
            sur(evenement, cle, fn) { run.gestionnaires.push({ evenement, cle, fn }); },
            pas: () => dormir(0),
            attendre: (s) => dormir(Number(s) * 1000),

            // --- deplacements (vitesses en %) ---
            async bouger(sens, v, t) {
                verifier();
                const [g, d] = ROUES[sens];
                fixer(g * Number(v), d * Number(v));
                if (t !== null && t !== undefined) { await dormir(Number(t) * 1000); fixer(0, 0); }
            },
            roues: (g, d) => { verifier(); fixer(g, d); },
            moteur(port, v) { verifier(); if (port === 'M1') robot.cibleG = borne(v); else robot.cibleD = borne(v); },

            // --- capteurs (tous les ports lisent le meme capteur simule) ---
            distance: () => mesureUltrasons(),
            capteurLigne: (port, cote) => surLigne(cote),
            ligne: () => valeurLigne(),
            lumiere: () => Number($('r-lumiere').value),
            bouton: () => boutonEnfonce,
            telecommande: (code) => toucheIR === Number(code),
            chrono: () => Math.round((horloge.t - run.debut) * 100) / 100,
            razChrono() { run.debut = horloge.t; },

            // --- ports RJ25 : rien n'est branche dans le simulateur ---
            portAnalogique: () => 0,
            portNumerique: () => false,
            portEcrire(port, broche, etat) { sortiesPorts[port + '.' + broche] = etat; },

            // --- LED, son, console ---
            led: poserLed,
            async son(f, t) { verifier(); jouerFrequence(Number(f), Number(t)); await dormir(Number(t) * 1000); },
            print: (t) => console_('[simulation] ' + t, 'robot'),
        });

        const api = {
            run,
            demarrer() {
                let preparer;
                try {
                    preparer = new Function('R', 'V', 'FN', '"use strict";\n' + code);
                } catch (e) {
                    console_('Le programme n\'a pas pu être préparé : ' + e.message, 'err');
                    return false;
                }
                try { preparer(R, {}, {}); } catch (e) { console_('Erreur au démarrage : ' + e.message, 'err'); return false; }
                for (const g of run.gestionnaires) {
                    run.enCours.add(g);
                    g.fn().catch(e => {
                        if (e === ARRET) return;
                        console_('Erreur dans le programme : ' + (e && e.message ? e.message : e), 'err');
                    }).finally(() => run.enCours.delete(g));
                }
                return true;
            },
            arreter() {
                run.actif = false;
                for (const fin of Array.from(run.attentes)) fin();
                fixer(0, 0);
                arreterSon();
            },
        };
        return api;
    }

    function lancer(code) {
        arreter();
        ledsRobot.forEach((_, i) => { ledsRobot[i] = [0, 0, 0]; }); majLeds();
        execution = creerExecution(code);
        window.simuEnCours = true;
        if (!execution.demarrer()) arreter();
        else console_('Simulation lancée.', 'info');
    }
    function arreter() {
        if (execution) { execution.arreter(); execution = null; console_('Simulation arrêtée.', 'info'); }
        window.simuEnCours = false;
    }

    // ---------- Boucle d'animation et horloge de simulation ----------
    // Le temps avance par pas de 5 ms (temps reel, une seconde au plus par image). Apres chaque pas, les attentes
    // du programme arrivees a echeance sont reveillees, et le programme s'execute jusqu'a sa prochaine attente avant
    // le pas suivant (une « macro-tache » laisse se terminer tout ce qui a ete reveille). Le programme voit donc ses
    // capteurs toutes les 5 ms, meme si l'affichage ralentit (onglet en arriere-plan, ordinateur charge) :
    // la simulation reste juste, elle va seulement moins vite a l'ecran.
    const canal = new MessageChannel(), suites = [];
    canal.port1.onmessage = () => { const s = suites.shift(); if (s) s(); };
    const macrotache = () => new Promise(r => { suites.push(r); canal.port2.postMessage(0); });
    let precedent = performance.now(), compteurMesures = 0;
    async function boucle(t) {
        let reste = Math.min(1, Math.max(0, (t - precedent) / 1000));
        precedent = t;
        while (reste > 1e-6) {
            const pas = Math.min(0.005, reste);
            avancer(pas);
            horloge.t += pas; reste -= pas;
            const prets = horloge.attentes.filter(a => a.t <= horloge.t + 1e-9);
            for (const a of prets) a.fin();
            if (execution) await macrotache();
        }
        precedent = Math.max(precedent, performance.now() - 50);   // le temps passe a executer le programme n'est pas rattrape
        dessiner();
        if (++compteurMesures % 6 === 0) majMesures();
        requestAnimationFrame(boucle);
    }

    // ---------- Manipulation a la souris ----------
    let prise = null;
    const versCm = (e) => {
        const r = canevas.getBoundingClientRect();
        return [(e.clientX - r.left) / r.width * LARGEUR, (e.clientY - r.top) / r.height * HAUTEUR];
    };
    const obstacleSous = (x, y) => obstacles.slice().reverse().find(o => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
    canevas.addEventListener('pointerdown', (e) => {
        const [x, y] = versCm(e);
        if (Math.hypot(x - robot.x, y - robot.y) < 10 * ECHELLE_ROBOT) prise = { cible: robot, dx: robot.x - x, dy: robot.y - y };
        else { const o = obstacleSous(x, y); if (o) prise = { cible: o, dx: o.x - x, dy: o.y - y }; }
        if (prise) { canevas.setPointerCapture(e.pointerId); canevas.classList.add('glisse'); }
    });
    canevas.addEventListener('pointermove', (e) => {
        if (!prise) return;
        const [x, y] = versCm(e);
        prise.cible.x = Math.max(0, Math.min(LARGEUR - (prise.cible.w || 0), x + prise.dx));
        prise.cible.y = Math.max(0, Math.min(HAUTEUR - (prise.cible.h || 0), y + prise.dy));
    });
    const lacher = () => { prise = null; canevas.classList.remove('glisse'); };
    canevas.addEventListener('pointerup', lacher);
    canevas.addEventListener('pointercancel', lacher);
    canevas.addEventListener('wheel', (e) => {
        const [x, y] = versCm(e);
        if (Math.hypot(x - robot.x, y - robot.y) > 12 * ECHELLE_ROBOT) return;
        e.preventDefault();
        robot.a += (e.deltaY > 0 ? 15 : -15) * Math.PI / 180;
    }, { passive: false });
    canevas.addEventListener('dblclick', (e) => {
        const [x, y] = versCm(e), o = obstacleSous(x, y);
        if (o) obstacles.splice(obstacles.indexOf(o), 1);
    });
    $('btn-obstacle').addEventListener('click', () => {
        const o = { x: 90, y: 20, w: 20, h: 20 };
        if (Math.hypot(robot.x - 100, robot.y - 30) < 25) o.y = 105;
        obstacles.push(o);
    });
    $('btn-replacer').addEventListener('click', replacer);

    // Curseurs « Largeur de la piste » et « Échelle du robot »
    function curseur(id, cle, valeur, format, appliquer) {
        const champ = $(id), affichage = $(id + '-val');
        champ.value = valeur;
        const maj = () => { affichage.textContent = format(Number(champ.value)); };
        champ.addEventListener('input', () => {
            maj(); appliquer(Number(champ.value));
            try { localStorage.setItem(cle, champ.value); } catch (e) { /* navigation privee */ }
        });
        maj();
    }
    curseur('largeur-piste', 'mbot1_largeur_ligne', LARGEUR_LIGNE, v => v.toLocaleString('fr-FR'), v => { LARGEUR_LIGNE = v; dessinerSol(); });
    curseur('echelle-robot', 'mbot1_echelle_robot', ECHELLE_ROBOT, v => '×' + v.toLocaleString('fr-FR'), v => { ECHELLE_ROBOT = v; });
    $('voir-capteurs').addEventListener('change', (e) => { voirCapteurs = e.target.checked; });

    const choix = $('choix-piste');
    for (const [cle, p] of Object.entries(PISTES)) {
        const o = document.createElement('option'); o.value = cle; o.textContent = p.nom; choix.appendChild(o);
    }
    let pisteMemo = 'ovale';
    try { pisteMemo = localStorage.getItem('mbot1_piste') || 'ovale'; } catch (e) { /* navigation privee */ }
    chargerPiste(pisteMemo);
    choix.value = piste;
    choix.addEventListener('change', () => chargerPiste(choix.value));
    requestAnimationFrame(boucle);

    window.Simulateur = {
        lancer, arreter, chargerPiste, AIDES, ROUES, ARRET,
        enCours: () => !!execution,
        // pour les tests (console du navigateur) : etat du robot et des capteurs
        etat: () => ({ x: robot.x, y: robot.y, angle: robot.a * 180 / Math.PI, vitesseG: robot.rpmG / RPM_100 * 100, vitesseD: robot.rpmD / RPM_100 * 100,
                       distance: mesureUltrasons(), ligne: valeurLigne(), leds: ledsRobot.map(l => l.slice()), ports: Object.assign({}, sortiesPorts) }),
        placer: (x, y, a) => Object.assign(robot, { x, y, a: a * Math.PI / 180 }),
    };
})();
