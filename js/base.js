let lastStateStr = "";
let lastUpdateTime = 0;
const suitSymbols = { Coeur: "♥", Carreau: "♦", Trefle: "♣", Pique: "♠" };
const isRed = (s) => ["Coeur", "Carreau"].includes(s);

// --- 1. INITIALISATION & NAVIGATION ---

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
  scoreSel.onchange = function () {
    fetch(`Base/api.php?action=updateSettings&roomId=${myRoomId}&param=${this.value}`);
  };

  startPolling();
}

// --- 2. BOUCLE DE JEU (POLLING) ---

function startPolling() {
  setInterval(() => {
    if (!myRoomId) return;
    fetch(`Base/api.php?action=get&roomId=${myRoomId}`)
      .then((r) => {
        const tmp = r.json();
        return tmp;
      })
      .then((data) => {
        if (data.status !== "round_end") {
          document.getElementById("score-modal").style.display = "none";
        }
        if (!data || !data.players) return;

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
          updateLobbyUI(data);
        } else {
          if (lastUpdateTime != data.lastUpdate || data.status !== "playing") {
            console.log("Game status:", data.status);
            console.log(lastUpdateTime, data.lastUpdate);
            console.log("Updating game UI...");
            lastUpdateTime = new Number(data.lastUpdate);
            updateGameUI(data);
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

  fetch("Base/api.php?action=listRooms")
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
                            <span class="room-badge">⚙️ Param: ${room.param}</span>
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

function updateLobbyUI(d) {
  // Liste des joueurs
  const list = document.getElementById("lobby-players-list");
  list.innerHTML = d.players
    .map((p, i) => {
      let cls = "player-item";
      if (p.name === myName) cls += " is-me";
      if (p.name === d.admin) cls += " is-admin";
      return `<div class="${cls}"><span>${i + 1}. ${p.name}</span></div>`;
    })
    .join("");

  // Compteur
  let c = document.getElementById("player-count");
  if (c) c.innerText = `${d.players.length}/2`;

  // Update des paramètres

  const scoreSel = document.getElementById("lobby-param-XXXX");
  if (scoreSel && document.activeElement !== scoreSel && d.param) scoreSel.value = d.param;

  // Bouton Lancer (Admin seulement)
  if (isAdmin) {
    const btn = document.getElementById("btn-launch");
    const count = d.players.length;
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
  // Si on joue, on affiche le jeu et on cache le modal
  console.log("Game status:", data.status);
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
  console.log("Round stats:", data.roundStats);
  const winnerName = data.players[data.roundStats.winnerIndex].name;
  console.log("Round winner:", winnerName);

  // Contenu du modal avec stats random et boutons
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
  content.innerHTML = `
        <h2>Fin de la partie !</h2>
        <div class="stats-box">
            <p>🏆 Vainqueur de la partie : <strong>${winnerName}</strong></p>
            <p>💬 Victoire par: <em>"${reasonStr}"</em></p>
        </div>
        <div class="modal-buttons" style="margin-top:20px; display:flex; justify-content:center; gap:10px;">
            <button onclick="backToLobby()" class="btn-red">Quitter</button>
            <button id="continue-btn" onclick="continueGame()" class="btn-green">Continuer</button>
        </div>
        <div class="whos-ready" style="margin-top:15px; font-size:0.9em; color:#555;">
            Attente des joueurs...
        </div>
    `;
  let cpt = 0;
  data.ready.forEach((i) => {
    if (i === myIndex) {
      const continueBtn = document.getElementById("continue-btn");
      continueBtn.innerText = "En attente des autres...";
    }
    cpt++;
  });

  if (cpt === data.players.length) {
    // Tous prêts, on peut continuer
    const continueBtn = document.getElementById("continue-btn");
    continueBtn.innerText = "Aller !";
    fetch(`Base/api.php?action=startRound&roomId=${myRoomId}`).then(() => {
      lastUpdateTime = 0; // Forcer la mise à jour
      modal.style.display = "none";
    });
  }
  modal.style.display = "flex";
}

function showPromotionScreen(originCellId, destinationCellId) {
  const modal = document.getElementById("promotion-modal");
  const content = document.getElementById("promotion-content");
  // Contenu du modal avec stats random et boutons
  content.innerHTML = `
        <h2>Promotion !</h2>
        <p>Votre pion atteint la dernière rangée. Choisissez la pièce pour la promouvoir :</p>
        <select id="promotion-select">
            <option value="queen">Reine</option>
            <option value="rook">Tour</option>
            <option value="bishop">Fou</option>
            <option value="knight">Cavalier</option>
        </select>
        <div class="modal-buttons" style="margin-top:20px; display:flex; justify-content:center; gap:10px;">
            <button onclick="cancelPromotion()" class="btn-red">Annuler</button>
            <button onclick="promote()" class="btn-green">Continuer</button>
        </div>
    `;

  modal.dataset.origin = originCellId;
  modal.dataset.destination = destinationCellId;

  modal.style.display = "flex";
  // Store origin and destination in modal data attributes
}

function cancelPromotion() {
  const modal = document.getElementById("promotion-modal");
  const content = document.getElementById("promotion-content");
  content.innerHTML = "";
  modal.style.display = "none";
}
function continueGame() {
  // Appelle l'API pour nettoyer la table et relancer
  fetch(`Base/api.php?action=restart&roomId=${myRoomId}&index=${myIndex}`)
    .then((r) => {
      let tmp = r.json();
      return tmp;
    })
    .then((data) => {
      const dt = data.gameState;
      dt.ready.forEach((i) => {
        if (i === myIndex) {
          const continueBtn = document.getElementById("continue-btn");
          continueBtn.innerText = "En attente des autres...";
        }
      });
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
  boardHTML.innerHTML = "";
  boardHTML.appendChild(announcer);

  // Wrapper that will be centered by CSS
  const boardWrapper = document.createElement("div");
  boardWrapper.className = "chess-board";

  let view = "white";
  if (data.players[myIndex] && data.players[myIndex].color === "black") view = "black";

  // const lettersArr = view === "white" ? letters.slice() : letters.slice().reverse();
  const lettersArr = letters.slice();
  const numbersArr = view === "white" ? numbers.slice(0, 8) : numbers.slice(0, 8).slice().reverse();

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

  // Render pieces on the board
  lstPieces = ["pawn", "rook", "knight", "bishop", "queen", "king"];
  data.players.forEach((p) => {
    lstPieces.forEach((pieceName) => {
      p.pieces[pieceName].forEach((piece) => {
        const pieceElement = document.createElement("div");
        pieceElement.className = `piece`;
        pieceElement.textContent = tabDraw[pieceName];
        pieceElement.style.color = p.color === "white" ? "#fff" : "#111";
        pieceElement.style.fontSize = "48px";
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

  data.players.forEach((p) => {
    // Highlight king if in check
    if (checkKingInCheck(p.color)) {
      const kingPos = Object.values(p.pieces["king"])[0].position;
      const kingCell = document.getElementById(`cell-${kingPos}`);
      if (kingCell) {
        kingCell.classList.add("isCheck");
      }
    }
  });

  // Check here if checkmate
  if (isCheckmate(data.players[data.turnIndex]["color"]) && data.status === "playing") {
    fetch(`Base/api.php?action=declareCheckmate&roomId=${myRoomId}&index=${myIndex}`)
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
}

function promote() {
  const modal = document.getElementById("promotion-modal");
  const originCellId = modal.dataset.origin;
  const destinationCellId = modal.dataset.destination;
  const select = document.getElementById("promotion-select");
  const chosenPiece = select.value;
  console.log(
    `Base/api.php?action=promote&roomId=${myRoomId}&index=${myIndex}&origin=${originCellId}&destination=${destinationCellId}&piece=${chosenPiece}`,
  );

  fetch(
    `Base/api.php?action=promote&roomId=${myRoomId}&index=${myIndex}&origin=${originCellId}&destination=${destinationCellId}&piece=${chosenPiece}`,
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
// --- 5. ACTIONS JOUEUR ---

function launchGame() {
  fetch(`Base/api.php?action=startRound&roomId=${myRoomId}`);
}

function playPiece(originCellId, destinationCellId, pieceName) {
  console.log(
    `Base/api.php?action=play&roomId=${myRoomId}&index=${myIndex}&origin=${originCellId}&destination=${destinationCellId}&player=${myName}&pieceName=${pieceName}`,
  );
  fetch(
    `Base/api.php?action=play&roomId=${myRoomId}&index=${myIndex}&origin=${originCellId}&destination=${destinationCellId}&player=${myName}`,
  )
    .then((r) => {
      let tmp = r.json();
      return tmp;
    })
    .catch((e) => {
      console.error("Play piece error:", e);
    });
}

function backToLobby() {
  showConfirm("Retourner au salon ?", () => {
    fetch(`Base/api.php?action=backToLobby&roomId=${myRoomId}`);
  });
}

function abandonGame() {
  showConfirm("Abandonner la partie ?", () => {
    fetch(`Base/api.php?action=abandon&roomId=${myRoomId}&index=${myIndex}`);
  });
}
// --- 6. HELPERS GRAPHIQUES ---

function createCard(c) {
  // Mapping des noms pour l'affichage (Valet->V, etc.)
  const shortRank = {
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "10",
    Valet: "V",
    Dame: "D",
    Roi: "R",
    As: "A",
    2: "2",
  };

  // Détection si c'est une figure (pour le style)
  const isFace = ["Valet", "Dame", "Roi"].includes(c.rank);
  const displayRank = shortRank[c.rank];
  const suitSym = suitSymbols[c.suit];

  let d = document.createElement("div");
  d.className = `card ${isRed(c.suit) ? "red" : "black"} ${isFace ? "face-card" : ""}`;
  d.setAttribute("data-id", c.id);

  // Structure HTML réaliste : Coin Haut-Gauche + Centre + Coin Bas-Droit
  d.innerHTML = `
        <div class="card-corner top-left">
            <span>${displayRank}</span>
            <span>${suitSym}</span>
        </div>
        <div class="card-center">
            ${isFace ? displayRank : suitSym}
        </div>
        <div class="card-corner bottom-right">
            <span>${displayRank}</span>
            <span>${suitSym}</span>
        </div>
    `;

  return d;
}
