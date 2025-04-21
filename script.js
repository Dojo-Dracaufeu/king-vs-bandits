// ================== ORIGINAL GAME CODE (KEEP THIS) ==================
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

// ================== NEW MULTIPLAYER CODE ==================
// 1. Connect to free WebSocket server (pre-configured for China)
const socket = new WebSocket('wss://game-server.king-vs-bandits.glitch.me');

// 2. Create/share room ID
let roomId = window.location.hash.substring(1) || Math.random().toString(36).substring(2, 6);
if (!window.location.hash) window.location.hash = roomId;

// 3. Show join link to players
alert(`Share this link with friends:\n\n${window.location.href}`);

// 4. Sync game state across devices
function syncGame() {
  socket.send(JSON.stringify({
    type: "gameState",
    room: roomId,
    players: players,
    currentPlayerIndex: currentPlayerIndex,
    deckCount: deck.length
  }));
}

// 5. Receive updates from other players
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.room === roomId) {
    players = data.players;
    currentPlayerIndex = data.currentPlayerIndex;
    renderGame();
  }
};

// ================== ORIGINAL FUNCTIONS (MODIFIED TO SYNC) ==================
function startGame() {
  // ... (keep all original code until the end) ...
  renderGame();
  updateTurnIndicator();
  syncGame(); // ← ADD THIS LINE
}

function startPlayerTurn() {
  // ... (original code) ...
  syncGame(); // ← ADD THIS LINE
}

function endPlayerTurn() {
  // ... (original code) ...
  syncGame(); // ← ADD THIS LINE
}

// ... (keep ALL other original functions EXACTLY as they were) ...

// ================== INITIALIZE ==================
startBtn.addEventListener("click", startGame);
startTurnBtn.addEventListener("click", startPlayerTurn);
endTurnBtn.addEventListener("click", endPlayerTurn);
instructionsBtn.addEventListener("click", showInstructions);
manualEndGameBtn.addEventListener("click", () => endGame("Game manually ended"));
restartBtn.addEventListener("click", () => location.reload());