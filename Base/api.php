<?php
header('Content-Type: application/json');

$dataDir = __DIR__ . '/data/';
if (!file_exists($dataDir))
    mkdir($dataDir, 0777, true);

/**
 * Gère l'accès concurrentiel au fichier JSON d'une salle
 */
function processRoom($roomId, $callback)
{
    global $dataDir;
    $file = $dataDir . 'room_' . preg_replace('/[^A-Z0-9]/', '', $roomId) . '.json';
    $fp = fopen($file, 'c+');
    if (!$fp)
        exit(json_encode(['error' => 'Erreur fichier']));
    if (flock($fp, LOCK_EX)) {
        $size = filesize($file);
        $content = $size > 0 ? fread($fp, $size) : '';
        $json = $content ? json_decode($content, true) : null;
        $result = $callback($json);
        if ($result !== null) {
            ftruncate($fp, 0);
            rewind($fp);
            $result['lastUpdate'] = time();
            fwrite($fp, json_encode($result));
        }
        flock($fp, LOCK_UN);
    } else {
        exit(json_encode(['error' => 'Occupé']));
    }
    fclose($fp);
}

/**
 * Génère un deck de cartes mélangé
 */
function generateDeck()
{
    $suits = ['Coeur', 'Carreau', 'Trefle', 'Pique'];
    $ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valet', 'Dame', 'Roi', 'As'];
    $deck = [];
    foreach ($suits as $s) {
        foreach ($ranks as $r) {
            $deck[] = ['suit' => $s, 'rank' => $r, 'id' => $r . $s];
        }
    }
    shuffle($deck);
    return $deck;
}

function generatePieces()
{
    $board = ['white' => (object) [], 'black' => (object) []];
    $letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    $pieceOrder = [
        "rook",
        "knight",
        "bishop",
        "queen",
        "king",
        "bishop",
        "knight",
        "rook",
    ];
    $i = 0;
    // Populate white pieces (rank 1) and white pawns (rank 2)
    foreach ($letters as $letter) {
        /* $board['white'][] = [
            'type' => $pieceOrder[$i],
            'color' => 'white',
            'position' => $letter . '-1'
        ];
        $board['white'][] = [
            'type' => 'pawn',
            'color' => 'white',
            'position' => $letter . '-2'
        ]; */
        /*
         * white : {
         *  "pawn" : [
         *      { "position": "A-2" },
         *     { "position": "B-2" },
         *    ...  ]...
         * }
         */
        $board['white']->{$pieceOrder[$i]}[] = [
            'position' => $letter . '-1'
        ];
        $board['white']->{"pawn"}[] = [
            'position' => $letter . '-2'
        ];
        $i++;
    }

    // Populate black pieces (rank 8) and black pawns (rank 7)
    $i = 0;
    foreach ($letters as $letter) {
        /* $board['black'][] = [
            'type' => $pieceOrder[$i],
            'color' => 'black',
            'position' => $letter . '-8'
        ];
        $board['black'][] = [
            'type' => 'pawn',
            'color' => 'black',
            'position' => $letter . '-7'
        ]; */
        $board['black']->{$pieceOrder[$i]}[] = [
            'position' => $letter . '-8'
        ];
        $board['black']->{"pawn"}[] = [
            'position' => $letter . '-7'
        ];
        $i++;
    }

    return $board;
}
// --- ROUTER ---

$action = $_REQUEST['action'] ?? '';

switch ($action) {

    // 1. CRÉATION DE SALLE
    case 'create':
        $roomId = strtoupper(substr(md5(uniqid()), 0, 4));
        $name = trim($_REQUEST['name']);
        if (!$name)
            exit(json_encode(['error' => 'Pseudo vide']));


        $gameState = [
            'id' => $roomId,
            'admin' => $name,
            'status' => 'lobby',
            'players' => [['name' => $name, 'color' => "", 'pieces' => (object) []]],
            'table' => [],
            'pieces' => generatePieces(),
            'turnIndex' => 0,
            'lastUpdate' => time()
        ];

        file_put_contents($dataDir . 'room_' . $roomId . '.json', json_encode($gameState));
        echo json_encode(['success' => true, 'roomId' => $roomId, 'finalName' => $name]);
        break;

    // 2. REJOINDRE
    case 'join':
        $roomId = $_REQUEST['roomId'];
        $name = trim($_REQUEST['name']);
        processRoom($roomId, function ($json) use ($name) {
            if (!$json)
                return null;
            if (count($json['players']) > 2) {
                echo json_encode(['error' => 'Salon complet (Max 2 joueurs)']);
                return null;
            }
            foreach ($json['players'] as $p)
                if ($p['name'] === $name) {
                    echo json_encode(['error' => 'Pseudo déjà pris']);
                    return null;
                }

            $json['players'][] = ['name' => $name, 'color' => "", 'pieces' => (object) []];
            echo json_encode(['success' => true, 'index' => count($json['players']) - 1, 'finalName' => $name]);
            return $json;
        });
        break;

    // 2. MISE À JOUR DES PARAMÈTRES
    case 'updateSettings':
        $roomId = $_REQUEST['roomId'];
        // Ici, vous pouvez récupérer et appliquer les paramètres envoyés
        processRoom($roomId, function ($json) {
            $limit = isset($_REQUEST['param']) ? $_REQUEST['param'] : null;
            if ($limit)
                $json['param'] = $limit;

            echo json_encode(['success' => true]);
            return $json;
        });
        break;

    // 3. LANCER LA PARTIE
    case 'startRound':
        $roomId = $_REQUEST['roomId'];
        processRoom($roomId, function ($json) {
            if (count($json['players']) == 1) {
                echo json_encode(['error' => 'Pas assez de joueurs']);
                return null;
            }

            $firstPlayerIndex = rand(0, count($json['players']) - 1);
            $json['table'] = [];
            $json['status'] = 'playing';
            $json['turnIndex'] = $firstPlayerIndex;

            // des pieces aux joueurs
            $i = 0;
            foreach ($json['players'] as &$p) {
                if ($i === $firstPlayerIndex) {
                    /* $p['pieces'] = array_filter($json['pieces']['white'], function ($piece) {
                        return $piece['color'] === 'white';
                    }); */
                    $p['pieces'] = $json['pieces']['white'];
                    $p['color'] = 'white';
                } else {
                    /* $p['pieces'] = array_filter($json['pieces']['black'], function ($piece) {
                        return $piece['color'] === 'black';
                    }); */
                    $p['pieces'] = $json['pieces']['black'];
                    $p['color'] = 'black';
                }
                $i++;
            }


            echo json_encode(['success' => true]);
            return $json;
        });
        break;

    // 4. JOUER UNE CARTE
    case 'play':
        /* $roomId = $_REQUEST['roomId'];
        $cardId = $_REQUEST['cardId'];
        $idx = (int) $_REQUEST['index'];

        processRoom($roomId, function ($json) use ($cardId, $idx) {
            // 1. VERIFICATION DU TOUR (Activée)
            if ($json['turnIndex'] !== $idx) {
                echo json_encode(['error' => 'Ce n\'est pas votre tour !']);
                return null;
            }

            $hand = &$json['players'][$idx]['hand'];
            $cardIndex = -1;
            $cardPlayed = null;

            foreach ($hand as $k => $c) {
                if ($c['id'] === $cardId) {
                    $cardPlayed = $c;
                    $cardIndex = $k;
                    break;
                }
            }

            if (!$cardPlayed) {
                echo json_encode(['error' => 'Carte introuvable']);
                return null;
            }

            // Action de jeu
            array_splice($hand, $cardIndex, 1);
            $json['table'][] = ['playerIndex' => $idx, 'card' => $cardPlayed];

            // 2. GESTION FIN DE PLI
            if (count($json['table']) >= count($json['players'])) {
                // Tout le monde a joué : on passe en mode "fin de round"
                $json['status'] = 'round_end';

                // Génération de stats random comme demandé
                $json['roundStats'] = [
                    'winner' => $json['players'][array_rand($json['players'])]['name'], // Vainqueur au hasard
                    'points' => rand(5, 50),
                    'message' => ['bite !', 'couille !', 'sex !'][rand(0, 2)]
                ];
            } else {
                // On passe au joueur suivant
                $json['turnIndex'] = ($json['turnIndex'] + 1) % count($json['players']);
            }

            echo json_encode(['success' => true, 'gameState' => $json]);
            return $json;
        });
        break; */
        $roomId = $_REQUEST['roomId'];

        $pieceName = $_REQUEST['pieceName'];

        $originFullId = $_REQUEST['origin'];
        $origin = substr($originFullId, 5); // Enlève le préfixe "cell-"

        $destinationFullId = $_REQUEST['destination'];
        $destination = substr($destinationFullId, 5); // Enlève le préfixe "cell-"

        $playerName = $_REQUEST['player'];

        $index = (int) $_REQUEST['index'];

        processRoom($roomId, function ($json) use ($playerName, $index, $origin, $destination, $pieceName) {
            // 1. VERIFICATION DU TOUR (Activée)
            if ($json['turnIndex'] !== $index) {
                echo json_encode(['error' => 'Ce n\'est pas votre tour !']);
                return null;
            }

            $player = &$json['players'][$index];
            $pieces = &$player['pieces'];

            $pieceFound = false;

            // Recherche de la pièce à déplacer
            foreach ($pieces as $type => &$pieceArray) {
                foreach ($pieceArray as $k => $piece) {
                    if ($piece['position'] === $origin) {
                        // Déplacer la pièce
                        $pieces[$type][$k]['position'] = $destination;
                        $pieceFound = true;
                        break 2; // Sortir des deux boucles
                    }
                }
            }

            if (!$pieceFound) {
                echo json_encode(['error' => 'Pièce introuvable']);
                return null;
            }

            // Action de jeu
            $json['table'][] = ['playerIndex' => $index, 'piece' => $pieceName, 'from' => $origin, 'to' => $destination];

            // On passe au joueur suivant
            $json['turnIndex'] = ($json['turnIndex'] + 1) % count($json['players']);

            echo json_encode(['success' => true, 'gameState' => $json]);
            return $json;
        });
        echo json_encode(['error' => 'Action non implémentée']);
        break;
    // 5. CONTINUER (Pli suivant)
    case 'nextTrick':
        $roomId = $_REQUEST['roomId'];
        processRoom($roomId, function ($json) {
            if ($json['status'] !== 'round_end')
                return null;

            $json['table'] = []; // On vide la table
            $json['status'] = 'playing'; // On reprend le jeu
            $json['roundStats'] = null;

            // Le joueur suivant commence (logique simple : celui après le dernier qui a joué)
            // Dans un vrai jeu, c'est souvent celui qui a gagné le pli
            $json['turnIndex'] = ($json['turnIndex'] + 1) % count($json['players']);

            echo json_encode(['success' => true]);
            return $json;
        });
        break;

    // 6. LISTER SALONS
    case 'listRooms':
        $files = glob($dataDir . 'room_*.json');
        $rooms = [];
        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);
            if ($data && $data['status'] === 'lobby') {
                $rooms[] = ['id' => $data['id'], 'admin' => $data['admin'], 'count' => count($data['players']), 'param' => $data['param'] ?? ''];
            }
        }
        echo json_encode(['success' => true, 'rooms' => $rooms]);
        break;

    // 6. QUITTER / RETOUR LOBBY
    case 'leave':
        $roomId = $_REQUEST['roomId'];
        $name = $_REQUEST['name'];
        processRoom($roomId, function ($json) use ($name, $dataDir, $roomId) {
            $json['players'] = array_values(array_filter($json['players'], function ($p) use ($name) {
                return $p['name'] !== $name;
            }));
            if (empty($json['players'])) {
                if (file_exists($dataDir . 'room_' . $roomId . '.json'))
                    unlink($dataDir . 'room_' . $roomId . '.json');
                echo json_encode(['success' => true]);
                return null;
            }
            if ($json['admin'] === $name)
                $json['admin'] = $json['players'][0]['name'];
            echo json_encode(['success' => true]);
            return $json;
        });
        break;

    case 'backToLobby':
        $roomId = $_REQUEST['roomId'];
        processRoom($roomId, function ($json) {
            $json['status'] = 'lobby';
            foreach ($json['players'] as &$p)
                $p['hand'] = [];
            $json['table'] = [];
            $json['turnIndex'] = 0;
            echo json_encode(['success' => true]);
            return $json;
        });
        break;

    // 7. GET STATE
    case 'get':
        $f = $dataDir . 'room_' . preg_replace('/[^A-Z0-9]/', '', $_REQUEST['roomId']) . '.json';
        if (file_exists($f))
            echo file_get_contents($f);
        break;

    default:
        echo json_encode(['error' => 'Action inconnue']);
        break;
}
?>