let lastStateStr = "";
let lastUpdateTime = 0;
const CHESS_TAGS = {
  EN_PASSANT: "en_passant",
  CASTLING: "castling",
  PROMOTION: "promotion",
  CHECK: "check",
  CHECKMATE: "checkmate",
  MOVE: "move",
  TAKE_PIECE: "take_piece",
};

function updateGameUI(data) {
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
  // console.log("Round stats:", data.roundStats);
  const winnerName = data.players[data.roundStats.winnerIndex].name;
  // console.log("Round winner:", winnerName);

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
    fetch(`Chess/api.php?action=startRound&roomId=${myRoomId}`).then(() => {
      lastUpdateTime = 0; // Forcer la mise à jour
      modal.style.display = "none";
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
  fetch(`Chess/api.php?action=restart&roomId=${myRoomId}&index=${myIndex}`)
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

  // Wrapper that will be centered by CSS
  const boardWrapper = document.createElement("div");
  boardWrapper.className = "chess-board";

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
  if (
    isCheckmate(data.players[data.turnIndex]["color"]) &&
    data.status === "playing"
  ) {
    fetch(
      `Chess/api.php?action=declareCheckmate&roomId=${myRoomId}&index=${myIndex}`,
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

  renderHistory(data);
}

function renderHistory(data) {
  const historyContainer = document.getElementById("game-history");
  if (!historyContainer) return;

  const history = Array.isArray(data.history) ? data.history : [];
  if (history.length === 0) {
    historyContainer.innerHTML = '<p class="history-empty">Aucun coup pour le moment.</p>';
    return;
  }
  console.log("Game history:", history);

  historyContainer.innerHTML = history
    .slice()
    .reverse()
    .map((entry, idx) => `<p class="history-item">${history.length - idx}. ${entry.playerIndex === myIndex ? 'Toi' : data.players[entry.playerIndex].name}: ${entry.pieceName} from ${entry.origin} to ${entry.destination}</p>`)
    .join("");
}

function promote() {

  const modal = document.getElementById("promotion-modal");
  const originCellId = modal.dataset.origin;
  const destinationCellId = modal.dataset.destination;
  const select = document.getElementById("promotion-select");
  const chosenPiece = select.value;
  console.log(
    `Chess/api.php?action=promote&roomId=${myRoomId}&index=${myIndex}&origin=${originCellId}&destination=${destinationCellId}&piece=${chosenPiece}`,
  ); 

  fetch(
    `Chess/api.php?action=promote&roomId=${myRoomId}&index=${myIndex}&origin=${originCellId}&destination=${destinationCellId}&piece=${chosenPiece}`,
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
    `Chess/api.php?action=play&roomId=${myRoomId}&index=${myIndex}&origin=${originCellId}&destination=${destinationCellId}&player=${myName}&pieceName=${pieceName}&tag=${tag}`,
  );
  fetch(
    `Chess/api.php?action=play&roomId=${myRoomId}&index=${myIndex}&origin=${originCellId}&destination=${destinationCellId}&player=${myName}&pieceName=${pieceName}&tag=${tag}`,
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
    fetch(`Chess/api.php?action=abandon&roomId=${myRoomId}&index=${myIndex}`);
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
            generateCandidate(
              targetCellId,
              pieceName,
              xpos,
              ypos,
              (tag = CHESS_TAGS.TAKE_PIECE),
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
