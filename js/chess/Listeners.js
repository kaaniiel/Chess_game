/* Cell listener for chess board interactions */
function addCellClickListener(cellElement, color) {
  cellElement.addEventListener("click", () => {
    console.log(cellElement.data);
    if (cellElement.children.length > 0) {
      // Check if any child has class "canBeSelected"
      Array.from(cellElement.children).forEach((element) => {
        if (element.className === "canBeSelected") {
          playPiece(
            `cell-${element.data["xpos"]}-${element.data["ypos"]}`,
            cellElement.id,
            element.data["piece"],
            element.data["tag"],

          ); // Call the function to move the piece in chess.js
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


