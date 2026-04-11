let lastStateStr = "";
let lastUpdateTime = 0;
let lastStatus = "";
let activeRoundEndKey = "";
let lastReadySignature = "";
let revengeLaunchTriggered = false;
let selectedPromotionPiece = "queen";
let previousBoardState = null;
let lastAnimatedMoveSignature = "";

// let additionnalPath = "../";
let additionnalPath = "";

const TIME_CONTROL_LABELS = {
  unlimited: "Illimite",
  "3600": "1h",
  "1800": "30 min",
  "900": "15 min",
};
const CHESS_TAGS = {
  EN_PASSANT: "en_passant",
  CASTLING: "castling",
  PROMOTION: "promotion",
  CHECK: "check",
  CHECKMATE: "checkmate",
  MOVE: "move",
  TAKE_PIECE: "take_piece",
};

window.onload = function () {
  initGame("chess");
  checkSession();
};

// afficher l'un des ecrans (lobby, game, etc.)
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function enterLobby(rid, admin) {
  myRoomId = rid;
  isAdmin = admin;
  showScreen("screen-lobby");
  document.getElementById("lobby-code").innerText = rid;

  // Reset UI
  document.getElementById("admin-controls").style.display = "none";
  document.getElementById("guest-controls").style.display = "none";

  // Handlers des paramètres (Admin seulement)
  const scoreSel = document.getElementById("lobby-param-XXXX");
  if (scoreSel && scoreSel.options.length === 0) {
    scoreSel.innerHTML = `
      <option value="unlimited">Illimite</option>
      <option value="3600">1h</option>
      <option value="1800">30 min</option>
      <option value="900">15 min</option>
    `;
  }
  scoreSel.onchange = function () {
    fetch(additionnalPath + `Chess/api.php?action=updateSettings&roomId=${myRoomId}&param=${this.value}`);
  };

  startPolling();
}

// --- 2. BOUCLE DE JEU (POLLING) ---

function startPolling() {
  setInterval(() => {
    if (!myRoomId) return;
    fetch(additionnalPath + `Chess/api.php?action=get&roomId=${myRoomId}`)
      .then((r) => {
        const tmp = r.json();
        return tmp;
      })
      .then((data) => {
        if (data.status !== "round_end") {
          document.getElementById("score-modal").style.display = "none";
        }
        if (!data || !data.players) return;

        renderTimer(data);

        // Mise à jour de mon index si nécessaire
        if (myName) {
          const me = data.players.find((p) => p.name === myName);
          if (me) {
            const newIndex = data.players.indexOf(me);
            if (newIndex !== myIndex) {
              myIndex = newIndex;
              sessionStorage.setItem("belote_index", newIndex);
            }
          }
        }

        // Gestion Admin
        if (data.admin && myName) {
          isAdmin = data.admin === myName;
          document.getElementById("admin-controls").style.display = isAdmin ? "block" : "none";
          document.getElementById("guest-controls").style.display = isAdmin ? "none" : "block";
          const sl = document.getElementById("lobby-param-XXXX");
          if (sl) sl.disabled = !isAdmin;
        }

        // Dispatch selon l'état
        if (data.status === "lobby") {
          showScreen("screen-lobby");
          document.getElementById("score-modal").style.display = "none";
          updateLobby(data);
          lastStatus = data.status;
        } else {
          const statusChanged = lastStatus !== data.status;
          const readySignature = `${data.round || 0}|${(data.ready || []).join(",")}`;
          const readyChangedOnRoundEnd =
            data.status === "round_end" && readySignature !== lastReadySignature;

          if (lastUpdateTime != data.lastUpdate || statusChanged || readyChangedOnRoundEnd) {
            lastUpdateTime = new Number(data.lastUpdate);
            updateGameUI(data);
            lastStatus = data.status;
            if (data.status === "round_end") {
              lastReadySignature = readySignature;
            }
          }
        }
      })
      .catch((e) => console.error("Polling error:", e));
  }, 500);
}

// --- 3. LOGIQUE DU LOBBY ---

function refreshRoomList() {
  const container = document.getElementById("room-list-container");
  const btn = document.querySelector(".btn-refresh");

  // Animation bouton
  if (btn) {
    btn.style.transform = "rotate(360deg)";
    setTimeout(() => (btn.style.transform = "rotate(0deg)"), 500);
  }

  fetch(additionnalPath + "Chess/api.php?action=listRooms")
    .then((r) => {
      let tmp = r.json();
      return tmp;
    })
    .then((data) => {
      if (!data.success) return;

      if (data.rooms.length === 0) {
        container.innerHTML =
          '<div class="no-rooms">Aucun salon disponible.<br>Créez le vôtre !</div>';
        return;
      }

      container.innerHTML = data.rooms
        .map(
          (room) => `
                <div class="room-card">
                    <div class="room-info">
                        <div class="room-host">Table de ${room.admin}</div>
                        <div class="room-details">
                            <span class="room-badge">👥 ${room.count}/2</span>
                  <span class="room-badge">⚙️ Temps: ${TIME_CONTROL_LABELS[room.param] || TIME_CONTROL_LABELS.unlimited}</span>
                        </div>
                    </div>
                    <div class="room-action">
                        <button class="btn-blue" onclick="joinGame('${room.id}')">Rejoindre</button>
                    </div>
                </div>
            `,
        )
        .join("");
    });
}

function updateLobby(data) {
    document.getElementById('player-count').innerText = `${data.players.length}/${data.playerLimit ?? 2}`;
    document.getElementById('lobby-players-list').innerHTML = data.players.map((p, i) => 
        `<div class="player-item ${p.name === myName ? 'is-me' : ''}">
            <span>${i+1}. ${p.name}</span>
            ${p.name === data.admin ? '👑' : ''}
        </div>`
    ).join('');

  // Update des paramètres

  const scoreSel = document.getElementById("lobby-param-XXXX");
  if (scoreSel && document.activeElement !== scoreSel)
    scoreSel.value = data.param || "unlimited";

  // Bouton Lancer (Admin seulement)
  if (isAdmin) {
    const btn = document.getElementById("btn-launch");
    const count = data.players.length;
    // On autorise le lancement à partir de 2 joueurs
    if (count < 2) {
      btn.disabled = true;
      btn.innerText = `EN ATTENTE (${count}/2)`;
    } else {
      btn.disabled = false;
      btn.innerText = "LANCER LA PARTIE";
    }
  }
}

// --- 4. LOGIQUE DU JEU (RENDU) ---

function updateGameUI(data) {
  renderTimer(data);

  // Si on joue, on affiche le jeu et on cache le modal
  if (data.status === "playing") {
    showScreen("screen-game");
    document.getElementById("score-modal").style.display = "none";
    renderGame(data);
  }
  // Si le round est fini, on affiche le jeu (pour voir la dernière carte) ET le modal
  else if (data.status === "round_end") {
    showScreen("screen-game");
    renderGame(data); // Affiche la table complète
    showRoundStats(data);
  }
}

function showRoundStats(data) {
  const modal = document.getElementById("score-modal");
  const content = document.getElementById("score-content");

  if (!data.roundStats) return;
  const winnerName = data.players[data.roundStats.winnerIndex].name;
  const roundEndKey = `${data.round || 0}:${data.roundStats.reason || ""}:${
    data.roundStats.winnerIndex
  }`;
  const readyCount = Array.isArray(data.ready) ? data.ready.length : 0;
  const readyTotal = data.players.length;
  const myReady = Array.isArray(data.ready) && data.ready.includes(myIndex);

  let reasonStr = "";
  switch (data.roundStats.reason) {
    case "checkmate":
      reasonStr = "échec et mat";
      break;
    case "resignation":
      reasonStr = "abandon";
      break;
    case "timeout":
      reasonStr = "dépassement de temps";
      break;
    default:
      reasonStr = data.roundStats.reason;
  }

  if (activeRoundEndKey !== roundEndKey) {
    activeRoundEndKey = roundEndKey;
    revengeLaunchTriggered = false;
    content.innerHTML = `
      <div class="endgame-modal">
        <div class="endgame-header">
          <h2>Fin de la partie</h2>
          <span class="endgame-reason">${reasonStr}</span>
        </div>
        <div class="endgame-body">
          <p class="endgame-winner-label">Vainqueur</p>
          <p class="endgame-winner-name">${winnerName}</p>
          <p id="revenge-counter" class="endgame-ready-counter">Revanche: ${readyCount}/${readyTotal}</p>
          <p id="revenge-status" class="endgame-ready-status">Clique sur Revanche pour relancer.</p>
        </div>
        <div class="endgame-actions">
          <button onclick="backToLobby()" class="btn-red">Quitter</button>
          <button id="revenge-btn" onclick="continueGame()" class="btn-green">Revanche</button>
        </div>
      </div>
    `;
  }

  const counter = document.getElementById("revenge-counter");
  const status = document.getElementById("revenge-status");
  const revengeBtn = document.getElementById("revenge-btn");
  if (counter) counter.innerText = `Revanche: ${readyCount}/${readyTotal}`;

  if (status) {
    if (readyCount >= readyTotal) {
      status.innerText = "Tous les joueurs sont prêts. Redémarrage...";
    } else if (myReady) {
      status.innerText = "Tu es prêt. En attente de l'autre joueur...";
    } else {
      status.innerText = "Clique sur Revanche pour relancer.";
    }
  }

  if (revengeBtn) {
    revengeBtn.disabled = myReady;
    revengeBtn.innerText = myReady ? "En attente..." : "Revanche";
  }

  if (readyCount === readyTotal && !revengeLaunchTriggered) {
    revengeLaunchTriggered = true;
    fetch(additionnalPath + `Chess/api.php?action=startRound&roomId=${myRoomId}`).then(() => {
      lastUpdateTime = 0;
      modal.style.display = "none";
      activeRoundEndKey = "";
      lastReadySignature = "";
    });
  }

  modal.style.display = "flex";
}

function showPromotionScreen(originCellId, destinationCellId) {
  console.log("Showing promotion screen for move:", {
    originCellId,
    destinationCellId,
  });
  const modal = document.getElementById("promotion-modal");
  const content = document.getElementById("promotion-content");
  selectedPromotionPiece = "queen";
  content.innerHTML = `
      <div class="promotion-modal-body">
        <div class="promotion-header">
          <h2>Promotion</h2>
          <p>Choisis la piece a obtenir</p>
        </div>
        <div class="promotion-options" role="radiogroup" aria-label="Choix de promotion">
          <button class="promotion-piece-option active" type="button" data-piece="queen" onclick="choosePromotionPiece('queen')">
            <span class="promotion-piece-icon">♛</span>
            <span class="promotion-piece-label">Reine</span>
          </button>
          <button class="promotion-piece-option" type="button" data-piece="rook" onclick="choosePromotionPiece('rook')">
            <span class="promotion-piece-icon">♜</span>
            <span class="promotion-piece-label">Tour</span>
          </button>
          <button class="promotion-piece-option" type="button" data-piece="bishop" onclick="choosePromotionPiece('bishop')">
            <span class="promotion-piece-icon">♝</span>
            <span class="promotion-piece-label">Fou</span>
          </button>
          <button class="promotion-piece-option" type="button" data-piece="knight" onclick="choosePromotionPiece('knight')">
            <span class="promotion-piece-icon">♞</span>
            <span class="promotion-piece-label">Cavalier</span>
          </button>
        </div>
        <div class="promotion-actions">
            <button onclick="cancelPromotion()" class="btn-red">Annuler</button>
            <button onclick="promote()" class="btn-green">Promouvoir</button>
        </div>
      </div>
  `;

  modal.dataset.origin = originCellId;
  modal.dataset.destination = destinationCellId;

  modal.style.display = "flex";
}

function choosePromotionPiece(piece) {
  selectedPromotionPiece = piece;
  const options = document.querySelectorAll(".promotion-piece-option");
  options.forEach((option) => {
    option.classList.toggle("active", option.dataset.piece === piece);
  });
}

function cancelPromotion() {
  const modal = document.getElementById("promotion-modal");
  const content = document.getElementById("promotion-content");
  content.innerHTML = "";
  modal.style.display = "none";
}

function continueGame() {
  const revengeBtn = document.getElementById("revenge-btn");
  if (revengeBtn) {
    revengeBtn.disabled = true;
    revengeBtn.innerText = "En attente...";
  }

  fetch(additionnalPath + `Chess/api.php?action=restart&roomId=${myRoomId}&index=${myIndex}`)
    .then((r) => {
      let tmp = r.json();
      return tmp;
    })
    .then((data) => {
      const dt = data.gameState;
      showRoundStats(dt);
      return data;
    });
}

function renderGame(data) {
  // Sécurité index

  if (myIndex === null) {
    data.players.forEach((p, i) => {
      if (p.name === myName) myIndex = i;
    });
  }

  const playerCount = data.players.length;
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const numbers = [8, 7, 6, 5, 4, 3, 2, 1];
  const firstColor = "rgba(255, 255, 255, 1)";
  const secondColor = "rgba(147, 96, 8, 1)";
  const tabDraw = {
    pawn: "♟",
    rook: "♜",
    knight: "♞",
    bishop: "♝",
    queen: "♛",
    king: "♚",
  };

  const boardHTML = document.getElementById("game-container");
  const announcer = document.getElementById("game-announcer");
  const mainContainer = document.querySelector(".game-main");
  boardHTML.innerHTML = "";
  if (mainContainer) {
    mainContainer.classList.toggle("round-win", data.status === "round_end");
  }

  // Wrapper that will be centered by CSS
  const boardWrapper = document.createElement("div");
  boardWrapper.className = "chess-board";
  if (data.status === "round_end") {
    boardWrapper.classList.add("is-win-state");
  }
  applyBoardSizing(boardHTML, boardWrapper);

  let view = "white";
  if (data.players[myIndex] && data.players[myIndex].color === "black")
    view = "black";

  // const lettersArr = view === "white" ? letters.slice() : letters.slice().reverse();
  const lettersArr = letters.slice();
  const numbersArr =
    view === "white"
      ? numbers.slice(0, 8)
      : numbers.slice(0, 8).slice().reverse();

  // Création des cases du plateau
  numbersArr.forEach((num, rowIndex) => {
    const row = num; // numeric rank
    const rowDiv = document.createElement("div");
    rowDiv.className = "chess-row";

    const leftNumberDiv = document.createElement("div");
    leftNumberDiv.className = "chess-number";
    leftNumberDiv.innerText = num;
    rowDiv.appendChild(leftNumberDiv);

    lettersArr.forEach((letter, col) => {
      const cell = document.createElement("div");
      cell.className = "chess-cell";
      cell.id = `cell-${letter}-${row}`;

      // Background color handled by CSS but we keep color logic here
      if (row % 2 == 0) {
        cell.style.backgroundColor = col % 2 == 0 ? firstColor : secondColor;
      } else {
        cell.style.backgroundColor = col % 2 == 0 ? secondColor : firstColor;
      }

      addCellHoverListener(cell);
      addCellRightClickListener(cell);
      cell.data = {};
      cell.data["xpos"] = letter;
      cell.data["ypos"] = row;
      cell.data["round"] = data.round;
      cell.data["tags"] = [];
      addCellClickListener(cell, null);
      rowDiv.appendChild(cell);
    });

    boardWrapper.appendChild(rowDiv);
  });
  const bottomRow = document.createElement("div");
  bottomRow.className = "chess-row";

  // add empty corner to align letters under cells

  lettersArr.forEach((element) => {
    const letterDiv = document.createElement("div");
    letterDiv.className = "chess-letter";
    letterDiv.innerText = element;
    bottomRow.appendChild(letterDiv);
  });

  boardWrapper.appendChild(bottomRow);

  boardHTML.appendChild(boardWrapper);

  renderCapturedPanels(data, tabDraw);

  const cellSize = getBoardCellSize(boardWrapper);

  // Render pieces on the board
  lstPieces = ["pawn", "rook", "knight", "bishop", "queen", "king"];
  data.players.forEach((p) => {
    lstPieces.forEach((pieceName) => {
      p.pieces[pieceName].forEach((piece) => {
        const pieceElement = document.createElement("div");
        pieceElement.className = `piece`;
        pieceElement.textContent = tabDraw[pieceName];
        pieceElement.style.color = p.color === "white" ? "#fff" : "#111";
        pieceElement.style.fontSize = `${Math.round(cellSize * 0.68)}px`;
        pieceElement.style.textShadow =
          p.color === "white"
            ? "0 2px 10px rgba(0, 0, 0, 0.8)"
            : "0 1px 0 rgba(255, 255, 255, 0.05)";
        const cell = document.getElementById(`cell-${piece.position}`);
        if (data.turnIndex === myIndex) {
          if (p.color === data.players[myIndex].color) {
            addCellClickListener(cell, p.color);
          }
        }
        cell.data["piece"] = pieceName;
        cell.data["color"] = p.color;
        cell.data["position"] = piece.position;
        cell.data["nbMoves"] = piece.nbMoves;
        cell.data["lastRoundPlay"] = piece.lastRoundPlay;
        cell.appendChild(pieceElement);
      });
    });
  });

  const checkedColors = new Set();
  data.players.forEach((p) => {
    // Highlight king if in check
    if (checkKingInCheck(p.color)) {
      checkedColors.add(p.color);
      const kingPos = Object.values(p.pieces["king"])[0].position;
      const kingCell = document.getElementById(`cell-${kingPos}`);
      if (kingCell) {
        kingCell.classList.add("isCheck");
      }
    }
  });

  renderPlayersOverlay(data, checkedColors);
  animateLatestMove(data, cellSize);

  previousBoardState = buildBoardStateSnapshot(data);

  // Check here if checkmate
  if (
    isCheckmate(data.players[data.turnIndex]["color"]) &&
    data.status === "playing"
  ) {
    fetch(
      additionnalPath + `Chess/api.php?action=declareCheckmate&roomId=${myRoomId}&index=${myIndex}`,
    )
      .then((r) => {
        let tmp = r.json();
        return tmp;
      })
      .catch((e) => {
        console.error("Checkmate declaration error:", e);
      });
  }

  // C. STATUT
  let statusText = `Tour de : ${data.players[data.turnIndex].name}`;
  if (data.turnIndex === myIndex) statusText = "🟢 À TOI DE JOUER !";
  announcer.innerHTML = statusText;

  renderHistory(data, checkedColors);
}

function getPlayerPieceCounts(player) {
  const counts = {
    pawn: 0,
    rook: 0,
    knight: 0,
    bishop: 0,
    queen: 0,
    king: 0,
  };

  Object.keys(counts).forEach((pieceName) => {
    counts[pieceName] = Array.isArray(player?.pieces?.[pieceName])
      ? player.pieces[pieceName].length
      : 0;
  });

  return counts;
}

function computeMissingPiecesForColor(players, color) {
  const baseline = {
    pawn: 8,
    rook: 2,
    knight: 2,
    bishop: 2,
    queen: 1,
    king: 1,
  };

  const player = players.find((p) => p.color === color);
  if (!player) return { ...baseline };

  const current = getPlayerPieceCounts(player);
  const missing = {
    pawn: Math.max(0, baseline.pawn - current.pawn),
    rook: Math.max(0, baseline.rook - current.rook),
    knight: Math.max(0, baseline.knight - current.knight),
    bishop: Math.max(0, baseline.bishop - current.bishop),
    queen: Math.max(0, baseline.queen - current.queen),
    king: Math.max(0, baseline.king - current.king),
  };

  // Promotions create extra non-pawn pieces and consume pawns, so adjust pawn losses.
  const extras =
    Math.max(0, current.rook - baseline.rook) +
    Math.max(0, current.knight - baseline.knight) +
    Math.max(0, current.bishop - baseline.bishop) +
    Math.max(0, current.queen - baseline.queen);

  missing.pawn = Math.max(0, missing.pawn - extras);

  return missing;
}

function expandCapturedIcons(missingCounts, tabDraw, capturedColor) {
  const order = ["queen", "rook", "bishop", "knight", "pawn"];
  const icons = [];
  order.forEach((pieceName) => {
    const qty = missingCounts[pieceName] || 0;
    for (let i = 0; i < qty; i++) {
      icons.push({
        icon: tabDraw[pieceName],
        color: capturedColor,
        type: pieceName,
      });
    }
  });
  return icons;
}

function expandCapturedIconsFromTypes(capturedTypes, tabDraw, capturedColor) {
  const orderRank = {
    queen: 0,
    rook: 1,
    bishop: 2,
    knight: 3,
    pawn: 4,
    king: 5,
  };

  return capturedTypes
    .slice()
    .sort((a, b) => (orderRank[a] ?? 99) - (orderRank[b] ?? 99))
    .map((type) => ({
      icon: tabDraw[type] || "?",
      color: capturedColor,
      type,
    }));
}

function buildInitialPiecesMap() {
  const map = new Map();
  const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const order = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

  letters.forEach((file, i) => {
    map.set(`${file}-1`, { type: order[i], color: "white" });
    map.set(`${file}-2`, { type: "pawn", color: "white" });
    map.set(`${file}-8`, { type: order[i], color: "black" });
    map.set(`${file}-7`, { type: "pawn", color: "black" });
  });

  return map;
}

function computeCapturedByHistory(data) {
  const history = Array.isArray(data?.history) ? data.history : [];
  const players = Array.isArray(data?.players) ? data.players : [];
  if (history.length === 0 || players.length < 2) {
    return { white: [], black: [] };
  }

  const board = buildInitialPiecesMap();
  const capturedBy = { white: [], black: [] };

  const captureAt = (position, actorColor) => {
    const target = board.get(position);
    if (!target || target.color === actorColor) return null;
    board.delete(position);
    capturedBy[actorColor].push(target.type);
    return target;
  };

  const movePiece = (origin, destination, actorColor, fallbackType) => {
    let piece = board.get(origin);
    if (!piece) {
      piece = { type: fallbackType || "pawn", color: actorColor };
    } else {
      board.delete(origin);
    }
    board.set(destination, piece);
  };

  for (const entry of history) {
    const actorColor = players[entry.playerIndex]?.color;
    if (!actorColor) continue;

    const origin = entry.origin;
    const destination = entry.destination;
    const tag = entry.tag || CHESS_TAGS.MOVE;
    const fallbackType = entry.pieceName || "pawn";

    if (!origin || !destination) continue;

    if (tag === CHESS_TAGS.TAKE_PIECE) {
      captureAt(destination, actorColor);
      movePiece(origin, destination, actorColor, fallbackType);
      continue;
    }

    if (tag === CHESS_TAGS.EN_PASSANT) {
      const [originFile, originRank] = String(origin).split("-");
      const [destinationFile] = String(destination).split("-");
      const capturedPos = `${destinationFile}-${originRank}`;
      captureAt(capturedPos, actorColor);
      movePiece(origin, destination, actorColor, fallbackType);
      continue;
    }

    if (tag === CHESS_TAGS.CASTLING) {
      movePiece(origin, destination, actorColor, "king");
      const [, rank] = String(origin).split("-");
      const [destFile] = String(destination).split("-");
      if (destFile === "G") {
        movePiece(`H-${rank}`, `F-${rank}`, actorColor, "rook");
      } else if (destFile === "C") {
        movePiece(`A-${rank}`, `D-${rank}`, actorColor, "rook");
      }
      continue;
    }

    if (tag === CHESS_TAGS.PROMOTION) {
      // Promotion may also include a capture on destination square.
      captureAt(destination, actorColor);
      board.delete(origin);
      board.set(destination, {
        type: fallbackType,
        color: actorColor,
      });
      continue;
    }

    movePiece(origin, destination, actorColor, fallbackType);
  }

  return capturedBy;
}

function renderCapturedPanels(data, tabDraw) {
  const container = document.getElementById("game-container");
  const sidebar = document.querySelector(".game-sidebar");
  if (!container || !Array.isArray(data.players) || data.players.length === 0) return;

  const oldPanels = Array.from(container.querySelectorAll(".captured-panel"));
  oldPanels.forEach((el) => el.remove());

  const oldSidebarHost = document.getElementById("game-captured-sidebar");
  if (oldSidebarHost) oldSidebarHost.remove();

  const safeMyIndex =
    myIndex !== null && myIndex >= 0 && myIndex < data.players.length ? myIndex : 0;
  const opponentIndex = data.players.findIndex((_, i) => i !== safeMyIndex);
  if (opponentIndex < 0) return;

  const me = data.players[safeMyIndex];
  const opponent = data.players[opponentIndex];

  const capturedBy = computeCapturedByHistory(data);
  let piecesWonByMe = expandCapturedIconsFromTypes(
    capturedBy[me.color] || [],
    tabDraw,
    opponent.color,
  );
  let piecesWonByOpponent = expandCapturedIconsFromTypes(
    capturedBy[opponent.color] || [],
    tabDraw,
    me.color,
  );

  // Fallback for legacy states without complete history.
  if (piecesWonByMe.length === 0 && piecesWonByOpponent.length === 0) {
    piecesWonByMe = expandCapturedIcons(
      computeMissingPiecesForColor(data.players, opponent.color),
      tabDraw,
      opponent.color,
    );
    piecesWonByOpponent = expandCapturedIcons(
      computeMissingPiecesForColor(data.players, me.color),
      tabDraw,
      me.color,
    );
  }

  const leftPanel = document.createElement("div");
  leftPanel.className = "captured-panel captured-panel-left";
  leftPanel.innerHTML = `
    <div class="captured-title">Prises ${opponent.name}</div>
    <div class="captured-list">${
      piecesWonByOpponent.length
        ? piecesWonByOpponent
            .map(
              (item) =>
                `<span class="captured-piece captured-piece-${item.color} captured-piece-${item.type}">${item.icon}</span>`,
            )
            .join("")
        : '<span class="captured-empty">Aucune</span>'
    }</div>
  `;

  const rightPanel = document.createElement("div");
  rightPanel.className = "captured-panel captured-panel-right";
  rightPanel.innerHTML = `
    <div class="captured-title">Prises ${me.name}${safeMyIndex === myIndex ? " (Toi)" : ""}</div>
    <div class="captured-list">${
      piecesWonByMe.length
        ? piecesWonByMe
            .map(
              (item) =>
                `<span class="captured-piece captured-piece-${item.color} captured-piece-${item.type}">${item.icon}</span>`,
            )
            .join("")
        : '<span class="captured-empty">Aucune</span>'
    }</div>
  `;

  if (sidebar) {
    const sidebarHost = document.createElement("div");
    sidebarHost.id = "game-captured-sidebar";
    sidebarHost.className = "game-captured-sidebar";

    leftPanel.className = "captured-panel captured-panel-sidebar";
    rightPanel.className = "captured-panel captured-panel-sidebar";

    sidebarHost.appendChild(leftPanel);
    sidebarHost.appendChild(rightPanel);

    const historyTitle = sidebar.querySelector(".sidebar-section-title");
    if (historyTitle) {
      sidebar.insertBefore(sidebarHost, historyTitle);
    } else {
      sidebar.prepend(sidebarHost);
    }
    return;
  }

  container.appendChild(leftPanel);
  container.appendChild(rightPanel);
}

function buildBoardStateSnapshot(data) {
  const snapshot = new Map();
  if (!data || !Array.isArray(data.players)) return snapshot;

  data.players.forEach((player) => {
    ["pawn", "rook", "knight", "bishop", "queen", "king"].forEach((pieceName) => {
      (player.pieces[pieceName] || []).forEach((piece) => {
        snapshot.set(piece.position, {
          piece: pieceName,
          color: player.color,
        });
      });
    });
  });

  return snapshot;
}

function animateLatestMove(data, cellSize) {
  const history = Array.isArray(data.history) ? data.history : [];
  if (history.length === 0) return;

  const lastMove = history[history.length - 1];
  const signature = `${data.round || 0}|${history.length}|${lastMove.origin}|${lastMove.destination}|${lastMove.tag}`;
  if (signature === lastAnimatedMoveSignature) return;
  lastAnimatedMoveSignature = signature;

  const originCell = document.getElementById(`cell-${lastMove.origin}`);
  const destinationCell = document.getElementById(`cell-${lastMove.destination}`);
  if (!destinationCell) return;

  const pieceEl = destinationCell.querySelector(".piece");
  if (pieceEl && originCell) {
    const originRect = originCell.getBoundingClientRect();
    const destRect = destinationCell.getBoundingClientRect();
    const deltaX = originRect.left - destRect.left;
    const deltaY = originRect.top - destRect.top;

    pieceEl.animate(
      [
        { transform: `translate(${deltaX}px, ${deltaY}px) scale(1.06)` },
        { transform: "translate(0px, 0px) scale(1)" },
      ],
      {
        duration: 300,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    );
  }

  const shouldCaptureAnimate =
    lastMove.tag === CHESS_TAGS.TAKE_PIECE ||
    lastMove.tag === CHESS_TAGS.EN_PASSANT ||
    lastMove.tag === CHESS_TAGS.PROMOTION;

  if (shouldCaptureAnimate) {
    let captureCell = destinationCell;

    if (lastMove.tag === CHESS_TAGS.EN_PASSANT) {
      const [originFile, originRank] = String(lastMove.origin).split("-");
      const [destinationFile] = String(lastMove.destination).split("-");
      captureCell = document.getElementById(`cell-${destinationFile}-${originRank}`) || destinationCell;
    }

    const hadCapturedPiece = previousBoardState && previousBoardState.has(captureCell.id.replace("cell-", ""));
    if (hadCapturedPiece || lastMove.tag === CHESS_TAGS.TAKE_PIECE || lastMove.tag === CHESS_TAGS.EN_PASSANT) {
      captureCell.classList.add("capture-flash");
      setTimeout(() => captureCell.classList.remove("capture-flash"), 380);
    }
  }

  if (lastMove.tag === CHESS_TAGS.PROMOTION && pieceEl) {
    pieceEl.classList.add("promotion-pop");
    setTimeout(() => pieceEl.classList.remove("promotion-pop"), 500);
  }

  if (data.status === "round_end" && data.roundStats) {
    const winnerLabel = document.getElementById(`player-label-${data.roundStats.winnerIndex}`);
    if (winnerLabel) {
      winnerLabel.classList.add("winner-label");
    }
  }

}

function applyBoardSizing(boardContainer, boardWrapper) {
  if (!boardContainer || !boardWrapper) return;

  const width = boardContainer.clientWidth || 900;
  const height = boardContainer.clientHeight || 700;

  // Board must not exceed 80% of available container dimensions.
  const availableWidth = Math.max(260, width * 0.8);
  const availableHeight = Math.max(220, height * 0.8);

  const rankRatio = 0.42;
  const fileLabelRatio = 0.42;
  const horizontalPadding = 12;
  const verticalPadding = 10;

  const byWidth = (availableWidth - horizontalPadding) / (8 + rankRatio);
  const byHeight = (availableHeight - verticalPadding) / (8 + fileLabelRatio);
  const cellSize = Math.floor(Math.max(36, Math.min(86, byWidth, byHeight)));

  boardWrapper.style.setProperty("--chess-cell-size", `${cellSize}px`);
}

function getBoardCellSize(boardWrapper) {
  const raw = getComputedStyle(boardWrapper).getPropertyValue("--chess-cell-size");
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 70;
}

function renderPlayersOverlay(data, checkedColors = new Set()) {
  const container = document.getElementById("game-container");
  if (!container || !Array.isArray(data.players) || data.players.length === 0) return;

  const oldLabels = Array.from(container.querySelectorAll(".player-label.chess-player-label"));
  oldLabels.forEach((el) => el.remove());

  const safeMyIndex =
    myIndex !== null && myIndex >= 0 && myIndex < data.players.length ? myIndex : 0;
  const opponentIndex = data.players.findIndex((_, i) => i !== safeMyIndex);

  const topIndex = opponentIndex === -1 ? safeMyIndex : opponentIndex;
  const bottomIndex = safeMyIndex;

  const topPlayer = data.players[topIndex];
  const bottomPlayer = data.players[bottomIndex];

  container.appendChild(
    buildPlayerLabel(
      topPlayer,
      topIndex,
      "p-top",
      data.turnIndex === topIndex,
      checkedColors.has(topPlayer.color),
    ),
  );

  if (topIndex !== bottomIndex) {
    container.appendChild(
      buildPlayerLabel(
        bottomPlayer,
        bottomIndex,
        "p-bottom",
        data.turnIndex === bottomIndex,
        checkedColors.has(bottomPlayer.color),
      ),
    );
  }
}

function buildPlayerLabel(player, playerIndex, positionClass, isActiveTurn, isInCheck) {
  const color = player.color || "";
  const teamClass = color === "black" ? "team-b" : "team-a";
  const shortName = (player.name || "?").trim().charAt(0).toUpperCase() || "?";
  const colorLabel = color === "black" ? "Noir" : "Blanc";
  const isMe = playerIndex === myIndex;

  const wrapper = document.createElement("div");
  wrapper.className = `player-label chess-player-label ${positionClass} ${teamClass}`;
  wrapper.id = `player-label-${playerIndex}`;
  if (isActiveTurn) wrapper.classList.add("active-turn");
  if (isInCheck) wrapper.classList.add("in-check");

  wrapper.innerHTML = `
    <div class="player-avatar">${shortName}</div>
    <div class="player-info">
      <div class="player-name">${player.name || "Joueur"}${isMe ? " (Toi)" : ""}</div>
      <div class="player-stats">${colorLabel}${
        isInCheck ? ' <span class="check-indicator">En échec</span>' : ""
      }</div>
    </div>
  `;

  return wrapper;
}

function renderHistory(data, checkedColors = new Set()) {
  const historyContainer = document.getElementById("game-history");
  if (!historyContainer) return;

  const history = Array.isArray(data.history) ? data.history : [];
  if (history.length === 0) {
    historyContainer.innerHTML = '<p class="history-empty">Aucun coup pour le moment.</p>';
    return;
  }

  const actionMap = {
    move: { icon: "↦", label: "Déplacement", cls: "move" },
    take_piece: { icon: "✖", label: "Prise", cls: "capture" },
    en_passant: { icon: "✖", label: "En passant", cls: "capture" },
    promotion: { icon: "⬆", label: "Promotion", cls: "promotion" },
    castling: { icon: "♜", label: "Roque", cls: "castling" },
  };

  historyContainer.innerHTML = history
    .slice()
    .reverse()
    .map((entry, idx) => {
      const moveNo = history.length - idx;
      const isLatest = idx === 0;
      const actor = data.players[entry.playerIndex];
      const actorName = entry.playerIndex === myIndex ? "Toi" : actor?.name || "Joueur";
      const actorColor = actor?.color || "white";
      const opponentColor = actorColor === "white" ? "black" : "white";
      const checkAfterMove = isLatest && checkedColors.has(opponentColor);

      const key = String(entry.tag || "move");
      const action = actionMap[key] || { icon: "•", label: "Coup", cls: "move" };

      return `
        <div class="history-item history-item--${action.cls}">
          <div class="history-item-head">
            <span class="history-index">#${moveNo}</span>
            <span class="history-badge history-badge--${action.cls}">${action.icon} ${action.label}</span>
            ${checkAfterMove ? '<span class="history-badge history-badge--check">⚠ Échec</span>' : ""}
          </div>
          <div class="history-item-body">
            <span class="history-player">${actorName}</span>
            <span class="history-piece">${entry.pieceName}</span>
            <span class="history-path">${entry.origin} → ${entry.destination}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderTimer(data) {
  const timerValue = document.getElementById("game-timer-value");
  const timerMode = document.getElementById("game-timer-mode");
  if (!timerValue || !timerMode || !data) return;

  const startedAt = Number(data.roundStartedAt || 0);
  const now = Math.floor(Date.now() / 1000);
  const elapsed = startedAt > 0 ? Math.max(0, now - startedAt) : 0;
  const timeParam = String(data.param || "unlimited");
  const isUnlimited = timeParam === "unlimited";

  if (isUnlimited) {
    timerMode.textContent = "Chrono";
    timerValue.textContent = formatClock(elapsed);
    timerValue.classList.remove("is-warning");
    return;
  }

  const limit = Number(data.timeLimitSeconds || timeParam || 0);
  const remaining = Math.max(0, limit - elapsed);
  timerMode.textContent = `Compte a rebours (${TIME_CONTROL_LABELS[timeParam] || "limite"})`;
  timerValue.textContent = formatClock(remaining);
  timerValue.classList.toggle("is-warning", remaining <= 60);
}

function promote() {
  const modal = document.getElementById("promotion-modal");
  const originCellId = modal.dataset.origin;
  const destinationCellId = modal.dataset.destination;
  const chosenPiece = selectedPromotionPiece || "queen";
  console.log(
    `${additionnalPath}Chess/api.php?action=promote&roomId=${myRoomId}&index=${myIndex}&origin=${originCellId}&destination=${destinationCellId}&piece=${chosenPiece}`,
  ); 

  fetch(
    `${additionnalPath}Chess/api.php?action=promote&roomId=${myRoomId}&index=${myIndex}&origin=${originCellId}&destination=${destinationCellId}&piece=${chosenPiece}`,
  )
    .then((r) => {
      let tmp = r.json();
      return tmp;
    })
    .catch((e) => {
      console.error("Promotion error:", e);
    });
  cancelPromotion();
}

function playPiece(originCellId, destinationCellId, pieceName, tag) {
  console.log("Playing piece:", {
    originCellId,
    destinationCellId,
    pieceName,
    tag,
  });
  console.log(
    `${additionnalPath}Chess/api.php?action=play&roomId=${myRoomId}&index=${myIndex}&origin=${originCellId}&destination=${destinationCellId}&player=${myName}&pieceName=${pieceName}&tag=${tag}`,
  );
  fetch(
    `${additionnalPath}Chess/api.php?action=play&roomId=${myRoomId}&index=${myIndex}&origin=${originCellId}&destination=${destinationCellId}&player=${myName}&pieceName=${pieceName}&tag=${tag}`,
  )
    .then((r) => {
      let tmp = r.json();
      return tmp;
    })
    .catch((e) => {
      console.error("Play piece error:", e);
    });
}

function abandonGame() {
  showConfirm("Abandonner la partie ?", () => {
    fetch(`${additionnalPath}Chess/api.php?action=abandon&roomId=${myRoomId}&index=${myIndex}`);
  });
}

function generateCandidate(originId, piece, xpos, ypos, tag = "") {
  const origin = document.getElementById(originId);
  try {
    const candidate = document.createElement("div");
    candidate.className = "canBeSelected";
    candidate.data = {};
    candidate.data["piece"] = piece;
    candidate.data["xpos"] = xpos;
    candidate.data["ypos"] = ypos;
    candidate.data["tag"] = tag;
    origin.appendChild(candidate);
    return true;
  } catch (error) {
    console.error("Error generating candidate move:", error);
  }
  return false;
}

function canMoveTo(cellId, color) {
  const cell = document.getElementById(cellId);

  if (!cell) return { allowed: false, capture: false };

  const piece = cell.data && cell.data["piece"];
  const colorAtCell = cell.data && cell.data["color"];

  if (!piece) return { allowed: true, capture: false };

  if (color === colorAtCell) return { allowed: false, capture: false };
  let tags = [];
  return { allowed: true, capture: true };
}

function computeLineMoves(xpos, ypos, dx, dy, pieceName, color, max = -1) {
  let nextX = xpos.charCodeAt(0) + dx;
  let nextY = ypos + dy;
  const minX = "A".charCodeAt(0);
  const maxX = "H".charCodeAt(0);
  let steps = 0;
  while (
    nextX >= minX &&
    nextX <= maxX &&
    nextY >= 1 &&
    nextY <= 8 &&
    (max === -1 || steps < max)
  ) {
    const targetX = String.fromCharCode(nextX);
    const targetCellId = `cell-${targetX}-${nextY}`;
    const moveCheck = canMoveTo(targetCellId, color);
    if (!moveCheck.allowed) break;
    if (moveCheck.capture) {
      generateCandidate(
        targetCellId,
        pieceName,
        xpos,
        ypos,
        (tag = CHESS_TAGS.TAKE_PIECE),
      );
      break;
    }
    generateCandidate(
      targetCellId,
      pieceName,
      xpos,
      ypos,
      (tag = CHESS_TAGS.MOVE),
    );
    nextX += dx;
    nextY += dy;
    steps++;
  }
}

function computePossibleMoves(pieceName, xpos, ypos, color) {
  const direction = color === "white" ? 1 : -1;
  const tmp = checkKingInCheck(color);

  switch (pieceName) {
    case "pawn":
      // forward one
      const forwardY = ypos + direction;
      if (forwardY >= 1 && forwardY <= 8) {
        const forwardId = `cell-${xpos}-${forwardY}`;
        const forwardCheck = canMoveTo(forwardId, color);
        if (forwardCheck.allowed && !forwardCheck.capture) {
          if (forwardY === (color === "white" ? 8 : 1)) {
            generateCandidate(
              forwardId,
              pieceName,
              xpos,
              ypos,
              (tag = CHESS_TAGS.PROMOTION),
            );
          }else {
            generateCandidate(
              forwardId,
              pieceName,
              xpos,
              ypos,
              (tag = CHESS_TAGS.MOVE),
            );
          }

          const startRank = color === "white" ? 2 : 7;
          const doubleY = ypos + 2 * direction;
          if (ypos === startRank && doubleY >= 1 && doubleY <= 8) {
            const betweenId = `cell-${xpos}-${ypos + direction}`;
            const doubleId = `cell-${xpos}-${doubleY}`;
            const betweenCheck = canMoveTo(betweenId, color);
            const doubleCheck = canMoveTo(doubleId, color);
            if (
              betweenCheck.allowed &&
              !betweenCheck.capture &&
              doubleCheck.allowed &&
              !doubleCheck.capture
            ) {
              generateCandidate(
                doubleId,
                pieceName,
                xpos,
                ypos,
                (tag = CHESS_TAGS.MOVE),
              );
            }
          }
        }
      }

      // captures
      const captureOffsets = [-1, 1];
      captureOffsets.forEach((offset) => {
        const targetX = String.fromCharCode(xpos.charCodeAt(0) + offset);
        const targetY = ypos + direction;
        if (targetX >= "A" && targetX <= "H" && targetY >= 1 && targetY <= 8) {
          const targetCellId = `cell-${targetX}-${targetY}`;
          const moveCheck = canMoveTo(targetCellId, color);
          if (moveCheck.allowed && moveCheck.capture) {
            const isPromotionCapture = targetY === (color === "white" ? 8 : 1);
            generateCandidate(
              targetCellId,
              pieceName,
              xpos,
              ypos,
              (tag = isPromotionCapture ? CHESS_TAGS.PROMOTION : CHESS_TAGS.TAKE_PIECE),
            );
          }
        }
      });

      // EN PASSANT
      captureOffsets.forEach((offset) => {
        const adjacentX = nextLetter(xpos, offset);
        const adjacentCellId = `cell-${adjacentX}-${ypos}`;
        const adjacentCell = document.getElementById(adjacentCellId);
        if (adjacentCell && adjacentCell.data) {
          const adjacentPiece = adjacentCell.data["piece"];
          const adjacentColor = adjacentCell.data["color"];
          const adjacentLastRound = adjacentCell.data["lastRoundPlay"];
          const currentRound = adjacentCell.data["round"];
          if (
            adjacentPiece === "pawn" &&
            adjacentColor !== color &&
            adjacentLastRound === currentRound - 1 &&
            canMoveTo(adjacentCellId, color).allowed
          ) {
            const enPassantY = ypos + direction;
            const enPassantId = `cell-${adjacentX}-${enPassantY}`;
            generateCandidate(
              enPassantId,
              pieceName,
              xpos,
              ypos,
              (tag = CHESS_TAGS.EN_PASSANT),
            );
          }
        }
      });

      break;

    case "rook":
      // use computeLineMoves to handle all four straight directions
      computeLineMoves(xpos, ypos, 0, 1, pieceName, color); // UP
      computeLineMoves(xpos, ypos, 0, -1, pieceName, color); // DOWN
      computeLineMoves(xpos, ypos, 1, 0, pieceName, color); // RIGHT
      computeLineMoves(xpos, ypos, -1, 0, pieceName, color); // LEFT

      break;

    case "knight":
      const knightMoves = [
        [1, 2],
        [1, -2],
        [-1, 2],
        [-1, -2],
        [2, 1],
        [2, -1],
        [-2, 1],
        [-2, -1],
      ];

      knightMoves.forEach(([dx, dy]) => {
        const targetX = String.fromCharCode(xpos.charCodeAt(0) + dx);
        const targetY = ypos + dy;
        if (targetX >= "A" && targetX <= "H" && targetY >= 1 && targetY <= 8) {
          const targetCellId = `cell-${targetX}-${targetY}`;
          const moveCheck = canMoveTo(targetCellId, color);
          if (moveCheck.allowed) {
            if (moveCheck.capture) {
              generateCandidate(
                targetCellId,
                pieceName,
                xpos,
                ypos,
                (tag = CHESS_TAGS.TAKE_PIECE),
              );
            } else {
              generateCandidate(
                targetCellId,
                pieceName,
                xpos,
                ypos,
                (tag = CHESS_TAGS.MOVE),
              );
            }
          }
        }
      });

      break;

    case "bishop":
      computeLineMoves(xpos, ypos, 1, 1, pieceName, color); // UP-RIGHT
      computeLineMoves(xpos, ypos, -1, 1, pieceName, color); // UP-LEFT
      computeLineMoves(xpos, ypos, 1, -1, pieceName, color); // DOWN-RIGHT
      computeLineMoves(xpos, ypos, -1, -1, pieceName, color); // DOWN-LEFT
      break;

    case "queen":
      computeLineMoves(xpos, ypos, 0, 1, pieceName, color); // UP
      computeLineMoves(xpos, ypos, 0, -1, pieceName, color); // DOWN
      computeLineMoves(xpos, ypos, 1, 0, pieceName, color); // RIGHT
      computeLineMoves(xpos, ypos, -1, 0, pieceName, color); // LEFT

      computeLineMoves(xpos, ypos, 1, 1, pieceName, color); // UP-RIGHT
      computeLineMoves(xpos, ypos, -1, 1, pieceName, color); // UP-LEFT
      computeLineMoves(xpos, ypos, 1, -1, pieceName, color); // DOWN-RIGHT
      computeLineMoves(xpos, ypos, -1, -1, pieceName, color); // DOWN-LEFT
      break;

    case "king":
      computeLineMoves(xpos, ypos, 0, 1, pieceName, color, 1); // UP
      computeLineMoves(xpos, ypos, 0, -1, pieceName, color, 1); // DOWN
      computeLineMoves(xpos, ypos, 1, 0, pieceName, color, 1); // RIGHT
      computeLineMoves(xpos, ypos, -1, 0, pieceName, color, 1); // LEFT

      computeLineMoves(xpos, ypos, 1, 1, pieceName, color, 1); // UP-RIGHT
      computeLineMoves(xpos, ypos, -1, 1, pieceName, color, 1); // UP-LEFT
      computeLineMoves(xpos, ypos, 1, -1, pieceName, color, 1); // DOWN-RIGHT
      computeLineMoves(xpos, ypos, -1, -1, pieceName, color, 1); // DOWN-LEFT

      const king = document.getElementById(`cell-${xpos}-${ypos}`).data;
      const castleRank = color === "white" ? 1 : 8;
      if (
        king["nbMoves"] == 0 &&
        xpos === "E" &&
        ypos === castleRank &&
        !checkKingInCheck(color)
      ) {
        const castlings = [
          {
            rookX: "H",
            kingDestinationX: "G",
            emptyFiles: ["F", "G"],
            kingPathFiles: ["F", "G"],
          },
          {
            rookX: "A",
            kingDestinationX: "C",
            emptyFiles: ["B", "C", "D"],
            kingPathFiles: ["D", "C"],
          },
        ];

        castlings.forEach((castle) => {
          const rookCell = document.getElementById(
            `cell-${castle.rookX}-${ypos}`,
          );
          if (
            !rookCell ||
            !rookCell.data ||
            rookCell.data["piece"] !== "rook" ||
            rookCell.data["color"] !== color ||
            rookCell.data["nbMoves"] != 0
          ) {
            return;
          }

          const pathBlocked = castle.emptyFiles.some((file) => {
            const pathCell = document.getElementById(`cell-${file}-${ypos}`);
            return pathCell && pathCell.data && pathCell.data["piece"];
          });
          if (pathBlocked) return;

          const kingSafe = castle.kingPathFiles.every((file) =>
            isKingMoveSafe(
              `cell-${xpos}-${ypos}`,
              `cell-${file}-${ypos}`,
              color,
            ),
          );
          if (!kingSafe) return;

          generateCandidate(
            `cell-${castle.kingDestinationX}-${ypos}`,
            pieceName,
            xpos,
            ypos,
            (tag = CHESS_TAGS.CASTLING),
          );
        });
      }

      break;
    default:
      // tg, il y a un bug
      console.error(`Unknown piece type: ${data.piece.type}`);
      break;
  }

  // Après génération des candidats, filtrer les coups qui laissent le roi en échec.
  // On simule chaque coup sur le DOM (déplacer les données), appelle checkKingInCheck,
  // puis on restaure l'état. Les overlays qui laissent le roi en échec sont supprimés.
  const overlays = Array.from(document.getElementsByClassName("canBeSelected"));
  overlays.forEach((overlay) => {
    try {
      const targetCell = overlay.parentElement;
      const originX = overlay.data["xpos"];
      const originY = overlay.data["ypos"];
      const originCell = document.getElementById(`cell-${originX}-${originY}`);

      if (!originCell || !originCell.data) {
        overlay.remove();
        return;
      }

      // backup
      const originData = originCell.data ? { ...originCell.data } : null;
      const targetData = targetCell.data ? { ...targetCell.data } : null;

      // parse target coords
      const parts = targetCell.id.split("-");
      const targetX = parts[1];
      const targetY = parseInt(parts[2], 10);

      // simulate move
      targetCell.data = { ...originData };
      targetCell.data["xpos"] = targetX;
      targetCell.data["ypos"] = targetY;
      delete originCell.data;

      // basic EN PASSANT handling: pawn moves diagonally into empty square
      let capturedBackup = null;
      if (originData.piece === "pawn" && originX !== targetX && !targetData) {
        const capturedCell = document.getElementById(
          `cell-${targetX}-${originY}`,
        );
        if (
          capturedCell &&
          capturedCell.data &&
          capturedCell.data.piece === "pawn"
        ) {
          capturedBackup = { ...capturedCell.data };
          delete capturedCell.data;
        }
      }

      const stillInCheck = checkKingInCheck(color);

      // restore
      if (originData) originCell.data = originData;
      else delete originCell.data;
      if (targetData) targetCell.data = targetData;
      else delete targetCell.data;
      if (capturedBackup) {
        const capturedCell = document.getElementById(
          `cell-${targetX}-${originY}`,
        );
        if (capturedCell) capturedCell.data = capturedBackup;
      }

      if (stillInCheck) overlay.remove();
    } catch (e) {
      console.error("Error filtering candidate overlay:", e);
      try {
        overlay.remove();
      } catch (err) {}
    }
  });
}

function nextLetter(letter, offset) {
  return String.fromCharCode(letter.charCodeAt(0) + offset);
}

function isKingMoveSafe(originCellId, targetCellId, color) {
  const originCell = document.getElementById(originCellId);
  const targetCell = document.getElementById(targetCellId);

  if (!originCell || !originCell.data || !targetCell) return false;

  const originData = { ...originCell.data };
  const targetData = targetCell.data ? { ...targetCell.data } : null;
  const [targetX, targetY] = targetCell.id.split("-").slice(1);

  targetCell.data = { ...originData };
  targetCell.data["xpos"] = targetX;
  targetCell.data["ypos"] = parseInt(targetY, 10);
  delete originCell.data;

  const safe = !checkKingInCheck(color);

  originCell.data = originData;
  if (targetData) targetCell.data = targetData;
  else delete targetCell.data;

  return safe;
}

function checkKingInCheck(color) {
  // Return true if the king of `color` is currently attacked by any opponent piece.
  const opponent = color === "white" ? "black" : "white";

  // Find king position (constant 8x8 scan)
  let kingX = null;
  let kingY = null;
  outer: for (let xi = "A".charCodeAt(0); xi <= "H".charCodeAt(0); xi++) {
    for (let y = 1; y <= 8; y++) {
      const cell = document.getElementById(
        `cell-${String.fromCharCode(xi)}-${y}`,
      );
      if (
        cell &&
        cell.data &&
        cell.data.piece === "king" &&
        cell.data.color === color
      ) {
        kingX = String.fromCharCode(xi);
        kingY = y;
        break outer;
      }
    }
  }
  if (!kingX) return false; // king not found -> not in check

  // Helper to safely read a cell
  function getCell(xChar, y) {
    if (xChar < "A" || xChar > "H" || y < 1 || y > 8) return null;
    return document.getElementById(`cell-${xChar}-${y}`) || null;
  }

  // 1) Pawn attacks (opponent pawns that capture onto king)
  const oppDir = opponent === "white" ? 1 : -1;
  const pawnCols = [-1, 1];
  for (const dc of pawnCols) {
    const px = String.fromCharCode(kingX.charCodeAt(0) + dc);
    const py = kingY - oppDir;
    const c = getCell(px, py);
    if (c && c.data && c.data.piece === "pawn" && c.data.color === opponent)
      return true;
  }

  // 2) Knight attacks
  const knightOffsets = [
    [1, 2],
    [1, -2],
    [-1, 2],
    [-1, -2],
    [2, 1],
    [2, -1],
    [-2, 1],
    [-2, -1],
  ];
  for (const [dx, dy] of knightOffsets) {
    const nx = String.fromCharCode(kingX.charCodeAt(0) + dx);
    const ny = kingY + dy;
    const c = getCell(nx, ny);
    if (c && c.data && c.data.piece === "knight" && c.data.color === opponent)
      return true;
  }

  // 3) Adjacent enemy king
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = String.fromCharCode(kingX.charCodeAt(0) + dx);
      const ny = kingY + dy;
      const c = getCell(nx, ny);
      if (c && c.data && c.data.piece === "king" && c.data.color === opponent)
        return true;
    }
  }

  // 4) Sliding pieces: rook/queen (orthogonal) and bishop/queen (diagonal)
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];

  for (const [dx, dy] of directions) {
    let step = 1;
    while (true) {
      const nx = String.fromCharCode(kingX.charCodeAt(0) + dx * step);
      const ny = kingY + dy * step;
      const c = getCell(nx, ny);
      if (!c) break; // outside board
      if (c.data && c.data.piece) {
        if (c.data.color === opponent) {
          const p = c.data.piece;
          const isOrthogonal = dx === 0 || dy === 0;
          const isDiagonal = Math.abs(dx) === Math.abs(dy);
          if (
            (isOrthogonal && (p === "rook" || p === "queen")) ||
            (isDiagonal && (p === "bishop" || p === "queen"))
          ) {
            return true;
          }
        }
        break; // blocked by any piece (friend or foe)
      }
      step++;
    }
  }

  return false; // no attackers found
}

function clearAllOverlays() {
  const overlays = Array.from(document.getElementsByClassName("canBeSelected"));
  overlays.forEach((o) => {
    try {
      o.remove();
    } catch (e) {}
  });
}

function isCheckmate(color) {
  // Return true if `color` is in checkmate (king in check with no legal moves)
  if (!checkKingInCheck(color)) return false;

  // Scan all pieces of `color` to see if any have legal moves
  for (let xi = "A".charCodeAt(0); xi <= "H".charCodeAt(0); xi++) {
    for (let y = 1; y <= 8; y++) {
      const cell = document.getElementById(
        `cell-${String.fromCharCode(xi)}-${y}`,
      );
      if (cell && cell.data && cell.data.color === color) {
        const pieceName = cell.data.piece;
        const xpos = cell.data.xpos;
        const ypos = cell.data.ypos;
        clearAllOverlays();
        computePossibleMoves(pieceName, xpos, ypos, color);
        const overlays = document.getElementsByClassName("canBeSelected");
        if (overlays.length > 0) {
          clearAllOverlays();
          return false; // found a piece with legal moves
        }
      }
    }
  }
  return true; // no pieces have legal moves -> checkmate
}


// --- 5. ACTIONS JOUEUR ---

function launchGame() {
  fetch(additionnalPath + `Chess/api.php?action=startRound&roomId=${myRoomId}`);
}



function backToLobby() {
  showConfirm("Retourner au salon ?", () => {
    fetch(additionnalPath + `Chess/api.php?action=backToLobby&roomId=${myRoomId}`);
  });
}
