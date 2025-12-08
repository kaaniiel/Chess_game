// --- VARIABLES GLOBALES COMMUNES ---
const turnSound = new Audio("../Base/sons/pop.mp3");
turnSound.volume = 0.3;
let isMuted = false;

// Variables de session
let myRoomId = null;
let myName = null;
let myIndex = null;
let isAdmin = false;
let gamePrefix = ""; // 'belote', 'tarot', ou 'president'...

let errorCallback = null;
let confirmCallback = null;

// --- INITIALISATION ---
function initGame(prefix) {
  gamePrefix = prefix;
}

function checkSession() {
  const r = sessionStorage.getItem(`${gamePrefix}_room`);
  const i = sessionStorage.getItem(`${gamePrefix}_index`);
  const n = sessionStorage.getItem(`${gamePrefix}_name`);

  if (r && i !== null && n) {
    myRoomId = r;
    myIndex = parseInt(i);
    myName = n;

    const userField = document.getElementById("username");
    if (userField) userField.value = myName;

    const codeField = document.getElementById("roomCodeInput");
    if (codeField) codeField.value = myRoomId;

    // enterLobby doit être défini dans le fichier spécifique (belote.js, etc.)
    if (typeof enterLobby === "function") {
      enterLobby(myRoomId, false);
    }
  } else {
    // refreshRoomList doit être défini dans le fichier spécifique
    if (typeof refreshRoomList === "function") {
      refreshRoomList();
      setInterval(() => {
        const home = document.getElementById("screen-home");
        if (home && home.classList.contains("active")) {
          refreshRoomList();
        }
      }, 5000);
    }
  }
}

function saveSession(rid, idx, name) {
  myRoomId = rid;
  myIndex = idx;
  myName = name;
  sessionStorage.setItem(`${gamePrefix}_room`, rid);
  sessionStorage.setItem(`${gamePrefix}_index`, idx);
  sessionStorage.setItem(`${gamePrefix}_name`, name);

  const userField = document.getElementById("username");
  if (userField) userField.value = name;
}

// --- ACTIONS DE JEU COMMUNES ---

function createGame() {
  let name = document.getElementById("username").value.trim();
  if (!name) return showError("Veuillez entrer un pseudo !");
  console.log(`Base/api.php?action=create&name=${encodeURIComponent(name)}`);
  fetch(`Base/api.php?action=create&name=${encodeURIComponent(name)}`)
    .then((r) => {
      let tmp = r.json();
      console.log(tmp);
      return tmp;
    })
    .then((d) => {
      if (d.error) return showError(d.error);
      saveSession(d.roomId, 0, name);
      if (typeof enterLobby === "function") enterLobby(d.roomId, true);
    });
}

function joinGame(roomId = null) {
  const btn = document.querySelector('button[onclick^="joinGame"]');
  if (btn) btn.disabled = true;

  let inputName = document.getElementById("username").value.trim();
  const c = roomId
    ? roomId
    : document.getElementById("roomCodeInput").value.trim();

  if (!inputName) {
    if (btn) btn.disabled = false;
    return showError("Veuillez choisir un pseudo !");
  }
  if (!c) {
    if (btn) btn.disabled = false;
    return showError("Code manquant");
  }

  fetch(
    `Base/api.php?action=join&roomId=${c}&name=${encodeURIComponent(inputName)}`
  )
    .then((r) => r.json())
    .then((d) => {
      if (d.error) {
        if (btn) btn.disabled = false;
        return showError(d.error);
      }
      const finalName = d.finalName || inputName;
      saveSession(c, d.index, finalName);
      if (typeof enterLobby === "function") enterLobby(c, false);
    })
    .catch(() => {
      if (btn) btn.disabled = false;
    });
}

function leaveLobby() {
  showConfirm("Quitter la partie ?", function () {
    if (myRoomId && myName) {
      fetch(
        `Base/api.php?action=leave&roomId=${myRoomId}&name=${encodeURIComponent(
          myName
        )}`
      ).finally(() => {
        sessionStorage.clear();
        window.location.reload();
      });
    } else {
      sessionStorage.clear();
      window.location.reload();
    }
  });
}

function launchGame() {
  // Reset spécifique Tarot si besoin (variable globale définie dans tarot.js)
  if (typeof window.hasSeenDog !== "undefined") window.hasSeenDog = false;

  fetch(`Base/api.php?action=startRound&roomId=${myRoomId}`);
}

function cancelGame() {
  showConfirm("Annuler la partie ?", () => {
    fetch(`Base/api.php?action=cancelGame&roomId=${myRoomId}`);
  });
}

// --- GESTION DES ÉCRANS ---
function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

// --- GESTION DES ERREURS (MODAL) ---
function showError(msg, callback = null) {
  const el = document.getElementById("error-message");
  const modal = document.getElementById("error-modal");
  if (el && modal) {
    el.innerText = msg;
    modal.style.display = "flex";
    errorCallback = callback;
  } else {
    alert(msg); // Fallback si le modal n'existe pas
  }
}

function closeError() {
  const modal = document.getElementById("error-modal");
  if (modal) modal.style.display = "none";
  if (errorCallback) {
    errorCallback();
    errorCallback = null;
  }
}

// --- GESTION DES CONFIRMATIONS (MODAL) ---
function showConfirm(msg, onYes) {
  const el = document.getElementById("confirm-message");
  const modal = document.getElementById("confirm-modal");
  if (el && modal) {
    el.innerText = msg;
    modal.style.display = "flex";
    confirmCallback = onYes;
  } else {
    if (confirm(msg)) onYes();
  }
}

function closeConfirm(result) {
  const modal = document.getElementById("confirm-modal");
  if (modal) modal.style.display = "none";
  if (result && confirmCallback) {
    confirmCallback();
  }
  confirmCallback = null; // Reset
}

// --- GESTION DU SON ---
function toggleSound() {
  const btn = document.getElementById("btn-sound-toggle");
  if (!btn) return;

  const icon = btn.querySelector("i");

  isMuted = !isMuted; // On inverse l'état

  if (isMuted) {
    // Mode Muet
    if (icon) icon.className = "fas fa-volume-mute";
    btn.classList.add("sound-off");
  } else {
    // Mode Sonore
    if (icon) icon.className = "fas fa-volume-up";
    btn.classList.remove("sound-off");

    turnSound.play().catch((e) => {});
  }
}
