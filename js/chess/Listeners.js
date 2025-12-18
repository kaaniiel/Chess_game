/* Cell listener for chess board interactions */
function addCellClickListener(cellElement, color) {
  cellElement.addEventListener("click", () => {
    if (cellElement.children.length > 0) {
      // Check if any child has class "canBeSelected"
      Array.from(cellElement.children).forEach((element) => {
        if (element.className === "canBeSelected") {
          console.log(
            `cell selected for move: (${element.data["xpos"]}, ${element.data["ypos"]}) to (${cellElement.id})`
          );
          playPiece(
            `cell-${element.data["xpos"]}-${element.data["ypos"]}`,
            cellElement.id,
            element.data["piece"]
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

    console.log(`Cell clicked: (${cellElement.id})`);
    console.log(`Piece data:`, cellElement.data);
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
            console.log("En Passant possible on", adjacentCellId);
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
                    ypos
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

      break;
    default:
      // tg, il y a un bug
      console.error(`Unknown piece type: ${data.piece.type}`);
      break;
  }
}

function nextLetter(letter, offset) {
  return String.fromCharCode(letter.charCodeAt(0) + offset);
}
