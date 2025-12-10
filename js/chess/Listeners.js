/* Cell listener for chess board interactions */

function addCellClickListener(cellElement, color) {
  cellElement.addEventListener("click", () => {
    const allCells = document.getElementsByClassName("chess-cell");
    Array.from(allCells).forEach((cell) => {
      const overlays = cell.getElementsByClassName("canBeSelected");
      Array.from(overlays).forEach((overlay) => overlay.remove());
    });

    if (!cellElement.data || color === null) {
      return;
    }

    console.log(`Cell clicked: (${cellElement.id})`);
    console.log(cellElement.data);
    const piece = cellElement.data["piece"];
    const xpos = cellElement.data["xpos"]; // letter
    const ypos = cellElement.data["ypos"]; // number

    switch (piece.type) {
      case "pawn":
        if (ypos === 2) {
          console.log("Pawn at starting position, can move 2 squares");
          for (let i = 3; i <= 4; i++) {
            const targetCell = document.getElementById(`cell-${xpos}-${i}`);
            const div = document.createElement("div");
            div.className = "canBeSelected";
            targetCell.appendChild(div);
          }
        } else if (ypos === 7) {
          console.log("Pawn at starting position, can move 2 squares");
          for (let i = 6; i >= 5; i--) {
            const targetCell = document.getElementById(`cell-${xpos}-${i}`);
            const div = document.createElement("div");
            div.className = "canBeSelected";
            targetCell.appendChild(div);
          }
        }
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
