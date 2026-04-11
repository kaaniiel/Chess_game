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
        $board['white']->{$pieceOrder[$i]}[] = [
            'position' => $letter . '-1',
            'nbMoves' => 0,
            'lastRoundPlay' => -1
        ];
        $board['white']->{"pawn"}[] = [
            'position' => $letter . '-2',
            'nbMoves' => 0,
            'lastRoundPlay' => -1
        ];
        $i++;
    }

    // Populate black pieces (rank 8) and black pawns (rank 7)
    $i = 0;
    foreach ($letters as $letter) {
        $board['black']->{$pieceOrder[$i]}[] = [
            'position' => $letter . '-8',
            'nbMoves' => 0,
            'lastRoundPlay' => -1
        ];
        $board['black']->{"pawn"}[] = [
            'position' => $letter . '-7',
            'nbMoves' => 0,
            'lastRoundPlay' => -1
        ];
        $i++;
    }

    return $board;
}

function parseTimeControl($raw)
{
    $value = trim((string) $raw);
    switch ($value) {
        case '3600':
        case '1800':
        case '900':
            return $value;
        case 'unlimited':
        default:
            return 'unlimited';
    }
}

function movePiece(&$playerPieces, &$pieceName, &$origin, &$destination, &$json) {
    $pieceCategory = &$playerPieces[$pieceName] ?? [];
    foreach ($pieceCategory as &$piece) {
        if ($piece['position'] === $origin) {
            $piece['position'] = $destination;
            $piece['nbMoves'] += 1;
            $piece['lastRoundPlay'] = $json['round'];
            return True;
        }
    }
    return False;
}

function castlePieces(&$playerPieces, $origin, $destination, $json)
{
    $originParts = explode('-', $origin);
    $destinationParts = explode('-', $destination);

    if (count($originParts) !== 2 || count($destinationParts) !== 2) {
        return false;
    }

    $rank = $originParts[1];
    $destinationFile = $destinationParts[0];

    if ($destinationFile === 'G') {
        $rookOrigin = 'H-' . $rank;
        $rookDestination = 'F-' . $rank;
    } elseif ($destinationFile === 'C') {
        $rookOrigin = 'A-' . $rank;
        $rookDestination = 'D-' . $rank;
    } else {
        return false;
    }

    $kingIndex = null;
    if (!isset($playerPieces['king'])) {
        return false;
    }
    foreach ($playerPieces['king'] as $k => $king) {
        if ($king['position'] === $origin) {
            $kingIndex = $k;
            break;
        }
    }

    $rookIndex = null;
    if (!isset($playerPieces['rook'])) {
        return false;
    }
    foreach ($playerPieces['rook'] as $k => $rook) {
        if ($rook['position'] === $rookOrigin) {
            $rookIndex = $k;
            break;
        }
    }

    if ($kingIndex === null || $rookIndex === null) {
        return false;
    }

    $playerPieces['king'][$kingIndex]['position'] = $destination;
    $playerPieces['king'][$kingIndex]['nbMoves'] += 1;
    $playerPieces['king'][$kingIndex]['lastRoundPlay'] = $json['round'];

    $playerPieces['rook'][$rookIndex]['position'] = $rookDestination;
    $playerPieces['rook'][$rookIndex]['nbMoves'] += 1;
    $playerPieces['rook'][$rookIndex]['lastRoundPlay'] = $json['round'];

    return true;
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
            'turnIndex' => 0,
            'round' => 0,
            'lastUpdate' => time(),
            'roundStats' => [],
            'history' => [],
            'param' => 'unlimited',
            'roundStartedAt' => null,
            'timeLimitSeconds' => null
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
            $limit = isset($_REQUEST['param']) ? $_REQUEST['param'] : 'unlimited';
            $json['param'] = parseTimeControl($limit);
            $json['timeLimitSeconds'] = $json['param'] === 'unlimited' ? null : (int) $json['param'];

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
            $pieces = generatePieces();
            $timeParam = isset($json['param']) ? parseTimeControl($json['param']) : 'unlimited';
            $firstPlayerIndex = rand(0, count($json['players']) - 1);
            $json['status'] = 'playing';
            $json['turnIndex'] = $firstPlayerIndex;

            // des pieces aux joueurs
            $i = 0;
            foreach ($json['players'] as &$p) {
                if ($i === $firstPlayerIndex) {
                    /* $p['pieces'] = array_filter($json['pieces']['white'], function ($piece) {
                        return $piece['color'] === 'white';
                    }); */
                    $p['pieces'] = $pieces['white'];
                    $p['color'] = 'white';
                } else {
                    /* $p['pieces'] = array_filter($json['pieces']['black'], function ($piece) {
                        return $piece['color'] === 'black';
                    }); */
                    $p['pieces'] = $pieces['black'];
                    $p['color'] = 'black';
                }
                $i++;
            }

            $json['round'] = 1;
            $json['history'] = [];
            $json['roundStats'] = [];
            $json['param'] = $timeParam;
            $json['roundStartedAt'] = time();
            $json['timeLimitSeconds'] = $timeParam === 'unlimited' ? null : (int) $timeParam;
            $json['lastUpdate'] = time();
            $json["ready"] = [];
            echo json_encode(['success' => true]);
            return $json;
        });
        break;

    // 4. JOUER UNE CARTE
    case 'play':
        $roomId = $_REQUEST['roomId'];

        $originFullId = $_REQUEST['origin'];
        $origin = substr($originFullId, 5); // Enlève le préfixe "cell-"

        $destinationFullId = $_REQUEST['destination'];
        $destination = substr($destinationFullId, 5); // Enlève le préfixe "cell-"

        $playerName = $_REQUEST['player'];

        $index = (int) $_REQUEST['index'];

        $pieceName = $_REQUEST['pieceName'] ?? '';
        $tag = $_REQUEST['tag'] ?? '';
        processRoom($roomId, function ($json) use ($index, $origin, $destination, $pieceName, $tag) {
            // 1. VERIFICATION DU TOUR (Activée)
            if ($json['turnIndex'] !== $index) {
                echo json_encode(['error' => 'Ce n\'est pas votre tour !']);
                return null;
            }
            $player = &$json['players'][$index];
            $pieces = &$player['pieces'];

            /* $CHESS_TAGS = array(
                'EN_PASSANT' => "en_passant",
                'CASTLING' => "castling",
                'PROMOTION' => "promotion",
                'CHECK' => "check",
                'CHECKMATE' => "checkmate",
                'MOVE' => "move",
                'TAKE_PIECE' => "take_piece",
            ); */
            $movedPiece = null;
            switch ($tag) {
                case "move":
                    // 
                    $movedPiece = movePiece($pieces, $pieceName, $origin, $destination, $json);
                    if (!$movedPiece) {
                        echo json_encode(['error' => 'Aucune pièce à déplacer à cette position !']);
                        return null;
                    }
                    break;
                
                case "take_piece":
                    $takenPiece = null;
                    $opponentPieces = &$json['players'][1 - $index]['pieces'];
                    $capturedPieceType = null;
                    $capturedPieceIndex = null;
                    foreach ($opponentPieces as $piece => &$value) {
                        foreach ($value as $k => &$p) {
                            if ($p['position'] === $destination) {
                                $takenPiece = $p;
                                $capturedPieceType = $piece;
                                $capturedPieceIndex = $k;
                                break 2; // Sort des deux boucles
                            }
                        }
                    }
                    if (!$takenPiece) {
                        echo json_encode(['error' => 'Aucune pièce à prendre à cette position !']);
                        return null;
                    }

                    $movedPiece = movePiece($pieces, $pieceName, $origin, $destination, $json);
                    if (!$movedPiece) {
                        echo json_encode(['error' => 'Aucune pièce à déplacer à cette position !']);
                        return null;
                    }
                    unset($opponentPieces[$capturedPieceType][$capturedPieceIndex]); // Supprime la pièce prise
                    $opponentPieces[$capturedPieceType] = array_values($opponentPieces[$capturedPieceType]);
                    
                    break;
                
                case "en_passant":
                    $takenPiece = null;
                    $opponentPieces = &$json['players'][1 - $index]['pieces'];
                    $capturedPieceType = "pawn";
                    $capturedPieceIndex = null;
                    $offset = ($player['color'] === 'white') ? -1 : 1; // Les blancs prennent vers le haut, les noirs vers le bas
                    $indexOpponentPawn = $destination[0] . '-' . ($destination[2] + $offset); // Position du pion adverse à prendre
                    foreach ($opponentPieces[$capturedPieceType] as $opponentPieceName => &$opponentPiece) {
                        if ($opponentPiece['position'] === $indexOpponentPawn && $opponentPiece['lastRoundPlay'] === $json['round'] - 1) {
                            $takenPiece = $opponentPiece;
                            $capturedPieceIndex = $opponentPieceName;
                            break;
                        }
                    }
                    
                    if (!$takenPiece) {
                        echo json_encode(['error' => 'Aucun pion à prendre en passant à cette position !']);
                        return null;
                    }
                    unset($opponentPieces[$capturedPieceType][$capturedPieceIndex]); // Supprime la pièce prise
                    $opponentPieces[$capturedPieceType] = array_values($opponentPieces[$capturedPieceType]);
                    
                    $movedPiece = movePiece($pieces, $pieceName, $origin, $destination, $json);
                    break;
                    
                case "castling":
                    $movedPiece = castlePieces($pieces, $origin, $destination, $json);
                    if (!$movedPiece) {
                        echo json_encode(['error' => 'Roque impossible']);
                        return null;
                    }
                    break;
                
                default:
                    echo json_encode(["error" => "Tag de mouvement inconnu"]);
                    return null;
            }
            // On passe au joueur suivant
            $json['turnIndex'] = ($json['turnIndex'] + 1) % count($json['players']);
            $json['round'] += 1;
            $json['lastUpdate'] = time();
            $json['history'][] = [
                'playerIndex' => $index,
                'origin' => $origin,
                'destination' => $destination,
                'pieceName' => $pieceName,
                'tag' => $tag
            ];
            $hasMovedPiece = $movedPiece ? "has moved" : "have not moved";
            echo json_encode(['success' => true, 'tag' => $tag, 'infos' => "piece $pieceName $hasMovedPiece from $origin to $destination",  'gameState' => $json]);
            return $json;
        });
        break;
    // 5. CONTINUER (Pli suivant)
    case 'nextTrick':
        $roomId = $_REQUEST['roomId'];
        processRoom($roomId, function ($json) {
            if ($json['status'] !== 'round_end')
                return null;

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
            $json['turnIndex'] = 0;
            $json['history'] = [];
            $json['roundStats'] = [];
            $json['roundStartedAt'] = null;
            $json['timeLimitSeconds'] = isset($json['param']) && $json['param'] !== 'unlimited' ? (int) $json['param'] : null;
            echo json_encode(['success' => true]);
            return $json;
        });
        break;

    // 7. GET STATE
    case 'get':
        $roomId = $_REQUEST['roomId'];
        processRoom($roomId, function ($json) {
            if (!$json) {
                echo json_encode(['error' => 'Salle introuvable']);
                return null;
            }

            $hasChanged = false;

            if (
                isset($json['status']) &&
                $json['status'] === 'playing' &&
                isset($json['param']) &&
                $json['param'] !== 'unlimited' &&
                isset($json['roundStartedAt']) &&
                $json['roundStartedAt']
            ) {
                $limit = isset($json['timeLimitSeconds']) ? (int) $json['timeLimitSeconds'] : (int) $json['param'];
                $elapsed = time() - (int) $json['roundStartedAt'];
                $remaining = $limit - $elapsed;
                if ($remaining <= 0) {
                    $json['status'] = 'round_end';
                    $json['lastUpdate'] = -1;
                    $json['history'] = [];
                    $json['roundStats'] = [
                        'winnerIndex' => ($json['turnIndex'] + 1) % count($json['players']),
                        'reason' => 'timeout'
                    ];
                    $hasChanged = true;
                }
            }

            echo json_encode($json);
            return $hasChanged ? $json : null;
        });
        break;

    case 'declareCheckmate':
        $roomId = $_REQUEST['roomId'];
        $index = (int) $_REQUEST['index'];
        processRoom($roomId, function ($json) use ($index) {
            $json['status'] = 'round_end';
            $json['lastUpdate'] = -1;
            $json['history'] = [];
            $json['roundStats'] = [
                'winnerIndex' => ($index + 1) % count($json['players']),
                'reason' => 'checkmate'
            ];
            echo json_encode(['index' => $index, 'success' => true, 'gameState' => $json]);
            return $json;
        });
        break;

    case 'promote':
        $roomId = $_REQUEST['roomId'];
        $index = (int) $_REQUEST['index'];
        processRoom($roomId, function ($json) use ($index) {
            if ($json['turnIndex'] !== $index) {
                echo json_encode(['error' => 'Ce n\'est pas votre tour !']);
                return null;
            }

            $player = &$json['players'][$index];
            $pieces = &$player['pieces'];

            $originPiece = $_REQUEST['origin'];
            $originPiece = substr($originPiece, 5); // Enlève le préfixe "cell-"
            $destinationPiece = $_REQUEST['destination'];
            $destinationPiece = substr($destinationPiece, 5); // Enlève le préfixe "cell-"
            $finalPiece = $_REQUEST['piece']; // queen, rook, bishop, knight

            $allowedPromotions = ['queen', 'rook', 'bishop', 'knight'];
            if (!in_array($finalPiece, $allowedPromotions, true)) {
                echo json_encode(['error' => 'Pièce de promotion invalide']);
                return null;
            }

            // Capture éventuelle sur la case d'arrivée (promotion avec prise)
            $opponentPieces = &$json['players'][1 - $index]['pieces'];
            foreach ($opponentPieces as $pieceType => &$pieceList) {
                foreach ($pieceList as $k => $p) {
                    if ($p['position'] === $destinationPiece) {
                        unset($opponentPieces[$pieceType][$k]);
                        $opponentPieces[$pieceType] = array_values($opponentPieces[$pieceType]);
                        break 2;
                    }
                }
            }

            // Trouver et promouvoir le pion
            $pawnFound = false;
            foreach ($pieces['pawn'] as $k => $piece) {
                if ($piece['position'] === $originPiece) {
                    $nbMovesPawn = $piece['nbMoves'];
                    // Supprimer le pion
                    unset($pieces['pawn'][$k]);
                    // Ajouter la nouvelle pièce
                    $pieces[$finalPiece][] = [
                        'position' => $destinationPiece,
                        'nbMoves' => $nbMovesPawn,
                        'lastRoundPlay' => $json['round']
                    ];
                    // Réindexer le tableau des pions
                    $pieces['pawn'] = array_values($pieces['pawn']);
                    $pawnFound = true;
                    break;
                }
            }

            if (!$pawnFound) {
                echo json_encode(['error' => 'Pion introuvable pour la promotion']);
                return null;
            }

            $json['turnIndex'] = ($json['turnIndex'] + 1) % count($json['players']);
            $json['round'] += 1;
            $json['history'][] = [
                'playerIndex' => $index,
                'origin' => $originPiece,
                'destination' => $destinationPiece,
                'pieceName' => $finalPiece,
                'tag' => 'promotion'
            ];
            echo json_encode(['success' => true, 'gameState' => $json]);
            return $json;
        });
        break;
    case 'restart':
        $roomId = $_REQUEST['roomId'];
        $index = (int) $_REQUEST['index'];

        processRoom($roomId, function ($json) use ($index) {
            // Toggle: add index if not present, otherwise remove it
            if (!in_array($index, $json["ready"])) {
                $json["ready"][] = $index;
            } else {
                $json["ready"] = array_values(array_filter($json["ready"], function ($i) use ($index) {
                    return $i !== $index;
                }));
            }

            $json["lastUpdate"] = time();
            echo json_encode(['success' => true, 'gameState' => $json]);
            return $json;
        });
        break;

    case 'abandon':
        $roomId = $_REQUEST['roomId'];
        $index = (int) $_REQUEST['index'];

        processRoom($roomId, function ($json) use ($index) {
            $json['status'] = 'round_end';
            $json['lastUpdate'] = -1;
            $json['history'] = [];
            $json['roundStats'] = [
                'winnerIndex' => ($index + 1) % count($json['players']),
                'reason' => 'abandon'
            ];
            echo json_encode(['index' => $index, 'success' => true, 'gameState' => $json]);
            return $json;
        });
        break;
    default:
        echo json_encode(['error' => 'Action inconnue']);
        break;

}
?>