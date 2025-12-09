class Chess {
  #board;
  #letters;
  #numbers;
  #firstColor;
  #secondColor;

  constructor() {
    this.#letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    this.#numbers = [8, 7, 6, 5, 4, 3, 2, 1, " "];
    this.#firstColor = "rgba(255, 255, 255, 1)";
    this.#secondColor = "rgba(147, 96, 8, 1)";

    // create the board after fields are initialized
    this.#board = this.createBoard();
  }

  createBoard() {
    // Initialize an 8x8 chess board with pieces in starting positions
    const board = {
      white: [],
      black: [],
    };
    const pieceOrder = [
      "rook",
      "knight",
      "bishop",
      "queen",
      "king",
      "bishop",
      "knight",
      "rook",
    ];

    // Populate white pieces (rank 1) and white pawns (rank 2)
    this.#letters.forEach((letter, i) => {
      board.white.push(
        new Piece(pieceOrder[i], "white", letter, 1),
        new Piece("pawn", "white", letter, 2)
      );
    });

    // Populate black pieces (rank 8) and black pawns (rank 7)
    this.#letters.forEach((letter, i) => {
      board.black.push(
        new Piece(pieceOrder[i], "black", letter, 8),
        new Piece("pawn", "black", letter, 7)
      );
    });

    // Setup pieces here (e.g., pawns, rooks, knights, bishops, queen, king)
    return board;
  }

  renderBoard() {
    // Render the chess board in the UI
    const boardHTML = document.getElementById("game-container");

    // Clear previous board
    boardHTML.innerHTML = "";

    // Wrapper that will be centered by CSS
    const boardWrapper = document.createElement("div");
    boardWrapper.className = "chess-board";

    let indexNumber = 0;
    for (let row = 8; row > 0; row--) {
      const rowDiv = document.createElement("div");
      rowDiv.className = "chess-row";

      const leftNumberDiv = document.createElement("div");
      leftNumberDiv.className = "chess-number";
      leftNumberDiv.innerText = this.#numbers[indexNumber];
      rowDiv.appendChild(leftNumberDiv);

      this.#letters.forEach((letter, col) => {
        const cell = document.createElement("div");
        cell.className = "chess-cell";
        cell.id = `cell-${letter}-${row}`;
        // Background color handled by CSS but we keep color logic here
        if (row % 2 == 0) {
          cell.style.backgroundColor =
            col % 2 == 0 ? this.#firstColor : this.#secondColor;
        } else {
          cell.style.backgroundColor =
            col % 2 == 0 ? this.#secondColor : this.#firstColor;
        }

        addCellClickListener(cell);
        addCellHoverListener(cell);
        rowDiv.appendChild(cell);
      });
      indexNumber++;

      boardWrapper.appendChild(rowDiv);
    }
    const bottomRow = document.createElement("div");
    bottomRow.className = "chess-row";

    this.#letters.forEach((element) => {
      const letterDiv = document.createElement("div");
      letterDiv.className = "chess-letter";
      letterDiv.innerText = element;
      bottomRow.appendChild(letterDiv);
    });

    boardWrapper.appendChild(bottomRow);

    boardHTML.appendChild(boardWrapper);

    // Render pieces on the board
    this.#board.white.forEach((piece) => {
      const cell = document.getElementById(
        `cell-${piece.position[0]}-${piece.position[1]}`
      );
      piece.render(cell);
    });
    this.#board.black.forEach((piece) => {
      const cell = document.getElementById(
        `cell-${piece.position[0]}-${piece.position[1]}`
      );
      piece.render(cell);
    });
  }
}

class Piece {
  constructor(type, color, letter, x) {
    this.type = type;
    this.color = color;
    this.letter = letter;
    this.x = x;
    this.position = [letter, x];
    this.tabDraw = {
      pawn: "♟",
      rook: "♜",
      knight: "♞",
      bishop: "♝",
      queen: "♛",
      king: "♚",
    };
  }

  render(cell) {
    // Return HTML representation of the piece
    const pieceElement = document.createElement("div");
    pieceElement.className = `piece`;
    pieceElement.textContent = this.tabDraw[this.type];
    pieceElement.style.color = this.color === "white" ? "#fff" : "#111";
    pieceElement.style.fontSize = "48px";
    pieceElement.style.textShadow =
      this.color === "white"
        ? "0 2px 10px rgba(0, 0, 0, 0.8)"
        : "0 1px 0 rgba(255, 255, 255, 0.05)";

    cell.appendChild(pieceElement);
    cell.data = this;
  }

  getPossibleMoves(board, position) {
    // Return possible moves for this piece based on its type and current position
    return [];
  }
}
