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
    const pieceName = cellElement.data["piece"];
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

function computePossibleMoves(pieceName, xpos, ypos, color) {
  const direction = color === "white" ? 1 : -1;
  switch (pieceName) {
    case "pawn":
      if (ypos === 2) {
        for (let i = 3; i <= 4; i++) {
          generateCandidate(`cell-${xpos}-${i}`, pieceName, xpos, ypos);
        }
      } else if (ypos === 7) {
        for (let i = 6; i >= 5; i--) {
          generateCandidate(`cell-${xpos}-${i}`, pieceName, xpos, ypos);
        }
      } else {
        if (ypos + direction >= 1 && ypos + direction <= 8) {
          const nextCellId = `cell-${xpos}-${ypos + direction}`;
          const next = document.getElementById(nextCellId);
          if (next && next.children.length === 0) {
            generateCandidate(
              `cell-${xpos}-${ypos + direction}`,
              pieceName,
              xpos,
              ypos
            );
          }
        }
      }
      // Calculate pawn captures
      const captureOffsets = [-1, 1];
      captureOffsets.forEach((offset) => {
        const targetX = nextLetter(xpos, offset);
        const targetY = ypos + direction;
        const targetCellId = `cell-${targetX}-${targetY}`;
        console.log(`Checking capture at: ${targetCellId}`);
        if (targetX >= "A" && targetX <= "H" && targetY >= 1 && targetY <= 8) {
          console.log(`Target cell for capture: ${targetCellId}`);
          const targetCell = document.getElementById(targetCellId);
          //if (targetCell && targetCell.children.length > 0) {
          const targetPiece = targetCell.data["piece"];
          if (targetPiece && !targetPiece.startsWith(color)) {
            generateCandidate(targetCellId, pieceName, xpos, ypos);
          }
          //}
        }
      });

      break;

    case "rook":
      break;

    case "knight":
      break;

    case "bishop":
      break;

    case "pawn":
      break;

    case "queen":
      break;

    case "king":
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
