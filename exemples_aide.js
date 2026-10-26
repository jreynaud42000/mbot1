// exemples_aide.js — un petit programme d'exemple pour chaque bloc de la boite a outils (blocs mBot1 et blocs
// generaux : controle, logique, maths, texte, variables, fonctions), montre dans « Aide sur ce bloc » (app.js) :
// dessine en blocs (lecture seule), avec son code C++ et le bouton « Insérer l'exemple ».
// Meme principe que l'editeur mBot2 (blocky_ts_mbot2/exemples_aide.js) et les EXEMPLES_BLOCS de l'editeur micro:bit.
// Le mBot1 n'a pas d'ecran : les exemples ecrivent dans la console de l'ordinateur ou utilisent les LED.
// Chaque exemple compile pour la carte mCore (fonctions a resultat : nombres seulement, voir genererArduino).
//
// Chaque exemple : titre, texte (ce qu'il fait), blocs (piles de blocs au format de serialisation Blockly, sans x/y).
// Plusieurs types de blocs peuvent partager le meme exemple.

(function () {
    'use strict';
    // --- Outils d'ecriture des blocs ---
    const n = v => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
    const t = v => ({ shadow: { type: 'text', fields: { TEXT: v } } });
    const val = (type, champs, entrees) => ({ block: B(type, champs, entrees) });
    function B(type, champs, entrees, extra) {
        return Object.assign({ type }, champs ? { fields: champs } : {}, entrees ? { inputs: entrees } : {}, extra || {});
    }
    /** Accroche les blocs les uns sous les autres et renvoie le premier. */
    function pile(...blocs) {
        for (let i = blocs.length - 2; i >= 0; i--) blocs[i].next = { block: blocs[i + 1] };
        return blocs[0];
    }
    const sous = (chapeau, ...suite) => (suite.length ? Object.assign(chapeau, { next: { block: pile(...suite) } }) : chapeau);
    const demarrage = (...suite) => sous(B('mb_demarrage'), ...suite);
    const toujours = (...corps) => B('mb_toujours', null, { DO: { block: pile(...corps) } });
    const si = (condition, alors, sinon) => B('controls_if', null,
        Object.assign({ IF0: { block: condition }, DO0: { block: alors } }, sinon ? { ELSE: { block: sinon } } : {}),
        sinon ? { extraState: { hasElse: true } } : null);
    const compare = (a, op, b) => B('logic_compare', { OP: op }, { A: { block: a }, B: n(b) });
    const joindre = (texte, bloc) => B('text_join', null, { ADD0: t(texte), ADD1: { block: bloc } }, { extraState: { itemCount: 2 }, inline: true });
    const ecrire = (bloc) => B('mb_print', null, { TEXTE: { block: bloc } });
    const ecrireTexte = (texte) => B('mb_print', null, { TEXTE: t(texte) });
    const attendre = (s) => B('mb_attendre', null, { S: n(s) });
    const attendreQue = (condition) => B('mb_attendre_jusqua', null, { COND: { block: condition } });
    const led = (couleur, quelle) => B('mb_led_couleur', { LED: quelle || '0', COULEUR: couleur });
    const eteindre = (quelle) => B('mb_led_eteindre', { LED: quelle || '0' });
    const stop = () => B('mb_stop');
    const bouger = (sens, v) => B('mb_mouvement', { SENS: sens }, { V: n(v) });
    const pendant = (sens, v, s) => B('mb_avancer_pendant', { SENS: sens }, { V: n(v), T: n(s) });
    const roues = (g, d) => B('mb_roues', null, { G: n(g), D: n(d) });
    const distance = () => B('mb_distance', { PORT: '3' });
    const bouton = () => B('mb_bouton');
    const lireVar = (nom) => B('variables_get', { VAR: { name: nom } });
    const mettre = (nom, bloc) => B('variables_set', { VAR: { name: nom } }, { VALUE: { block: bloc } });

    const EXEMPLES = [
        // ----- Evenements et controle propres au robot -----
        { types: ['mb_demarrage'], titre: 'Dire bonjour au démarrage',
          texte: 'Au démarrage, le robot allume ses deux LED en vert, joue un do et écrit « Bonjour ! » dans la console de l\'ordinateur.',
          blocs: [demarrage(led('#00ff00'), B('mb_son_note', { NOTE: '262', DUREE: '0.5' }), ecrireTexte('Bonjour !'))] },
        { types: ['mb_attendre'], titre: 'Clignoter une fois',
          texte: 'Les LED s\'allument en rouge, le programme attend 1 seconde, puis les éteint.',
          blocs: [demarrage(led('#ff0000'), attendre(1), eteindre())] },
        { types: ['mb_attendre_jusqua'], titre: 'Attendre le signal de départ',
          texte: 'Le robot attend qu\'on appuie sur le bouton de la carte, puis avance pendant 1 seconde.',
          blocs: [demarrage(led('#ffaa00'), attendreQue(bouton()), eteindre(), pendant('forward', 50, 1))] },
        { types: ['mb_toujours', 'mb_distance', 'mb_print'], titre: 'Afficher la distance en continu',
          texte: 'Toutes les demi-secondes, le robot écrit dans la console la distance de l\'obstacle mesurée par les ultrasons. ' +
              'Cliquez sur « Écouter le robot » pour la lire.',
          blocs: [demarrage(toujours(ecrire(joindre('Distance (cm) : ', distance())), attendre(0.5)))] },

        // ----- Deplacements et moteurs -----
        { types: ['mb_avancer_pendant'], titre: 'Aller et retour',
          texte: 'Le robot avance pendant 1 seconde, fait une pause, puis recule pendant 1 seconde : il revient à son point de départ.',
          blocs: [demarrage(pendant('forward', 50, 1), attendre(0.5), pendant('backward', 50, 1))] },
        { types: ['mb_mouvement', 'mb_stop'], titre: 'Avancer, puis s\'arrêter',
          texte: '« avancer à 50 % » démarre les moteurs sans les arrêter ; le robot roule 2 secondes, puis « arrêter le robot » coupe les moteurs.',
          blocs: [demarrage(bouger('forward', 50), attendre(2), stop())] },
        { types: ['mb_roues'], titre: 'Tracer un cercle',
          texte: 'La roue gauche tourne plus vite que la droite : le robot décrit un cercle vers la droite pendant 5 secondes.',
          blocs: [demarrage(roues(60, 30), attendre(5), stop())] },
        { types: ['mb_moteur', 'mb_moteur_stop'], titre: 'Pivoter sur une roue',
          texte: 'Seul le moteur gauche (M1) tourne : le robot pivote autour de sa roue droite pendant 1 seconde.',
          blocs: [demarrage(B('mb_moteur', { PORT: 'M1' }, { V: n(50) }), attendre(1), B('mb_moteur_stop', { PORT: 'M1' }))] },

        // ----- Capteurs -----
        { types: ['mb_capteur_ligne'], titre: 'Témoins du suiveur de ligne',
          texte: 'La LED 2 s\'allume en vert quand le capteur gauche voit la ligne noire, la LED 1 quand c\'est le capteur droit.',
          blocs: [demarrage(toujours(
                    si(B('mb_capteur_ligne', { COTE: 'gauche', PORT: '2' }), led('#00ff00', '2'), eteindre('2')),
                    si(B('mb_capteur_ligne', { COTE: 'droit', PORT: '2' }), led('#00ff00', '1'), eteindre('1'))))] },
        { types: ['mb_ligne_est'], titre: 'Suivre une ligne',
          texte: 'Les deux capteurs sur la ligne : tout droit. Seulement le gauche : la ligne part à gauche, le robot tourne à gauche. ' +
              'Seulement le droit : il tourne à droite. Plus de ligne : il recule pour la retrouver.',
          blocs: [demarrage(toujours(B('controls_if', null, {
                    IF0: val('mb_ligne_est', { ETAT: '0', PORT: '2' }), DO0: { block: roues(40, 40) },
                    IF1: val('mb_ligne_est', { ETAT: '1', PORT: '2' }), DO1: { block: roues(5, 40) },
                    IF2: val('mb_ligne_est', { ETAT: '2', PORT: '2' }), DO2: { block: roues(40, 5) },
                    ELSE: { block: roues(-30, -30) } }, { extraState: { elseIfCount: 2, hasElse: true } })))] },
        { types: ['mb_ligne_valeur'], titre: 'Lire le suiveur de ligne',
          texte: 'Le robot écrit la valeur du suiveur dans la console : 0 (les deux capteurs sur la ligne), 1 (gauche), 2 (droit) ou 3 (aucun).',
          blocs: [demarrage(toujours(ecrire(joindre('Suiveur : ', B('mb_ligne_valeur', { PORT: '2' }))), attendre(0.5)))] },
        { types: ['mb_lumiere'], titre: 'Une veilleuse',
          texte: 'Quand la lumière ambiante baisse sous 300, les LED s\'allument en blanc ; en pleine lumière, elles s\'éteignent.',
          blocs: [demarrage(toujours(si(compare(B('mb_lumiere'), 'LT', 300), led('#ffffff'), eteindre())))] },

        // ----- Carte et telecommande -----
        { types: ['mb_bouton'], titre: 'Une lampe à bouton',
          texte: 'Tant que le bouton de la carte est appuyé, les LED sont bleues ; dès qu\'on le lâche, elles s\'éteignent.',
          blocs: [demarrage(toujours(si(bouton(), led('#0066ff'), eteindre())))] },
        { types: ['mb_ir'], titre: 'Piloter avec la télécommande',
          texte: 'Touche ▲ : le robot avance ; touche ▼ : il recule ; aucune touche : il s\'arrête.',
          blocs: [demarrage(toujours(B('controls_if', null, {
                    IF0: val('mb_ir', { TOUCHE: '64' }), DO0: { block: bouger('forward', 60) },
                    IF1: val('mb_ir', { TOUCHE: '25' }), DO1: { block: bouger('backward', 60) },
                    ELSE: { block: stop() } }, { extraState: { elseIfCount: 1, hasElse: true } })))] },
        { types: ['mb_chrono', 'mb_chrono_raz'], titre: 'Chronométrer un trajet',
          texte: 'Le chronomètre repart de 0, le robot avance jusqu\'à un obstacle à moins de 15 cm, s\'arrête et écrit la durée du trajet dans la console.',
          blocs: [demarrage(B('mb_chrono_raz'), bouger('forward', 40), attendreQue(compare(distance(), 'LT', 15)), stop(),
                            ecrire(joindre('Durée (s) : ', B('mb_chrono'))))] },

        // ----- LED et son -----
        { types: ['mb_led_couleur', 'mb_led_eteindre'], titre: 'Feu bicolore',
          texte: 'La LED 1 s\'allume en rouge et la LED 2 en vert pendant 1 seconde, puis les deux s\'éteignent.',
          blocs: [demarrage(led('#ff0000', '1'), led('#00ff00', '2'), attendre(1), eteindre())] },
        { types: ['mb_led_rvb'], titre: 'Couleurs au hasard',
          texte: 'Toutes les demi-secondes, les LED prennent un mélange de rouge, vert et bleu tiré au hasard.',
          blocs: [demarrage(toujours(B('mb_led_rvb', { LED: '0' }, {
                    R: val('math_random_int', null, { FROM: n(0), TO: n(255) }), V: val('math_random_int', null, { FROM: n(0), TO: n(255) }),
                    B: val('math_random_int', null, { FROM: n(0), TO: n(255) }) }), attendre(0.5)))] },
        { types: ['mb_son_note'], titre: 'Do, ré, mi',
          texte: 'Le buzzer joue trois notes d\'un demi-temps, puis une note longue.',
          blocs: [demarrage(B('mb_son_note', { NOTE: '262', DUREE: '0.25' }), B('mb_son_note', { NOTE: '294', DUREE: '0.25' }),
                            B('mb_son_note', { NOTE: '330', DUREE: '0.25' }), B('mb_son_note', { NOTE: '262', DUREE: '1' }))] },
        { types: ['mb_son_frequence'], titre: 'Une sirène',
          texte: 'Trois fois de suite, le buzzer joue un son grave (600 Hz) puis un son aigu (900 Hz).',
          blocs: [demarrage(B('controls_repeat_ext', null, { TIMES: n(3), DO: { block: pile(
                    B('mb_son_frequence', null, { F: n(600), T: n(0.3) }), B('mb_son_frequence', null, { F: n(900), T: n(0.3) })) } }))] },

        // ----- Ports RJ25 -----
        { types: ['mb_port_analogique'], titre: 'Lire un potentiomètre',
          texte: 'Un potentiomètre branché sur le port 3 : le robot écrit sa position dans la console, de 0 à 1023.',
          blocs: [demarrage(toujours(ecrire(joindre('Potentiomètre : ', B('mb_port_analogique', { PORT: '3', BROCHE: '2' }))), attendre(0.5)))] },
        { types: ['mb_port_numerique'], titre: 'Un interrupteur sur un port',
          texte: 'Un interrupteur branché sur le port 4 : quand sa broche 2 reçoit 5 V, les LED s\'allument en vert.',
          blocs: [demarrage(toujours(si(B('mb_port_numerique', { PORT: '4', BROCHE: '2' }), led('#00ff00'), eteindre())))] },
        { types: ['mb_port_ecrire'], titre: 'Faire clignoter un module LED',
          texte: 'Un module LED branché sur le port 1 : sa broche 2 passe à 5 V puis à 0 V toutes les demi-secondes.',
          blocs: [demarrage(toujours(B('mb_port_ecrire', { PORT: '1', BROCHE: '2', ETAT: 'HIGH' }), attendre(0.5),
                                     B('mb_port_ecrire', { PORT: '1', BROCHE: '2', ETAT: 'LOW' }), attendre(0.5)))] },

        // ----- Blocs generaux (Controle, Logique, Maths, Texte, Variables, Fonctions) -----
        { types: ['controls_repeat_ext'], titre: 'Clignoter 5 fois',
          texte: 'Le bloc « répéter » refait 5 fois : allumer en rouge, attendre, éteindre, attendre.',
          blocs: [demarrage(B('controls_repeat_ext', null, { TIMES: n(5), DO: { block: pile(led('#ff0000'), attendre(0.3), eteindre(), attendre(0.3)) } }))] },
        { types: ['controls_whileUntil'], titre: 'Avancer tant que la voie est libre',
          texte: 'Tant que l\'obstacle est à plus de 20 cm, le robot avance ; dès qu\'il est plus près, la boucle s\'arrête et le robot aussi.',
          blocs: [demarrage(B('controls_whileUntil', { MODE: 'WHILE' }, { BOOL: { block: compare(distance(), 'GT', 20) },
                    DO: { block: bouger('forward', 40) } }), stop())] },
        { types: ['controls_for'], titre: 'Compter de 1 à 10',
          texte: 'La variable i prend les valeurs 1, 2, 3… jusqu\'à 10 ; chaque valeur est écrite dans la console, une par demi-seconde.',
          blocs: [demarrage(B('controls_for', { VAR: { name: 'i' } }, { FROM: n(1), TO: n(10), BY: n(1),
                    DO: { block: pile(ecrire(lireVar('i')), attendre(0.5)) } }))] },
        { types: ['controls_flow_statements'], titre: 'Sortir d\'une boucle',
          texte: 'Le robot compte jusqu\'à 10, mais « sortir de la boucle » l\'arrête dès que i dépasse 5.',
          blocs: [demarrage(B('controls_for', { VAR: { name: 'i' } }, { FROM: n(1), TO: n(10), BY: n(1), DO: { block: pile(
                    si(compare(lireVar('i'), 'GT', 5), B('controls_flow_statements', { FLOW: 'BREAK' })),
                    ecrire(lireVar('i'))) } }))] },
        { types: ['controls_if', 'logic_compare'], titre: 'Freiner devant un obstacle',
          texte: 'Si l\'obstacle est à moins de 20 cm, le robot s\'arrête ; sinon, il avance.',
          blocs: [demarrage(toujours(si(compare(distance(), 'LT', 20), stop(), bouger('forward', 40))))] },
        { types: ['logic_operation'], titre: 'Deux conditions à la fois',
          texte: 'Les LED ne s\'allument que si le bouton est appuyé ET qu\'il fait sombre (lumière sous 300).',
          blocs: [demarrage(toujours(si(B('logic_operation', { OP: 'AND' }, { A: { block: bouton() }, B: { block: compare(B('mb_lumiere'), 'LT', 300) } }),
                    led('#00ff00'), eteindre())))] },
        { types: ['logic_negate'], titre: 'Clignoter en attendant',
          texte: 'Tant que le bouton n\'est PAS appuyé, les LED clignotent ; un appui arrête le clignotement et le robot avance.',
          blocs: [demarrage(B('controls_whileUntil', { MODE: 'WHILE' }, { BOOL: { block: B('logic_negate', null, { BOOL: { block: bouton() } }) },
                    DO: { block: pile(led('#ffaa00'), attendre(0.2), eteindre(), attendre(0.2)) } }), pendant('forward', 50, 1))] },
        { types: ['logic_boolean'], titre: 'Un interrupteur',
          texte: 'La variable « en_marche » vaut vrai au départ : le robot avance. Un appui sur le bouton la met à faux : il s\'arrête.',
          blocs: [demarrage(mettre('en_marche', B('logic_boolean', { BOOL: 'TRUE' })),
                            toujours(si(bouton(), mettre('en_marche', B('logic_boolean', { BOOL: 'FALSE' }))),
                                     si(lireVar('en_marche'), bouger('forward', 40), stop())))] },

        { types: ['math_number', 'math_arithmetic'], titre: 'Calculer une durée',
          texte: 'Le robot écrit 3 × 20 = 60 dans la console, puis avance pendant 10 ÷ 4 = 2,5 secondes.',
          blocs: [demarrage(ecrire(B('math_arithmetic', { OP: 'MULTIPLY' }, { A: n(3), B: n(20) })),
                            B('mb_avancer_pendant', { SENS: 'forward' }, { V: n(50), T: { block: B('math_arithmetic', { OP: 'DIVIDE' }, { A: n(10), B: n(4) }) } }))] },
        { types: ['math_random_int'], titre: 'Promenade au hasard',
          texte: 'Quatre fois : le robot tourne pendant une durée tirée au hasard (de 0,1 à 0,5 seconde), puis avance pendant 1 seconde.',
          blocs: [demarrage(B('controls_repeat_ext', null, { TIMES: n(4), DO: { block: pile(
                    B('mb_avancer_pendant', { SENS: 'turn_right' }, { V: n(50), T: { block: B('math_arithmetic', { OP: 'DIVIDE' }, {
                        A: val('math_random_int', null, { FROM: n(1), TO: n(5) }), B: n(10) }) } }),
                    pendant('forward', 50, 1)) } }))] },
        { types: ['math_round'], titre: 'Arrondir une mesure',
          texte: 'La distance est arrondie au centimètre près avant d\'être écrite dans la console.',
          blocs: [demarrage(toujours(ecrire(B('math_round', { OP: 'ROUND' }, { NUM: { block: distance() } })), attendre(0.5)))] },
        { types: ['math_single'], titre: 'Écart sans signe',
          texte: '« valeur absolue » enlève le signe : la console montre de combien la lumière s\'écarte de 500, qu\'il fasse plus clair ou plus sombre.',
          blocs: [demarrage(toujours(ecrire(B('math_single', { OP: 'ABS' }, { NUM: { block: B('math_arithmetic', { OP: 'MINUS' }, {
                    A: val('mb_lumiere'), B: n(500) }) } })), attendre(0.5)))] },
        { types: ['math_modulo'], titre: 'Pair ou impair',
          texte: 'Pour i de 1 à 6 : si le reste de i ÷ 2 vaut 0 (nombre pair), les LED sont vertes, sinon rouges.',
          blocs: [demarrage(B('controls_for', { VAR: { name: 'i' } }, { FROM: n(1), TO: n(6), BY: n(1), DO: { block: pile(
                    si(B('logic_compare', { OP: 'EQ' }, { A: { block: B('math_modulo', null, { DIVIDEND: { block: lireVar('i') }, DIVISOR: n(2) }) }, B: n(0) }),
                       led('#00ff00'), led('#ff0000')),
                    attendre(0.5)) } }))] },
        { types: ['math_constrain'], titre: 'Ralentir près d\'un obstacle',
          texte: 'La vitesse vaut la distance mesurée, mais elle reste entre 0 et 60 % : le robot ralentit en approchant d\'un mur et s\'arrête contre lui.',
          blocs: [demarrage(toujours(
                    mettre('vitesse', B('math_constrain', null, { VALUE: { block: distance() }, LOW: n(0), HIGH: n(60) })),
                    B('mb_roues', null, { G: val('variables_get', { VAR: { name: 'vitesse' } }), D: val('variables_get', { VAR: { name: 'vitesse' } }) })))] },

        { types: ['text', 'text_join'], titre: 'Un message composé',
          texte: '« créer un texte avec » colle des morceaux : un texte, la distance mesurée, puis l\'unité.',
          blocs: [demarrage(toujours(ecrire(B('text_join', null, { ADD0: t('Distance : '), ADD1: { block: distance() }, ADD2: t(' cm') },
                    { extraState: { itemCount: 3 }, inline: true })), attendre(1)))] },
        { types: ['text_length'], titre: 'Compter les lettres',
          texte: 'Le robot écrit dans la console le nombre de lettres du mot « mBot1 » : 5.',
          blocs: [demarrage(ecrire(joindre('Lettres : ', B('text_length', null, { VALUE: t('mBot1') }))))] },

        { types: ['variables_set', 'variables_get', 'math_change'], titre: 'Compter les appuis',
          texte: 'La variable « compteur » part de 0 ; chaque appui sur le bouton de la carte lui ajoute 1, et sa valeur est écrite dans la console.',
          blocs: [demarrage(mettre('compteur', B('math_number', { NUM: 0 })),
                            toujours(attendreQue(bouton()), B('math_change', { VAR: { name: 'compteur' } }, { DELTA: n(1) }),
                                     ecrire(lireVar('compteur')), attendreQue(B('logic_negate', null, { BOOL: { block: bouton() } }))))] },

        { types: ['procedures_defnoreturn', 'procedures_callnoreturn'], titre: 'Une fonction « clignoter »',
          texte: 'La fonction « clignoter » regroupe 4 blocs ; le programme l\'appelle 3 fois au lieu de recopier les blocs.',
          blocs: [B('procedures_defnoreturn', { NAME: 'clignoter' }, { STACK: { block: pile(led('#ff0000'), attendre(0.2), eteindre(), attendre(0.2)) } }),
                  demarrage(B('controls_repeat_ext', null, { TIMES: n(3), DO: { block: B('procedures_callnoreturn', null, null, { extraState: { name: 'clignoter' } }) } }))] },
        { types: ['procedures_defreturn', 'procedures_callreturn', 'procedures_ifreturn'], titre: 'Une fonction qui renvoie une vitesse',
          texte: 'La fonction « vitesse_sure » reçoit une distance x : si x est inférieure à 20 cm, elle renvoie 0, sinon 50. ' +
              'Le robot roule à la vitesse renvoyée : il s\'arrête devant un obstacle.',
          blocs: [B('procedures_defreturn', { NAME: 'vitesse_sure' }, {
                      STACK: { block: B('procedures_ifreturn', null, { CONDITION: { block: compare(lireVar('x'), 'LT', 20) }, VALUE: n(0) },
                                        { extraState: '<mutation value="1"></mutation>' }) },
                      RETURN: n(50) }, { extraState: { params: [{ name: 'x' }] } }),
                  demarrage(toujours(mettre('vitesse', B('procedures_callreturn', null, { ARG0: { block: distance() } }, { extraState: { name: 'vitesse_sure', params: ['x'] } })),
                                     B('mb_roues', null, { G: val('variables_get', { VAR: { name: 'vitesse' } }), D: val('variables_get', { VAR: { name: 'vitesse' } }) })))] },
    ];

    const parType = {};
    for (const ex of EXEMPLES) for (const type of ex.types) parType[type] = ex;
    window.EXEMPLES_AIDE_MBOT1 = parType;
})();
