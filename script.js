
// ================== GAME CONFIG ==================
const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits = ["♠", "♥", "♦", "♣"];
let deck = [], players = [], currentPlayerIndex = 0;
let gameStarted = false, gameEnded = false, currentPlayer;
let kingHasPeeked = false, bigBrotherHasSwapped = false;
let turnActive = false, consecutivePasses = 0, actionTaken = false, swapInProgress = false;

// DOM elements
const startBtn = document.getElementById("startBtn");
const startTurnBtn = document.getElementById("startTurnBtn");
const endTurnBtn = document.getElementById("endTurnBtn");
const playersArea = document.getElementById("players-area");
const actionArea = document.getElementById("action-area");
const logArea = document.getElementById("log-area");
const deckCount = document.getElementById("deckCount");
const instructionsBtn = document.getElementById("instructionsBtn");
const manualEndGameBtn = document.getElementById("manualEndGameBtn");
const restartBtn = document.getElementById("restartBtn");

// ================== WEBSOCKET SYNC ==================
const socket = new WebSocket('wss://game-server.king-vs-bandits.glitch.me');
let roomId = window.location.hash.substring(1) || Math.random().toString(36).substring(2, 6);
if (!window.location.hash) window.location.hash = roomId;
alert(`Share this link with friends:\n\n${window.location.href}`);

function syncGame() {
  socket.send(JSON.stringify({
    type: "gameState",
    room: roomId,
    players: players,
    currentPlayerIndex: currentPlayerIndex,
    deckCount: deck.length
  }));
}

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.room === roomId) {
    players = data.players;
    currentPlayerIndex = data.currentPlayerIndex;
    renderGame();
  }
};

// ================== GAME FUNCTIONS ==================
// trimmed for space — continue as in prior cell
