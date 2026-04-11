
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
    fetch(`Chess/api.php?action=updateSettings&roomId=${myRoomId}&param=${this.value}`);
  };

  startPolling();
}

// --- 2. BOUCLE DE JEU (POLLING) ---

function startPolling() {
  setInterval(() => {
    if (!myRoomId) return;
    fetch(`Chess/api.php?action=get&roomId=${myRoomId}`)
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

  fetch("Chess/api.php?action=listRooms")
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


// --- 5. ACTIONS JOUEUR ---

function launchGame() {
  fetch(`Chess/api.php?action=startRound&roomId=${myRoomId}`);
}



function backToLobby() {
  showConfirm("Retourner au salon ?", () => {
    fetch(`Chess/api.php?action=backToLobby&roomId=${myRoomId}`);
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
