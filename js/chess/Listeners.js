/* Cell listener for chess board interactions */
function addCellClickListener(cellElement, color) {
  cellElement.addEventListener("click", () => {
    if (cellElement.children.length > 0) {
      // Check if any child has class "canBeSelected"
      Array.from(cellElement.children).forEach((element) => {
        if (element.className === "canBeSelected") {
          playPiece(
            `cell-${element.data["xpos"]}-${element.data["ypos"]}`,
            cellElement.id,
            element.data["piece"],
          ); // Call the function to move the piece in base.js
          return;
        }
      });
    }

    const allCells = document.getElementsByClassName("chess-cell");
    Array.from(allCells).forEach((cell) => {
      const overlays = cell.getElementsByClassName("canBeSelected");
      Array.from(overlays).forEach((overlay) => overlay.remove());
    });

    if (!cellElement.data || color === null) {
      return;
    }

    const pieceName = cellElement.data["piece"]; // Name
    const xpos = cellElement.data["xpos"]; // letter
    const ypos = cellElement.data["ypos"]; // number

    computePossibleMoves(pieceName, xpos, ypos, color);
  });
}

function addCellHoverListener(cellElement) {
  cellElement.addEventListener("mouseenter", () => {
    // e.g., highlight cell or show possible moves
    cellElement.style.border = "2px solid yellow";
  });

  cellElement.addEventListener("mouseleave", () => {
    cellElement.style.border = "none";
  });
}

function addCellRightClickListener(cellElement) {
  cellElement.addEventListener("contextmenu", (event) => {
    // ajouter la classes hachure
    event.preventDefault();
    if (cellElement.className.includes("hachure")) {
      cellElement.className = cellElement.className.replace(" hachure", "");
      return;
    }
    cellElement.className += " hachure";
  });
}

function generateCandidate(originId, piece, xpos, ypos) {
  const origin = document.getElementById(originId);
  try {
    const candidate = document.createElement("div");
    candidate.className = "canBeSelected";
    candidate.data = {};
    candidate.data["piece"] = piece;
    candidate.data["xpos"] = xpos;
    candidate.data["ypos"] = ypos;
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
      generateCandidate(targetCellId, pieceName, xpos, ypos);
      break;
    }
    generateCandidate(targetCellId, pieceName, xpos, ypos);
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
          generateCandidate(forwardId, pieceName, xpos, ypos);

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
              generateCandidate(doubleId, pieceName, xpos, ypos);
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
            generateCandidate(targetCellId, pieceName, xpos, ypos);
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
            generateCandidate(enPassantId, pieceName, xpos, ypos);
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
            generateCandidate(targetCellId, pieceName, xpos, ypos);
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

      // Castling castling

      // Regarder si le roi a deja bougé
      if (!checkKingInCheck(color)) {
        const king = document.getElementById(`cell-${xpos}-${ypos}`).data;
        if (king["nbMoves"] == 0) {
          const offset = [-1, 1];
          offset.forEach((dir) => {
            for (let x = nextLetter(xpos, dir); x <= "H" || x >= "A"; x = nextLetter(x, dir)) {
              const cellId = `cell-${x}-${ypos}`;
              const cell = document.getElementById(cellId);

              if (cell.data["piece"]) {
                if (cell.data["piece"] === "rook") {
                  const rook = cell.data;
                  if (rook["nbMoves"] == 0) {
                    generateCandidate(
                      `cell-${nextLetter(x, dir * -1)}-${ypos}`,
                      pieceName,
                      xpos,
                      ypos,
                    );
                  }
                  break;
                }
                break;
              }
            }
          });
        }
        // si aucune pieces entre les deux et que ni le roi ni la tour n'ont bougé
        // alors ajouter les cases de Castling comme candidates
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
        const capturedCell = document.getElementById(`cell-${targetX}-${originY}`);
        if (capturedCell && capturedCell.data && capturedCell.data.piece === "pawn") {
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
        const capturedCell = document.getElementById(`cell-${targetX}-${originY}`);
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

function checkKingInCheck(color) {
  // Return true if the king of `color` is currently attacked by any opponent piece.
  const opponent = color === "white" ? "black" : "white";

  // Find king position (constant 8x8 scan)
  let kingX = null;
  let kingY = null;
  outer: for (let xi = "A".charCodeAt(0); xi <= "H".charCodeAt(0); xi++) {
    for (let y = 1; y <= 8; y++) {
      const cell = document.getElementById(`cell-${String.fromCharCode(xi)}-${y}`);
      if (cell && cell.data && cell.data.piece === "king" && cell.data.color === color) {
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
    if (c && c.data && c.data.piece === "pawn" && c.data.color === opponent) return true;
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
    if (c && c.data && c.data.piece === "knight" && c.data.color === opponent) return true;
  }

  // 3) Adjacent enemy king
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = String.fromCharCode(kingX.charCodeAt(0) + dx);
      const ny = kingY + dy;
      const c = getCell(nx, ny);
      if (c && c.data && c.data.piece === "king" && c.data.color === opponent) return true;
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
  // Checkmate: king is in check and the side has no legal moves.
  if (!checkKingInCheck(color)) return false;

  // Helper to fetch a cell element
  function getCell(xChar, y) {
    if (xChar < "A" || xChar > "H" || y < 1 || y > 8) return null;
    return document.getElementById(`cell-${xChar}-${y}`) || null;
  }

  // For each piece of `color`, generate possible moves (they are already filtered
  // by computePossibleMoves to only include moves that don't leave the king in check).
  for (let xi = "A".charCodeAt(0); xi <= "H".charCodeAt(0); xi++) {
    for (let y = 1; y <= 8; y++) {
      const xChar = String.fromCharCode(xi);
      const cell = getCell(xChar, y);
      if (!cell || !cell.data) continue;
      if (cell.data.color !== color) continue;

      // Clear any existing overlays before generating
      clearAllOverlays();

      // Generate moves for this piece
      computePossibleMoves(cell.data.piece, cell.data.xpos, cell.data.ypos, color);

      // If any overlay was created for this origin, then there is at least one legal move
      const originOverlays = cell.getElementsByClassName("canBeSelected");
      if (originOverlays && originOverlays.length > 0) {
        clearAllOverlays();
        return false; // not checkmate: at least one legal move
      }
    }
  }

  // No legal moves found
  clearAllOverlays();
  return true;
}
