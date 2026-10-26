// blocs.js — blocs du mBot1 (carte mCore, ATmega328P compatible Arduino Uno), generateur C++ Arduino (bibliotheque
// MeMCore de Makeblock, forme proche du code produit par mBlock en mode Arduino) et generateur « SIMU » (JavaScript
// asynchrone execute par le simulateur, simulateur.js, ET par le mode direct sur le vrai robot, direct.js).
//
// Conventions choisies pour les eleves : sur tous les blocs, une vitesse POSITIVE fait avancer la roue, en % (-100 a 100).
// Sur le vrai robot, le moteur gauche (M1) est monte en miroir : le generateur C++ inverse son signe
// (avancer = motor_9.run(-v) ; motor_10.run(v), comme le code produit par mBlock). 100 % = 255 (pleine tension).
// Sources : bibliotheque Makeblock-Libraries (MeMCore.h, MeDCMotor, MeUltrasonicSensor, MeLineFollower, MeRGBLed,
// MeBuzzer, MeLightSensor, MeIR, MePort) et code Arduino genere par mBlock pour le mBot.

(function () {
    'use strict';

    // ==========================================
    // 1. DEFINITIONS DES BLOCS
    // ==========================================
    const PORTS = [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']];
    const avecDefaut = (defaut) => [[defaut, defaut]].concat(PORTS.filter(p => p[0] !== defaut));   // premier choix = port habituel
    const PORTS_ANALOGIQUES = [['3', '3'], ['4', '4']];   // ports 1 et 2 : broches numeriques seulement (MeMCore.h)
    const BROCHES = [['1', '1'], ['2', '2']];
    const LEDS = [['les deux LED', '0'], ['la LED 1', '1'], ['la LED 2', '2']];
    const MOTEURS = [['gauche (M1)', 'M1'], ['droit (M2)', 'M2']];
    const NOTES = [['do', '262'], ['ré', '294'], ['mi', '330'], ['fa', '349'], ['sol', '392'], ['la', '440'], ['si', '494'], ['do aigu', '523']];
    const DUREES = [['1/4 de temps', '0.125'], ['1/2 temps', '0.25'], ['1 temps', '0.5'], ['2 temps', '1']];   // 1 temps = 0,5 s (tempo 120)
    // Codes des touches de la telecommande infrarouge du mBot (protocole NEC, valeurs de MeIR.h et de mBlock).
    const TOUCHES_IR = [['A', '69'], ['B', '70'], ['C', '71'], ['D', '68'], ['E', '67'], ['F', '13'],
                        ['▲ (haut)', '64'], ['▼ (bas)', '25'], ['◀ (gauche)', '7'], ['▶ (droite)', '9'], ['⚙ (réglage)', '21'],
                        ['0', '22'], ['1', '12'], ['2', '24'], ['3', '94'], ['4', '8'], ['5', '28'], ['6', '90'], ['7', '66'], ['8', '82'], ['9', '74']];
    // Valeur renvoyee par MeLineFollower.readSensors() : bit 1 = capteur gauche (S1), bit 0 = capteur droit (S2), 0 = sur le noir.
    const ETATS_LIGNE = [['les deux capteurs sur la ligne', '0'], ['seulement le gauche sur la ligne', '1'],
                         ['seulement le droit sur la ligne', '2'], ['aucun capteur sur la ligne', '3']];

    const nombre = (nom) => ({ type: 'input_value', name: nom, check: 'Number' });
    const valeur = (nom) => ({ type: 'input_value', name: nom });
    const menu = (nom, options) => ({ type: 'field_dropdown', name: nom, options });
    const instr = (def) => Object.assign({ previousStatement: null, nextStatement: null, inputsInline: true }, def);
    const reporteur = (def, sortie) => Object.assign({ output: sortie === undefined ? 'Number' : sortie, inputsInline: true }, def);

    Blockly.defineBlocksWithJsonArray([
        // ----- Evenements -----
        { type: 'mb_demarrage', message0: 'quand le programme démarre', nextStatement: null,
          tooltip: 'Les blocs placés dessous s\'exécutent au démarrage du robot (ou au lancement de la simulation). Pour répéter, utilisez « répéter indéfiniment ».' },

        // ----- Controle -----
        instr({ type: 'mb_attendre', message0: 'attendre %1 secondes', args0: [nombre('S')], tooltip: 'Met le programme en pause pendant cette durée (en secondes).' }),
        instr({ type: 'mb_attendre_jusqua', message0: 'attendre jusqu\'à %1', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
          tooltip: 'Met le programme en pause jusqu\'à ce que la condition devienne vraie.' }),
        instr({ type: 'mb_toujours', message0: 'répéter indéfiniment %1 %2', args0: [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }],
          nextStatement: undefined, tooltip: 'Répète les blocs à l\'intérieur sans jamais s\'arrêter.' }),

        // ----- Deplacements -----
        instr({ type: 'mb_avancer_pendant', message0: '%1 à %2 % pendant %3 secondes',
          args0: [menu('SENS', [['avancer', 'forward'], ['reculer', 'backward'], ['tourner à gauche', 'turn_left'], ['tourner à droite', 'turn_right']]), nombre('V'), nombre('T')],
          tooltip: 'Le robot bouge à cette vitesse (0 à 100 % de la puissance des moteurs) pendant cette durée, puis s\'arrête. Pour tourner, il pivote sur place.' }),
        instr({ type: 'mb_mouvement', message0: '%1 à %2 %',
          args0: [menu('SENS', [['avancer', 'forward'], ['reculer', 'backward'], ['tourner à gauche', 'turn_left'], ['tourner à droite', 'turn_right']]), nombre('V')],
          tooltip: 'Démarre le mouvement sans s\'arrêter : le robot continue jusqu\'au prochain bloc de déplacement ou « arrêter le robot ».' }),
        instr({ type: 'mb_roues', message0: 'vitesse roue gauche %1 % droite %2 %', args0: [nombre('G'), nombre('D')],
          tooltip: 'Règle la vitesse de chaque roue, de -100 % à 100 %. Positif : la roue fait avancer le robot. Deux vitesses différentes : le robot tourne.' }),
        instr({ type: 'mb_stop', message0: 'arrêter le robot', tooltip: 'Arrête les deux moteurs.' }),

        // ----- Moteurs -----
        instr({ type: 'mb_moteur', message0: 'faire tourner le moteur %1 à %2 %', args0: [menu('PORT', MOTEURS), nombre('V')],
          tooltip: 'Fait tourner un seul moteur, de -100 % à 100 %. Positif : la roue fait avancer le robot.' }),
        instr({ type: 'mb_moteur_stop', message0: 'arrêter le moteur %1', args0: [menu('PORT', MOTEURS)], tooltip: 'Arrête ce moteur.' }),

        // ----- Capteurs -----
        reporteur({ type: 'mb_distance', message0: 'distance mesurée par les ultrasons (cm), port %1', args0: [menu('PORT', avecDefaut('3'))],
          tooltip: 'Distance de l\'obstacle devant le capteur à ultrasons, de 3 à 400 cm (400 si rien n\'est détecté). Le capteur est branché sur le port 3 du mBot.' }),
        reporteur({ type: 'mb_capteur_ligne', message0: 'le capteur %1 du suiveur de ligne voit la ligne ? port %2',
          args0: [menu('COTE', [['gauche', 'gauche'], ['droit', 'droit']]), menu('PORT', avecDefaut('2'))],
          tooltip: 'Vrai si ce capteur est au-dessus de la ligne noire (sa LED bleue s\'éteint). Le suiveur de ligne est branché sur le port 2 du mBot.' }, 'Boolean'),
        reporteur({ type: 'mb_ligne_est', message0: 'le suiveur de ligne indique %1 ? port %2', args0: [menu('ETAT', ETATS_LIGNE), menu('PORT', avecDefaut('2'))],
          tooltip: 'Vrai si les deux capteurs du suiveur de ligne sont dans cette situation.' }, 'Boolean'),
        reporteur({ type: 'mb_ligne_valeur', message0: 'valeur du suiveur de ligne (0 à 3), port %1', args0: [menu('PORT', avecDefaut('2'))],
          tooltip: '0 : les deux capteurs sur la ligne ; 1 : seulement le gauche ; 2 : seulement le droit ; 3 : aucun.' }),
        reporteur({ type: 'mb_lumiere', message0: 'lumière ambiante (0 à 1023)',
          tooltip: 'Lumière reçue par le capteur de la carte mCore : petite valeur dans le noir, grande valeur en pleine lumière.' }),

        // ----- Carte et telecommande -----
        reporteur({ type: 'mb_bouton', message0: 'le bouton de la carte est appuyé ?', tooltip: 'Vrai tant que le bouton de la carte mCore est enfoncé.' }, 'Boolean'),
        reporteur({ type: 'mb_ir', message0: 'la touche %1 de la télécommande est appuyée ?', args0: [menu('TOUCHE', TOUCHES_IR)],
          tooltip: 'Vrai tant que cette touche de la télécommande infrarouge est appuyée (télécommande tournée vers le récepteur de la carte).' }, 'Boolean'),
        reporteur({ type: 'mb_chrono', message0: 'chronomètre (s)', tooltip: 'Temps écoulé en secondes depuis le démarrage ou la dernière remise à zéro.' }),
        instr({ type: 'mb_chrono_raz', message0: 'remettre le chronomètre à zéro', tooltip: 'Le chronomètre repart de 0.' }),

        // ----- LED -----
        instr({ type: 'mb_led_couleur', message0: 'allumer %1 en %2', args0: [menu('LED', LEDS), { type: 'field_colour', name: 'COULEUR', colour: '#ff0000' }],
          tooltip: 'Allume une des deux LED de la carte mCore (ou les deux) dans cette couleur.' }),
        instr({ type: 'mb_led_rvb', message0: 'allumer %1 rouge %2 vert %3 bleu %4', args0: [menu('LED', LEDS), nombre('R'), nombre('V'), nombre('B')],
          tooltip: 'Allume une LED avec un mélange de rouge, vert et bleu (chacun de 0 à 255).' }),
        instr({ type: 'mb_led_eteindre', message0: 'éteindre %1', args0: [menu('LED', LEDS)], tooltip: 'Éteint une LED de la carte, ou les deux.' }),

        // ----- Son -----
        instr({ type: 'mb_son_note', message0: 'jouer la note %1 pendant %2', args0: [menu('NOTE', NOTES), menu('DUREE', DUREES)],
          tooltip: 'Joue une note de musique avec le buzzer de la carte. Un temps dure une demi-seconde.' }),
        instr({ type: 'mb_son_frequence', message0: 'jouer un son de %1 Hz pendant %2 secondes', args0: [nombre('F'), nombre('T')],
          tooltip: 'Joue un son de cette fréquence (100 à 5000 Hz). Grave : petite fréquence, aigu : grande fréquence. Le programme attend la fin du son.' }),

        // ----- Ports RJ25 -----
        reporteur({ type: 'mb_port_analogique', message0: 'valeur analogique du port %1 broche %2 (0 à 1023)', args0: [menu('PORT', PORTS_ANALOGIQUES), menu('BROCHE', BROCHES)],
          tooltip: 'Tension lue sur une broche d\'un port RJ25 (0 = 0 V, 1023 = 5 V). Seuls les ports 3 et 4 ont des entrées analogiques.' }),
        reporteur({ type: 'mb_port_numerique', message0: 'la broche %2 du port %1 est à l\'état haut ?', args0: [menu('PORT', PORTS), menu('BROCHE', BROCHES)],
          tooltip: 'Vrai si la broche reçoit 5 V (état haut), faux si elle est à 0 V.' }, 'Boolean'),
        instr({ type: 'mb_port_ecrire', message0: 'mettre la broche %2 du port %1 à l\'état %3', args0: [menu('PORT', PORTS), menu('BROCHE', BROCHES), menu('ETAT', [['5 V (haut)', 'HIGH'], ['0 V (bas)', 'LOW']])],   // aucun mot commun : Blockly sortirait « V) » du menu
          tooltip: 'Envoie 5 V (haut) ou 0 V (bas) sur une broche d\'un port RJ25, par exemple pour un module LED.' }),

        // ----- Ordinateur -----
        instr({ type: 'mb_print', message0: 'écrire %1 dans la console de l\'ordinateur', args0: [valeur('TEXTE')],
          tooltip: 'Envoie un texte à l\'ordinateur par le câble USB (console, bouton « Écouter le robot »). Utile pour lire des mesures.' }),
    ]);

    // Bloc « chapeau » : debut du programme. Forme arrondie posee dans init : la cle JSON « style: {hat} » de
    // Blockly 10 n'agit que sur le PREMIER bloc cree (jsonInit efface alors l'objet partage).
    const CHAPEAUX = ['mb_demarrage'];
    for (const type of CHAPEAUX) {
        const init = Blockly.Blocks[type].init;
        Blockly.Blocks[type].init = function () { init.call(this); this.hat = 'cap'; };
    }

    // ==========================================
    // 2. GENERATEUR C++ ARDUINO (bibliotheque MeMCore)
    // ==========================================
    const A = new Blockly.Generator('Arduino');
    A.INDENT = '  ';
    // Priorites des operateurs C++ (petit = lie plus fort), sur le modele du generateur JavaScript de Blockly.
    Object.assign(A, { ORDER_ATOMIC: 0, ORDER_FUNCTION_CALL: 2, ORDER_UNARY: 3, ORDER_MULTIPLICATIVE: 5, ORDER_ADDITIVE: 6,
                       ORDER_RELATIONAL: 8, ORDER_EQUALITY: 9, ORDER_LOGICAL_AND: 13, ORDER_LOGICAL_OR: 14, ORDER_CONDITIONAL: 15,
                       ORDER_ASSIGNMENT: 16, ORDER_NONE: 99, ORDER_OVERRIDES: [] });
    const RESERVES = 'setup,loop,_loop,_delay,_roues,_chrono0,motor_9,motor_10,rgbled_7,buzzer,lightsensor_6,ir,Serial,String,' +
        'int,long,float,double,char,bool,boolean,void,byte,word,unsigned,signed,short,const,static,volatile,auto,return,if,else,for,while,do,' +
        'switch,case,default,break,continue,goto,true,false,HIGH,LOW,INPUT,OUTPUT,class,struct,new,delete,this,public,private,namespace,' +
        'delay,millis,micros,random,constrain,map,abs,min,max,pow,sqrt,round,floor,ceil,fmod,exp,log,log10,sin,cos,tan,analogRead,digitalRead,' +
        'digitalWrite,pinMode,M1,M2,PORT_1,PORT_2,PORT_3,PORT_4';
    A.addReservedWords(RESERVES);

    A.init = function (ws) {
        Object.getPrototypeOf(this).init.call(this, ws);
        this.definitions_ = Object.create(null);   // declarations globales (objets, variables, fonctions d'aide)
        this.setups_ = Object.create(null);        // lignes de setup() avant le programme
        this.boucle_ = Object.create(null);        // lignes de _loop() : taches de fond (telecommande)
        if (!this.nameDB_) this.nameDB_ = new Blockly.Names(this.RESERVED_WORDS_);
        else this.nameDB_.reset();
        this.nameDB_.setVariableMap(ws.getVariableMap());
        this.nameDB_.populateVariables(ws);
        this.nameDB_.populateProcedures(ws);
    };
    A.scrub_ = function (b, code, seul) {
        const suite = b.nextConnection && b.nextConnection.targetBlock();
        return code + (suite && !seul ? this.blockToCode(suite) : '');
    };
    A.scrubNakedValue = (code) => code + ';\n';
    A.quote_ = (t) => '"' + String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';

    const I = () => A.INDENT;
    const v = (b, nom, defaut, ordre) => A.valueToCode(b, nom, ordre === undefined ? A.ORDER_NONE : ordre) || (defaut === undefined ? '0' : defaut);
    const nomVarC = (b) => A.nameDB_.getName(b.getFieldValue('VAR'), Blockly.Names.NameType.VARIABLE);
    const estNombre = (code) => /^-?\d+(\.\d+)?$/.test(code);
    const rvb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const objet = (cle, ligne) => { A.definitions_[cle] = ligne; };
    const enSetup = (cle, ligne) => { A.setups_[cle] = ligne; };
    // Pourcentage -> commande moteur (-255 a 255). Nombre ecrit dans le bloc : calcul fait ici, le code reste lisible.
    const pwm = (code) => estNombre(code) ? String(Math.round(Math.max(-100, Math.min(100, Number(code))) * 2.55)) : '(' + code + ') * 2.55';
    const oppose = (code) => estNombre(code) ? String(-Number(code)) : '-(' + code + ')';

    function moteurs() {
        objet('a_moteurs', 'MeDCMotor motor_9(M1);   // moteur gauche, monté en miroir : son signe est inversé\nMeDCMotor motor_10(M2);  // moteur droit');
        objet('c_roues', '// Vitesse de chaque roue en % (-100 à 100) ; positif = la roue fait avancer le robot.\n' +
            'void _roues(float gauche, float droite) {\n' +
            '  motor_9.run(-constrain(gauche, -100, 100) * 2.55);\n' +
            '  motor_10.run(constrain(droite, -100, 100) * 2.55);\n}');
    }
    const ultrasons = (port) => { objet('a_ultrasons_' + port, 'MeUltrasonicSensor ultrasonic_' + port + '(PORT_' + port + ');'); return 'ultrasonic_' + port; };
    const suiveur = (port) => { objet('a_ligne_' + port, 'MeLineFollower linefollower_' + port + '(PORT_' + port + ');'); return 'linefollower_' + port; };
    const portRJ = (port) => { objet('a_port_' + port, 'MePort port_' + port + '(PORT_' + port + ');'); return 'port_' + port; };
    function leds() {
        objet('a_leds', 'MeRGBLed rgbled_7(7, 2);  // les 2 LED RGB de la carte');
        enSetup('leds', 'rgbled_7.setpin(13);');
    }
    const buzzer = () => objet('a_buzzer', 'MeBuzzer buzzer;');
    function chrono() { objet('b_chrono', 'double _chrono0 = 0;  // instant de la dernière remise à zéro du chronomètre (s)'); }

    const F = A.forBlock;
    F['mb_demarrage'] = () => '';   // le corps est place dans setup() par genererArduino

    F['mb_attendre'] = b => '_delay(' + v(b, 'S') + ');\n';
    F['mb_attendre_jusqua'] = b => 'while (!(' + v(b, 'COND', 'false') + ')) {\n' + I() + '_loop();\n}\n';
    F['mb_toujours'] = b => 'while (true) {\n' + A.statementToCode(b, 'DO') + I() + '_loop();\n}\n';

    const ROUES = { forward: (x) => [x, x], backward: (x) => [oppose(x), oppose(x)], turn_left: (x) => [oppose(x), x], turn_right: (x) => [x, oppose(x)] };
    F['mb_avancer_pendant'] = b => {
        moteurs();
        return '_roues(' + ROUES[b.getFieldValue('SENS')](v(b, 'V')).join(', ') + ');\n_delay(' + v(b, 'T') + ');\n_roues(0, 0);\n';
    };
    F['mb_mouvement'] = b => { moteurs(); return '_roues(' + ROUES[b.getFieldValue('SENS')](v(b, 'V')).join(', ') + ');\n'; };
    F['mb_roues'] = b => { moteurs(); return '_roues(' + v(b, 'G') + ', ' + v(b, 'D') + ');\n'; };
    F['mb_stop'] = () => { moteurs(); return '_roues(0, 0);\n'; };
    F['mb_moteur'] = b => {
        moteurs();
        return b.getFieldValue('PORT') === 'M1' ? 'motor_9.run(' + oppose(pwm(v(b, 'V'))) + ');\n' : 'motor_10.run(' + pwm(v(b, 'V')) + ');\n';
    };
    F['mb_moteur_stop'] = b => { moteurs(); return (b.getFieldValue('PORT') === 'M1' ? 'motor_9' : 'motor_10') + '.stop();\n'; };

    F['mb_distance'] = b => [ultrasons(b.getFieldValue('PORT')) + '.distanceCm()', A.ORDER_FUNCTION_CALL];
    F['mb_capteur_ligne'] = b => ['(' + suiveur(b.getFieldValue('PORT')) + '.readSensors() & ' + (b.getFieldValue('COTE') === 'gauche' ? '2' : '1') + ') == 0', A.ORDER_EQUALITY];
    F['mb_ligne_est'] = b => [suiveur(b.getFieldValue('PORT')) + '.readSensors() == ' + b.getFieldValue('ETAT'), A.ORDER_EQUALITY];
    F['mb_ligne_valeur'] = b => [suiveur(b.getFieldValue('PORT')) + '.readSensors()', A.ORDER_FUNCTION_CALL];
    F['mb_lumiere'] = () => { objet('a_lumiere', 'MeLightSensor lightsensor_6(6);  // capteur de lumière de la carte'); return ['lightsensor_6.read()', A.ORDER_FUNCTION_CALL]; };

    F['mb_bouton'] = () => ['analogRead(A7) < 10', A.ORDER_RELATIONAL];   // bouton de la carte sur A7 : 0 V quand il est appuye
    F['mb_ir'] = b => {
        objet('a_ir', 'MeIR ir;  // récepteur infrarouge de la carte');
        enSetup('ir', 'ir.begin();');
        A.boucle_['ir'] = 'ir.loop();';
        return ['ir.keyPressed(' + b.getFieldValue('TOUCHE') + ')', A.ORDER_FUNCTION_CALL];
    };
    F['mb_chrono'] = () => { chrono(); return ['(millis() / 1000.0 - _chrono0)', A.ORDER_ATOMIC]; };
    F['mb_chrono_raz'] = () => { chrono(); return '_chrono0 = millis() / 1000.0;\n'; };

    const ledCode = (id, r, g, bl) => { leds(); return 'rgbled_7.setColor(' + id + ', ' + r + ', ' + g + ', ' + bl + ');\nrgbled_7.show();\n'; };
    F['mb_led_couleur'] = b => ledCode(b.getFieldValue('LED'), ...rvb(b.getFieldValue('COULEUR')));
    F['mb_led_rvb'] = b => ledCode(b.getFieldValue('LED'), v(b, 'R'), v(b, 'V'), v(b, 'B'));
    F['mb_led_eteindre'] = b => ledCode(b.getFieldValue('LED'), 0, 0, 0);

    const ms = (code) => estNombre(code) ? String(Math.round(Number(code) * 1000)) : '(' + code + ') * 1000';
    F['mb_son_note'] = b => { buzzer(); return 'buzzer.tone(' + b.getFieldValue('NOTE') + ', ' + ms(b.getFieldValue('DUREE')) + ');\n'; };
    F['mb_son_frequence'] = b => { buzzer(); return 'buzzer.tone(' + v(b, 'F') + ', ' + ms(v(b, 'T')) + ');\n'; };

    F['mb_port_analogique'] = b => [portRJ(b.getFieldValue('PORT')) + '.aRead' + b.getFieldValue('BROCHE') + '()', A.ORDER_FUNCTION_CALL];
    F['mb_port_numerique'] = b => [portRJ(b.getFieldValue('PORT')) + '.dRead' + b.getFieldValue('BROCHE') + '()', A.ORDER_FUNCTION_CALL];
    F['mb_port_ecrire'] = b => portRJ(b.getFieldValue('PORT')) + '.dWrite' + b.getFieldValue('BROCHE') + '(' + b.getFieldValue('ETAT') + ');\n';

    F['mb_print'] = b => { enSetup('serie', 'Serial.begin(115200);'); return 'Serial.println(' + v(b, 'TEXTE', '""') + ');\n'; };

    // --- blocs standard de Blockly ---
    F['controls_if'] = b => {
        let code = '', n = 0;
        do {
            code += (n ? ' else ' : '') + 'if (' + v(b, 'IF' + n, 'false') + ') {\n' + A.statementToCode(b, 'DO' + n) + '}';
            n++;
        } while (b.getInput('IF' + n));
        if (b.getInput('ELSE')) code += ' else {\n' + A.statementToCode(b, 'ELSE') + '}';
        return code + '\n';
    };
    F['controls_repeat_ext'] = b => {
        const i = A.nameDB_.getDistinctName('i', Blockly.Names.NameType.VARIABLE);
        return 'for (int ' + i + ' = 0; ' + i + ' < ' + v(b, 'TIMES', '0', A.ORDER_RELATIONAL) + '; ' + i + '++) {\n' + A.statementToCode(b, 'DO') + I() + '_loop();\n}\n';
    };
    F['controls_whileUntil'] = b => {
        const jusqua = b.getFieldValue('MODE') === 'UNTIL';
        const cond = v(b, 'BOOL', 'false', jusqua ? A.ORDER_UNARY : A.ORDER_NONE);
        return 'while (' + (jusqua ? '!' + cond : cond) + ') {\n' + A.statementToCode(b, 'DO') + I() + '_loop();\n}\n';
    };
    F['controls_for'] = b => {
        // Comme les blocs Blockly : bornes comprises, sens donne par les bornes, pas toujours positif.
        const x = nomVarC(b), de = v(b, 'FROM'), a = v(b, 'TO'), pas = v(b, 'BY', '1');
        if (estNombre(de) && estNombre(a) && estNombre(pas)) {
            const monte = Number(de) <= Number(a), p = Math.abs(Number(pas)) || 1;
            return 'for (' + x + ' = ' + de + '; ' + x + (monte ? ' <= ' : ' >= ') + a + '; ' + x + (monte ? ' += ' : ' -= ') + p + ') {\n' +
                A.statementToCode(b, 'DO') + I() + '_loop();\n}\n';
        }
        const s = A.nameDB_.getDistinctName(x + '_sens', Blockly.Names.NameType.VARIABLE);
        const fin = A.nameDB_.getDistinctName(x + '_fin', Blockly.Names.NameType.VARIABLE);
        const p = A.nameDB_.getDistinctName(x + '_pas', Blockly.Names.NameType.VARIABLE);
        return x + ' = ' + de + ';\n{\n' + I() + 'float ' + fin + ' = ' + a + ';\n' + I() + 'float ' + p + ' = fabs(' + pas + ');\n' +
            I() + 'float ' + s + ' = ' + x + ' <= ' + fin + ' ? 1 : -1;\n' +
            I() + 'for (; ' + s + ' > 0 ? ' + x + ' <= ' + fin + ' : ' + x + ' >= ' + fin + '; ' + x + ' += ' + s + ' * ' + p + ') {\n' +
            A.prefixLines(A.statementToCode(b, 'DO') + I() + '_loop();\n', I()) + I() + '}\n}\n';
    };
    F['controls_flow_statements'] = b => (b.getFieldValue('FLOW') === 'BREAK' ? 'break' : 'continue') + ';\n';

    const COMPARE = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
    F['logic_compare'] = b => {
        const op = b.getFieldValue('OP'), ordre = op === 'EQ' || op === 'NEQ' ? A.ORDER_EQUALITY : A.ORDER_RELATIONAL;
        return [v(b, 'A', '0', ordre) + ' ' + COMPARE[op] + ' ' + v(b, 'B', '0', ordre), ordre];
    };
    F['logic_operation'] = b => {
        const et = b.getFieldValue('OP') === 'AND', ordre = et ? A.ORDER_LOGICAL_AND : A.ORDER_LOGICAL_OR;
        return [v(b, 'A', 'false', ordre) + (et ? ' && ' : ' || ') + v(b, 'B', 'false', ordre), ordre];
    };
    F['logic_negate'] = b => ['!' + v(b, 'BOOL', 'false', A.ORDER_UNARY), A.ORDER_UNARY];
    F['logic_boolean'] = b => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', A.ORDER_ATOMIC];

    F['math_number'] = b => { const n = Number(b.getFieldValue('NUM')); return [String(n), n < 0 ? A.ORDER_UNARY : A.ORDER_ATOMIC]; };
    F['math_arithmetic'] = b => {
        const op = b.getFieldValue('OP');
        if (op === 'POWER') return ['pow(' + v(b, 'A') + ', ' + v(b, 'B') + ')', A.ORDER_FUNCTION_CALL];
        const ordre = op === 'ADD' || op === 'MINUS' ? A.ORDER_ADDITIVE : A.ORDER_MULTIPLICATIVE;
        const g = v(b, 'A', '0', ordre);
        let d = v(b, 'B', '0', ordre - 0.5);   // a droite, meme priorite = parentheses (a - (b - c))
        if (op === 'DIVIDE' && /^-?\d+$/.test(d)) d += '.0';   // 7 / 2 = 3.5 (et non 3, division entiere du C++)
        return [g + ' ' + { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' }[op] + ' ' + d, ordre];
    };
    const SIMPLE = { ROOT: 'sqrt', ABS: 'fabs', LN: 'log', LOG10: 'log10', EXP: 'exp' };
    F['math_single'] = b => {
        const op = b.getFieldValue('OP');
        if (op === 'NEG') return ['-' + v(b, 'NUM', '0', A.ORDER_UNARY), A.ORDER_UNARY];
        if (op === 'POW10') return ['pow(10, ' + v(b, 'NUM') + ')', A.ORDER_FUNCTION_CALL];
        return [SIMPLE[op] + '(' + v(b, 'NUM') + ')', A.ORDER_FUNCTION_CALL];
    };
    F['math_round'] = b => [{ ROUND: 'round', ROUNDUP: 'ceil', ROUNDDOWN: 'floor' }[b.getFieldValue('OP')] + '(' + v(b, 'NUM') + ')', A.ORDER_FUNCTION_CALL];
    F['math_modulo'] = b => ['fmod(' + v(b, 'DIVIDEND') + ', ' + v(b, 'DIVISOR', '1') + ')', A.ORDER_FUNCTION_CALL];
    F['math_random_int'] = b => ['random(' + v(b, 'FROM') + ', ' + v(b, 'TO', '0', A.ORDER_ADDITIVE) + ' + 1)', A.ORDER_FUNCTION_CALL];
    F['math_constrain'] = b => ['constrain(' + v(b, 'VALUE') + ', ' + v(b, 'LOW') + ', ' + v(b, 'HIGH') + ')', A.ORDER_FUNCTION_CALL];

    F['text'] = b => [A.quote_(b.getFieldValue('TEXT')), A.ORDER_ATOMIC];
    F['text_join'] = b => {
        const parties = [];
        for (let i = 0; b.getInput('ADD' + i); i++) parties.push('String(' + v(b, 'ADD' + i, '""') + ')');
        return [parties.length ? parties.join(' + ') : 'String("")', A.ORDER_ADDITIVE];
    };
    F['text_length'] = b => ['String(' + v(b, 'VALUE', '""') + ').length()', A.ORDER_FUNCTION_CALL];

    F['variables_get'] = b => [nomVarC(b), A.ORDER_ATOMIC];
    F['variables_set'] = b => nomVarC(b) + ' = ' + v(b, 'VALUE') + ';\n';
    F['math_change'] = b => nomVarC(b) + ' += ' + v(b, 'DELTA') + ';\n';

    // Fonctions : parametres et valeur de retour en nombres decimaux (float).
    function definitionC(b, avecRetour) {
        const nom = A.nameDB_.getName(b.getFieldValue('NAME'), Blockly.Names.NameType.PROCEDURE);
        const params = (b.getVars ? b.getVars() : []).map(p => 'float ' + A.nameDB_.getName(p, Blockly.Names.NameType.VARIABLE));
        let corps = A.statementToCode(b, 'STACK');
        if (avecRetour) corps += I() + 'return ' + v(b, 'RETURN') + ';\n';
        A.definitions_['f_' + nom] = (avecRetour ? 'float ' : 'void ') + nom + '(' + params.join(', ') + ') {\n' + corps + '}';
        return null;
    }
    F['procedures_defnoreturn'] = b => definitionC(b, false);
    F['procedures_defreturn'] = b => definitionC(b, true);
    const appelC = b => {
        const args = (b.getVars ? b.getVars() : []).map((_, i) => v(b, 'ARG' + i));
        return A.nameDB_.getName(b.getFieldValue('NAME'), Blockly.Names.NameType.PROCEDURE) + '(' + args.join(', ') + ')';
    };
    F['procedures_callnoreturn'] = b => appelC(b) + ';\n';
    F['procedures_callreturn'] = b => [appelC(b), A.ORDER_FUNCTION_CALL];
    F['procedures_ifreturn'] = b => 'if (' + v(b, 'CONDITION', 'false') + ') {\n' + I() + 'return' + (b.hasReturnValue_ ? ' ' + v(b, 'VALUE') : '') + ';\n}\n';

    /** Variables affectees a un texte : de type String ; toutes les autres sont des nombres decimaux (float). */
    function typesVariables(ws) {
        const textes = new Set();
        for (const b of ws.getAllBlocks(false)) {
            if (b.type !== 'variables_set') continue;
            const cible = b.getInputTargetBlock('VALUE');
            if (cible && (cible.type === 'text' || cible.type === 'text_join')) textes.add(b.getFieldValue('VAR'));
        }
        return textes;
    }

    /**
     * Programme Arduino complet : le chapeau « quand le programme démarre » devient setup() ; loop() ne fait que les
     * taches de fond. Un bloc pose seul n'est jamais execute (il est grise, voir app.js).
     */
    function genererArduino(ws) {
        A.init(ws);
        let corps = '';
        for (const b of ws.getTopBlocks(true)) {
            if (!b.isEnabled()) continue;
            if (b.type === 'mb_demarrage') { const suite = b.getNextBlock(); if (suite) corps += A.blockToCode(suite); }
            else if (b.type.startsWith('procedures_def')) A.blockToCode(b, true);   // la fonction va dans definitions_
        }
        // Toutes les variables sont globales ; un parametre de fonction du meme nom masque simplement la globale.
        const textes = typesVariables(ws);
        const variables = ws.getAllVariables().map(x => (textes.has(x.getId()) ? 'String ' : 'float ') +
            A.nameDB_.getName(x.getId(), Blockly.Names.NameType.VARIABLE) + (textes.has(x.getId()) ? ' = "";' : ' = 0;'));

        const defs = Object.keys(A.definitions_).sort();
        const objets = defs.filter(k => k.startsWith('a_') || k.startsWith('b_')).map(k => A.definitions_[k]);
        const aides = defs.filter(k => k.startsWith('c_')).map(k => A.definitions_[k]);
        const fonctions = defs.filter(k => k.startsWith('f_')).map(k => A.definitions_[k]);
        const boucle = Object.values(A.boucle_);
        const setup = Object.values(A.setups_);

        const morceaux = [
            '// Programme créé avec l\'éditeur mBot1 (Technologie Services)\n' +
            '#include <Arduino.h>\n#include <Wire.h>\n#include <SoftwareSerial.h>\n#include <MeMCore.h>',
        ];
        if (objets.length) morceaux.push(objets.join('\n'));
        if (variables.length) morceaux.push(variables.join('\n'));
        morceaux.push('// Tâches de fond, faites pendant chaque attente et à chaque tour de boucle.\nvoid _loop() {\n' +
            boucle.map(l => I() + l + '\n').join('') + '}');
        morceaux.push('// Attente en secondes, sans bloquer les tâches de fond (la télécommande reste lue).\n' +
            'void _delay(float secondes) {\n' + I() + 'unsigned long fin = millis() + secondes * 1000;\n' + I() + 'while (millis() < fin) _loop();\n}');
        morceaux.push(...aides, ...fonctions);
        morceaux.push('void setup() {\n' + setup.map(l => I() + l + '\n').join('') + A.prefixLines(corps, I()) + '}');
        morceaux.push('void loop() {\n' + I() + '_loop();\n}');
        return morceaux.join('\n\n') + '\n';
    }

    // ==========================================
    // 3. GENERATEUR « SIMU » (JavaScript asynchrone : simulateur ET mode direct)
    // ==========================================
    // Tout le code s'execute dans des fonctions async : chaque action du robot est attendue (await R.xxx()),
    // chaque tour de boucle cede la main (await R.pas()) pour que l'affichage et les capteurs avancent.
    // Les variables vivent dans V (V["nom"]) et les fonctions dans FN : aucun nom d'eleve ne devient un identifiant JS.
    // Toutes les valeurs sont entre parentheses : l'ordre de priorite n'a jamais a etre calcule (ordre 0).
    // Les capteurs sont lus avec await : en mode direct, chaque lecture est une question posee au robot par le cable.
    // L'objet R est fourni par simulateur.js (robot dessine) ou par direct.js (vrai robot pilote par le cable USB).
    const S = new Blockly.Generator('SIMU');
    S.INDENT = '  ';
    S.scrub_ = function (b, code, seul) {
        const suite = b.nextConnection && b.nextConnection.targetBlock();
        return code + (suite && !seul ? S.blockToCode(suite) : '');
    };
    const sv = (b, nom, defaut) => S.valueToCode(b, nom, 0) || (defaut === undefined ? '0' : defaut);
    const st = (b, nom) => S.statementToCode(b, nom);
    const nomVar = (b, champ) => JSON.stringify(b.getField(champ || 'VAR').getVariable().name);
    const r = (code) => ['(' + code + ')', 0];
    const q = (b, champ) => JSON.stringify(b.getFieldValue(champ));
    let compteur = 0;
    const G = S.forBlock;

    G['mb_demarrage'] = b => {
        const suite = b.getNextBlock();
        return 'R.sur("start", "", async () => {\n' + (suite ? S.prefixLines(S.blockToCode(suite), S.INDENT) : '') + '});\n';
    };

    G['mb_attendre'] = b => 'await R.attendre(' + sv(b, 'S') + ');\n';
    G['mb_attendre_jusqua'] = b => 'while (!R.vrai(' + sv(b, 'COND', 'false') + ')) await R.pas();\n';
    G['mb_toujours'] = b => 'while (true) {\n' + st(b, 'DO') + S.INDENT + 'await R.pas();\n}\n';

    G['mb_avancer_pendant'] = b => 'await R.bouger(' + q(b, 'SENS') + ', ' + sv(b, 'V') + ', ' + sv(b, 'T') + ');\n';
    G['mb_mouvement'] = b => 'await R.bouger(' + q(b, 'SENS') + ', ' + sv(b, 'V') + ', null);\n';
    G['mb_roues'] = b => 'R.roues(' + sv(b, 'G') + ', ' + sv(b, 'D') + ');\n';
    G['mb_stop'] = () => 'R.roues(0, 0);\n';
    G['mb_moteur'] = b => 'R.moteur(' + q(b, 'PORT') + ', ' + sv(b, 'V') + ');\n';
    G['mb_moteur_stop'] = b => 'R.moteur(' + q(b, 'PORT') + ', 0);\n';

    G['mb_distance'] = b => r('await R.distance(' + b.getFieldValue('PORT') + ')');
    G['mb_capteur_ligne'] = b => r('await R.capteurLigne(' + b.getFieldValue('PORT') + ', ' + q(b, 'COTE') + ')');
    G['mb_ligne_est'] = b => r('await R.ligne(' + b.getFieldValue('PORT') + ') === ' + b.getFieldValue('ETAT'));
    G['mb_ligne_valeur'] = b => r('await R.ligne(' + b.getFieldValue('PORT') + ')');
    G['mb_lumiere'] = () => r('await R.lumiere()');

    G['mb_bouton'] = () => r('await R.bouton()');
    G['mb_ir'] = b => r('await R.telecommande(' + b.getFieldValue('TOUCHE') + ')');
    G['mb_chrono'] = () => r('R.chrono()');
    G['mb_chrono_raz'] = () => 'R.razChrono();\n';

    G['mb_led_couleur'] = b => 'R.led(' + b.getFieldValue('LED') + ', ' + rvb(b.getFieldValue('COULEUR')).join(', ') + ');\n';
    G['mb_led_rvb'] = b => 'R.led(' + b.getFieldValue('LED') + ', ' + sv(b, 'R') + ', ' + sv(b, 'V') + ', ' + sv(b, 'B') + ');\n';
    G['mb_led_eteindre'] = b => 'R.led(' + b.getFieldValue('LED') + ', 0, 0, 0);\n';

    G['mb_son_note'] = b => 'await R.son(' + b.getFieldValue('NOTE') + ', ' + b.getFieldValue('DUREE') + ');\n';
    G['mb_son_frequence'] = b => 'await R.son(' + sv(b, 'F') + ', ' + sv(b, 'T') + ');\n';

    G['mb_port_analogique'] = b => r('await R.portAnalogique(' + b.getFieldValue('PORT') + ', ' + b.getFieldValue('BROCHE') + ')');
    G['mb_port_numerique'] = b => r('await R.portNumerique(' + b.getFieldValue('PORT') + ', ' + b.getFieldValue('BROCHE') + ')');
    G['mb_port_ecrire'] = b => 'R.portEcrire(' + b.getFieldValue('PORT') + ', ' + b.getFieldValue('BROCHE') + ', ' + (b.getFieldValue('ETAT') === 'HIGH' ? 1 : 0) + ');\n';

    G['mb_print'] = b => 'R.print(R.texte(' + sv(b, 'TEXTE', '""') + '));\n';

    // --- blocs standard de Blockly ---
    G['controls_if'] = b => {
        let code = '', n = 0;
        do {
            code += (n ? ' else ' : '') + 'if (R.vrai(' + sv(b, 'IF' + n, 'false') + ')) {\n' + st(b, 'DO' + n) + '}';
            n++;
        } while (b.getInput('IF' + n));
        if (b.getInput('ELSE')) code += ' else {\n' + st(b, 'ELSE') + '}';
        return code + '\n';
    };
    G['controls_repeat_ext'] = b => {
        const i = '_i' + (++compteur), n = '_n' + compteur;
        return 'for (let ' + i + ' = 0, ' + n + ' = Number(' + sv(b, 'TIMES') + '); ' + i + ' < ' + n + '; ' + i + '++) {\n' + st(b, 'DO') + S.INDENT + 'await R.pas();\n}\n';
    };
    G['controls_whileUntil'] = b => {
        const cond = sv(b, 'BOOL', 'false');
        return 'while (' + (b.getFieldValue('MODE') === 'UNTIL' ? '!R.vrai(' + cond + ')' : 'R.vrai(' + cond + ')') + ') {\n' + st(b, 'DO') + S.INDENT + 'await R.pas();\n}\n';
    };
    G['controls_for'] = b => {
        const x = 'V[' + nomVar(b) + ']', k = ++compteur;
        // Comme en C++ (genererArduino) : bornes comprises, pas toujours positif, sens donne par les bornes.
        return 'for (let _de' + k + ' = Number(' + sv(b, 'FROM') + '), _a' + k + ' = Number(' + sv(b, 'TO') + '), _p' + k + ' = Math.abs(Number(' + sv(b, 'BY', '1') + ')) || 1, ' +
            '_s' + k + ' = _de' + k + ' <= _a' + k + ' ? 1 : -1, ' + x + ' = _de' + k + '; _s' + k + ' > 0 ? ' + x + ' <= _a' + k + ' : ' + x + ' >= _a' + k + '; ' +
            x + ' += _s' + k + ' * _p' + k + ') {\n' + st(b, 'DO') + S.INDENT + 'await R.pas();\n}\n';
    };
    G['controls_flow_statements'] = b => (b.getFieldValue('FLOW') === 'BREAK' ? 'break' : 'continue') + ';\n';

    const COMPARE_JS = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
    G['logic_compare'] = b => r(sv(b, 'A') + ' ' + COMPARE_JS[b.getFieldValue('OP')] + ' ' + sv(b, 'B'));
    G['logic_operation'] = b => r('R.vrai(' + sv(b, 'A', 'false') + ') ' + (b.getFieldValue('OP') === 'AND' ? '&&' : '||') + ' R.vrai(' + sv(b, 'B', 'false') + ')');
    G['logic_negate'] = b => r('!R.vrai(' + sv(b, 'BOOL', 'false') + ')');
    G['logic_boolean'] = b => r(b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false');

    G['math_number'] = b => r(String(Number(b.getFieldValue('NUM'))));
    const ARITH = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', POWER: '**' };
    G['math_arithmetic'] = b => r('Number(' + sv(b, 'A') + ') ' + ARITH[b.getFieldValue('OP')] + ' Number(' + sv(b, 'B') + ')');
    const SIMPLE_JS = { ROOT: 'Math.sqrt(x)', ABS: 'Math.abs(x)', NEG: '-(x)', LN: 'Math.log(x)', LOG10: 'Math.log10(x)', EXP: 'Math.exp(x)', POW10: '10 ** (x)' };
    G['math_single'] = b => r(SIMPLE_JS[b.getFieldValue('OP')].replace('x', sv(b, 'NUM')));
    G['math_round'] = b => r({ ROUND: 'Math.round', ROUNDUP: 'Math.ceil', ROUNDDOWN: 'Math.floor' }[b.getFieldValue('OP')] + '(' + sv(b, 'NUM') + ')');
    G['math_modulo'] = b => r('R.modulo(' + sv(b, 'DIVIDEND') + ', ' + sv(b, 'DIVISOR', '1') + ')');
    G['math_random_int'] = b => r('R.hasard(' + sv(b, 'FROM') + ', ' + sv(b, 'TO') + ')');
    G['math_constrain'] = b => r('Math.min(Math.max(' + sv(b, 'VALUE') + ', ' + sv(b, 'LOW') + '), ' + sv(b, 'HIGH') + ')');

    G['text'] = b => r(JSON.stringify(b.getFieldValue('TEXT')));
    G['text_join'] = b => {
        const parties = [];
        for (let i = 0; b.getInput('ADD' + i); i++) parties.push('R.texte(' + sv(b, 'ADD' + i, '""') + ')');
        return r(parties.length ? parties.join(' + ') : '""');
    };
    G['text_length'] = b => r('R.texte(' + sv(b, 'VALUE', '""') + ').length');

    G['variables_get'] = b => r('V[' + nomVar(b) + ']');
    G['variables_set'] = b => 'V[' + nomVar(b) + '] = ' + sv(b, 'VALUE') + ';\n';
    G['math_change'] = b => 'V[' + nomVar(b) + '] = Number(V[' + nomVar(b) + ']) + Number(' + sv(b, 'DELTA') + ');\n';

    // Fonctions : les parametres sont des variables (comme dans Blockly) sauvegardees puis restaurees a chaque appel.
    function definitionSimu(b, avecRetour) {
        const nom = JSON.stringify(b.getFieldValue('NAME'));
        const params = (b.getVars ? b.getVars() : []).map(p => JSON.stringify(p));
        const retour = avecRetour ? S.INDENT + S.INDENT + 'return ' + sv(b, 'RETURN', '0') + ';\n' : '';
        return 'FN[' + nom + '] = async (...args) => {\n' +
            S.INDENT + 'const _avant = [' + params.join(', ') + '].map(p => V[p]);\n' +
            S.INDENT + '[' + params.join(', ') + '].forEach((p, i) => { V[p] = args[i]; });\n' +
            S.INDENT + 'try {\n' + S.prefixLines(st(b, 'STACK'), S.INDENT) + retour + S.INDENT + '} finally {\n' +
            S.INDENT + S.INDENT + '[' + params.join(', ') + '].forEach((p, i) => { V[p] = _avant[i]; });\n' + S.INDENT + '}\n};\n';
    }
    G['procedures_defnoreturn'] = b => definitionSimu(b, false);
    G['procedures_defreturn'] = b => definitionSimu(b, true);
    const appelSimu = b => {
        const args = (b.getVars ? b.getVars() : []).map((_, i) => sv(b, 'ARG' + i, '0'));
        return 'await FN[' + JSON.stringify(b.getFieldValue('NAME')) + '](' + args.join(', ') + ')';
    };
    G['procedures_callnoreturn'] = b => appelSimu(b) + ';\n';
    G['procedures_callreturn'] = b => r(appelSimu(b));
    G['procedures_ifreturn'] = b => 'if (R.vrai(' + sv(b, 'CONDITION', 'false') + ')) return' + (b.hasReturnValue_ ? ' ' + sv(b, 'VALUE', '0') : '') + ';\n';

    /** Programme du simulateur / mode direct : fonctions d'abord (le chapeau peut les appeler des le demarrage). */
    function genererSimu(ws) {
        S.init(ws);
        compteur = 0;
        const fonctions = [], chapeaux = [];
        for (const b of ws.getTopBlocks(true)) {
            if (!b.isEnabled()) continue;
            if (CHAPEAUX.includes(b.type)) chapeaux.push(S.blockToCode(b, true));
            else if (b.type.startsWith('procedures_def')) fonctions.push(S.blockToCode(b, true));
        }
        // Variables a 0 au depart, comme en C++ (float x = 0) : « ajouter 1 a compteur » marche sans initialisation.
        const init = ws.getAllVariables().map(x => 'V[' + JSON.stringify(x.name) + '] = 0;\n').join('');
        return init + fonctions.join('') + chapeaux.join('');
    }

    window.BLOCS_MBOT1 = { CHAPEAUX, genererArduino, genererSimu, Arduino: A };
})();
