/* Cell listener for chess board interactions */

function addCellClickListener(cellElement) {
  cellElement.addEventListener("click", () => {
    console.log(`Cell clicked: (${cellElement.id})`);
    if (cellElement.data) {
      console.log("test =", cellElement.data);
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
