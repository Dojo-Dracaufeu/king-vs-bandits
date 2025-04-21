// Game configuration
// Replace your WebSocket URL with:
const socket = new WebSocket('wss://ws.postman-echo.com/raw');

// ADD THESE LINES:
console.log("Attempting WebSocket connection...");
socket.onopen = () => console.log("WebSocket connected!");
socket.onerror = (e) => console.error("WebSocket error:", e);
socket.onclose = () => console.log("WebSocket disconnected");

const WS_SERVER = "wss://your-websocket-server.com"; // Replace with your server
const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits = ["♠", "♥", "♦", "♣"];

// Game state
let socket, playerId, roomCode, currentPlayer, playerRole;
let deck = [], players = [], currentPlayerIndex = 0;
let gameStarted = false, gameEnded = false, turnActive = false;

// DOM elements
const loginScreen = document.getElementById("login-screen");
const gameContainer = document.getElementById("game-container");
const playerNameInput = document.getElementById("playerName");
const roomCodeInput = document.getElementById("roomCode");
const joinBtn = document.getElementById("joinBtn");
const yourRoleSpan = document.getElementById("your-role");

// Initialize
joinBtn.addEventListener("click", joinGame);

async function joinGame() {
  const name = playerNameInput.value.trim();
  if (!name) return alert("Please enter your name");
  
  roomCode = roomCodeInput.value.trim() || generateRoomCode();
  playerId = generateId();
  
  // Connect to WebSocket
  socket = new WebSocket(`${WS_SERVER}?room=${roomCode}&player=${playerId}&name=${encodeURIComponent(name)}`);
  
  socket.onopen = () => {
    loginScreen.style.display = "none";
    gameContainer.style.display = "flex";
    addToLog(`Connected to room: ${roomCode}`, "system");
  };
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleMessage(data);
  };
}

function handleMessage(data) {
  switch (data.type) {
    case "roleAssignment":
      playerRole = data.role;
      yourRoleSpan.textContent = playerRole;
      addToLog(`You are the ${playerRole}`, "system");
      break;
      
    case "gameState":
      updateGameState(data.state);
      break;
      
    case "startTurn":
      startPlayerTurn();
      break;
      
    case "actionResult":
      handleActionResult(data);
      break;
      
    case "gameEnd":
      endGame(data.message);
      break;
      
    case "log":
      addToLog(data.message, data.logType || "system");
      break;
  }
}

function updateGameState(state) {
  deck = state.deck;
  players = state.players;
  currentPlayerIndex = state.currentPlayerIndex;
  gameStarted = state.gameStarted;
  gameEnded = state.gameEnded;
  
  updateDeckCount();
  renderGame();
  updateTurnIndicator();
}

function startGame() {
  socket.send(JSON.stringify({
    type: "startGame",
    room: roomCode
  }));
}

function startPlayerTurn() {
  if (players[currentPlayerIndex].id !== playerId) return;
  
  turnActive = true;
  actionArea.style.display = "block";
  startTurnBtn.disabled = true;
  endTurnBtn.disabled = false;
  
  showTurnActions();
}

function endPlayerTurn() {
  socket.send(JSON.stringify({
    type: "endTurn",
    room: roomCode,
    playerId: playerId
  }));
}

function performAction(action, target) {
  socket.send(JSON.stringify({
    type: "playerAction",
    room: roomCode,
    playerId: playerId,
    action: action,
    target: target
  }));
}

// Helper functions
function generateRoomCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function generateId() {
  return 'xxxx-xxxx-xxxx'.replace(/[x]/g, () => 
    (Math.random() * 16 | 0).toString(16));
}

// Your existing rendering and game logic functions (renderGame, addToLog, etc.)
// Keep all the same but replace direct state modifications with performAction() calls
