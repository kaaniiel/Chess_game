let lastStateStr = "";

const suitSymbols = { Coeur: "♥", Carreau: "♦", Trefle: "♣", Pique: "♠" };
const isRed = (s) => ["Coeur", "Carreau"].includes(s);

// --- 1. INITIALISATION & NAVIGATION ---

window.onload = function () {
  initGame("chess");
  checkSession();
};

// afficher l'un des ecrans (lobby, game, etc.)
function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
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
    fetch(
      `Base/api.php?action=updateSettings&roomId=${myRoomId}&param=${this.value}`
    );
  };

  startPolling();
}

// --- 2. BOUCLE DE JEU (POLLING) ---

function startPolling() {
  //setInterval(() => {
  if (!myRoomId) return;

  fetch(`Base/api.php?action=get&roomId=${myRoomId}`)
    .then((r) => r.json())
    .then((data) => {
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
        document.getElementById("admin-controls").style.display = isAdmin
          ? "block"
          : "none";
        document.getElementById("guest-controls").style.display = isAdmin
          ? "none"
          : "block";
        const sl = document.getElementById("lobby-param-XXXX");
        if (sl) sl.disabled = !isAdmin;
      }

      // Dispatch selon l'état
      if (data.status === "lobby") {
        showScreen("screen-lobby");
        document.getElementById("score-modal").style.display = "none";
        updateLobbyUI(data);
      } else {
        updateGameUI(data);
      }
    })
    .catch((e) => console.error("Polling error:", e));
  //}, 1000);
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
      console.log(tmp);
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
            `
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
  if (scoreSel && document.activeElement !== scoreSel && d.param)
    scoreSel.value = d.param;

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
  if (data.status === "playing") {
    showScreen("screen-game");
    document.getElementById("score-modal").style.display = "none";
    renderGame(data);
  }
  // Si le round est fini, on affiche le jeu (pour voir la dernière carte) ET le modal
  else if (data.status === "round_end") {
    showScreen("screen-game");
    renderGame(data); // Affiche la table complète
    showRoundStats(data.roundStats);
  }
}

function showRoundStats(stats) {
  const modal = document.getElementById("score-modal");
  const content = document.getElementById("score-content");

  if (!stats) return;

  // Contenu du modal avec stats random et boutons
  content.innerHTML = `
        <h2>Fin du pli !</h2>
        <div class="stats-box">
            <p>🏆 Vainqueur du pli : <strong>${stats.winner}</strong></p>
            <p>✨ Points gagnés : <strong>${stats.points}</strong></p>
            <p>💬 <em>"${stats.message}"</em></p>
        </div>
        <div class="modal-buttons" style="margin-top:20px; display:flex; justify-content:center; gap:10px;">
            <button onclick="backToLobby()" class="btn-red">Quitter</button>
            <button onclick="continueGame()" class="btn-green">Continuer</button>
        </div>
    `;

  modal.style.display = "flex";
}

function continueGame() {
  // Appelle l'API pour nettoyer la table et relancer
  fetch(`Base/api.php?action=nextTrick&roomId=${myRoomId}`).then(() => {
    document.getElementById("score-modal").style.display = "none";
  });
}

function renderGame(data) {
  // Sécurité index
  let game = new Chess();
  game.renderBoard();
  /* if (myIndex === null) {
    data.players.forEach((p, i) => {
      if (p.name === myName) myIndex = i;
    });
  }

  const playerCount = data.players.length;

  // A. MA MAIN
  const handDiv = document.getElementById("my-hand");
  handDiv.innerHTML = "";
  if (data.players[myIndex] && data.players[myIndex].hand) {
    data.players[myIndex].hand.forEach((card) => {
      let cDiv = createCard(card);
      cDiv.onclick = () => playCard(card.id);
      handDiv.appendChild(cDiv);
    });
  }

  // B. TABLE (Cartes jouées)
  // Reset des slots
  ["slot-bottom", "slot-left", "slot-top", "slot-right"].forEach((id) => {
    document.getElementById(id).innerHTML = "";
  });

  // Définition des positions visuelles selon le nombre de joueurs
  // Relatif 0 = Moi (Bottom)
  // Relatif 1, 2, 3 dépendent du nombre total
  const slotMap = { 0: "slot-bottom" };

  if (playerCount === 2) {
    slotMap[1] = "slot-top"; // L'adversaire est en face
  } else if (playerCount === 3) {
    slotMap[1] = "slot-left";
    slotMap[2] = "slot-right";
  } else {
    slotMap[1] = "slot-left";
    slotMap[2] = "slot-top";
    slotMap[3] = "slot-right";
  }

  data.table.forEach((play) => {
    // Calcul de l'index relatif (0 à N-1) par rapport à moi
    let relativeIndex =
      (play.playerIndex - myIndex + playerCount) % playerCount;

    let slotId = slotMap[relativeIndex];
    if (slotId) {
      let cDiv = createCard(play.card);
      document.getElementById(slotId).appendChild(cDiv);
    }
  }); */

  // C. STATUT
  let statusText = `Tour de : ${data.players[data.turnIndex].name}`;
  if (data.turnIndex === myIndex) statusText = "🟢 À TOI DE JOUER !";
  document.getElementById("game-announcer").innerText = statusText;
}

// --- 5. ACTIONS JOUEUR ---

function launchGame() {
  fetch(`Base/api.php?action=startRound&roomId=${myRoomId}`);
}

function playCard(cid) {
  fetch(
    `Base/api.php?action=play&roomId=${myRoomId}&index=${myIndex}&cardId=${cid}`
  );
}

function backToLobby() {
  showConfirm("Retourner au salon ? (Cela réinitialisera les scores)", () => {
    fetch(`Base/api.php?action=backToLobby&roomId=${myRoomId}`);
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
  d.className = `card ${isRed(c.suit) ? "red" : "black"} ${
    isFace ? "face-card" : ""
  }`;
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
