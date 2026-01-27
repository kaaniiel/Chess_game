<!DOCTYPE html>
<html lang="fr">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/png" href="../images/favicon.ico">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">

    <!-- Primary Meta Tags -->
    <title>Jeu d'échec</title>
    <link rel="stylesheet" href="../css/base.css?v=<?= filemtime('../css/base.css') ?>">
    <link rel="stylesheet" href="../css/games.css?v=<?= filemtime('../css/games.css') ?>">
    <link rel="stylesheet" href="../css/chess.css?v=<?= filemtime('../css/chess.css') ?>">
    <script src="../js/room.js?v=<?= filemtime('../js/room.js') ?>" defer></script>
    <meta name="title" content="Jeu d'échec" />
    <meta name="description"
        content="Jouez à Jeu d'échec en ligne avec vos amis. Créez ou rejoignez une table privée et profitez d'une expérience de jeu classique et conviviale." />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://polifra.fr/Jeux/Echec/" />
    <meta property="og:title" content="Jeu d'échec" />
    <meta property="og:description"
        content="Jouez à Jeu d'échec en ligne avec vos amis. Créez ou rejoignez une table privée et profitez d'une expérience de jeu classique et conviviale." />
</head>

<body>
    <div id="screen-home" class="screen active">
        <a href="../../"
            style="position:absolute; top:20px; left:20px; color:white; text-decoration:none; font-weight:bold; background:rgba(0,0,0,0.4); padding:10px 15px; border-radius:8px; z-index:100; display:flex; align-items:center; gap:8px; transition: background 0.3s;">
            <i class="fas fa-arrow-left"></i> Retour aux Jeux
        </a>
        <div class="home-container">
            <!-- Panneau Gauche : Actions -->
            <div class="home-panel action-panel">
                <div class="logo-area">
                    <h1>Jeu d'échec</h1>
                    <p>Le jeu d'échec classique en ligne</p>
                </div>

                <div class="input-group">
                    <label>Votre Pseudo</label>
                    <input type="text" id="username" placeholder="Ex: Marcel">
                </div>

                <div class="divider"></div>

                <button onclick="createGame()" class="btn-green big-btn">
                    <span>+</span> Créer une table
                </button>

                <div class="join-manual">
                    <input type="text" id="roomCodeInput" placeholder="Code (ex: A1B2)">
                    <button onclick="joinGame()" class="btn-blue">Rejoindre</button>
                </div>
            </div>

            <!-- Panneau Droite : Liste des salons -->
            <div class="home-panel list-panel">
                <div class="panel-header">
                    <h3>Salons disponibles</h3>
                    <button onclick="refreshRoomList()" class="btn-refresh">↻</button>
                </div>
                <div id="room-list-container" class="room-list">
                    <div class="loading-text">Recherche de parties...</div>
                </div>
            </div>
        </div>
    </div>

    <div id="screen-lobby" class="screen">
        <div class="box lobby-box">
            <div class="lobby-header">
                <h2>Salon <span id="lobby-code">...</span></h2>
                <div class="lobby-subtitle">Invitez vos amis avec ce code</div>
            </div>

            <div class="lobby-content">
                <div class="players-section">
                    <h3>Joueurs (<span id="player-count">0/2</span>)</h3>
                    <div id="lobby-players-list" class="player-list"></div>
                </div>

                <div class="settings-section">
                    <h3>Paramètres</h3>

                    <div class="setting-row">
                        <label></label>
                        <select id="lobby-param-XXXX" disabled>
                            <!-- <option value="X">X</option>
                            <option value="XX" selected>XX</option>
                            <option value="XXX">XXX</option> -->
                        </select>
                    </div>
                </div>
            </div>

            <div class="lobby-footer">
                <div id="admin-controls" style="display:none;">
                    <button onclick="launchGame()" id="btn-launch" class="btn-green" disabled>EN ATTENTE DES
                        JOUEURS...</button>
                </div>
                <div id="guest-controls">
                    <div class="waiting-spinner"></div>
                    <p>En attente du chef de table...</p>
                </div>

                <button onclick="leaveLobby()" class="btn-red" style="margin-top: 15px;">Quitter le salon</button>
            </div>
        </div>
    </div>

    <div id="screen-game" class="screen">
        <div id="game-top-bar" class="game-top-bar">
            <!--div id="game-timer" class="game-timer">00:00</div>-->
            <div id="game-players-info" class="game-players-info"></div>
            <div id="game-announcer" class="game-announcer">Chargement...</div>
            <button id="btn-abandon" class="btn-red"
                style="padding: 8px 12px; font-size: 0.9em; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"
                onclick="abandonGame()">
                <i class="fas fa-arrow-left"></i> Abandonner
            </button>
        </div>

        <div id="game-container">

            <!-- <div class="table-center">
                <div id="slot-top" class="card-slot slot-top"></div>
                <div id="slot-left" class="card-slot slot-left"></div>
                <div id="slot-right" class="card-slot slot-right"></div>
                <div id="slot-bottom" class="card-slot slot-bottom"></div>
            </div>

            <div id="players-area">
                <div id="player-0"></div>
                <div id="player-1"></div>
                <div id="player-2"></div>
                <div id="player-3"></div>
            </div>

            <div id="my-hand"></div>
 -->
        </div>

    </div>

    <div id="score-modal">
        <div id="score-content"></div>
    </div>

    <div id="promotion-modal" style="display:none;">
        <div id="promotion-content"></div>
    </div>

    <!-- POPUP D'ERREUR PERSONNALISÉE -->
    <div id="error-modal" class="modal-overlay">
        <div class="modal-box error-box">
            <div class="modal-icon">⚠️</div>
            <h3 class="modal-title">Oups !</h3>
            <p id="error-message">Une erreur est survenue.</p>
            <button onclick="closeError()" class="btn-red">Compris</button>
        </div>
    </div>

    <!-- POPUP DE CONFIRMATION PERSONNALISÉE -->
    <div id="confirm-modal" class="modal-overlay">
        <div class="modal-box confirm-box">
            <div class="modal-icon">❓</div>
            <h3 class="modal-title">Confirmation</h3>
            <p id="confirm-message">Êtes-vous sûr ?</p>
            <div class="modal-buttons">
                <button onclick="closeConfirm(false)" class="btn-blue" style="margin-right:10px;">Non</button>
                <button onclick="closeConfirm(true)" class="btn-red">Oui</button>
            </div>
        </div>
    </div>

    <script src="../js/base.js?v=<?= filemtime('../js/base.js') ?>"></script>
    <script src="../js/chess/Chess.js?v=<?= filemtime('../js/chess/Chess.js') ?>"></script>
    <script src="../js/chess/listeners.js?v=<?= filemtime('../js/chess/listeners.js') ?>"></script>
</body>

</html>