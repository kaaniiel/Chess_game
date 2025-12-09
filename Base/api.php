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
            'players' => [['name' => $name, 'pieces' => []]],
            'table' => [],
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

            $json['players'][] = ['name' => $name, 'pieces' => []];
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

            $json['table'] = [];
            $json['status'] = 'playing';
            $json['turnIndex'] = 0;

            // Distribution (7 cartes)
            /* foreach ($json['players'] as &$p) {
                $p['hand'] = array_splice($deck, 0, 7);
            }
            $json['deck'] = $deck; */

            echo json_encode(['success' => true]);
            return $json;
        });
        break;

    // 4. JOUER UNE CARTE
    case 'play':
        $roomId = $_REQUEST['roomId'];
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