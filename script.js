// Game state with K as highest (12) and A as lowest (0)
const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits = ["♠", "♥", "♦", "♣"];
let deck = [];
let players = [];
let currentPlayerIndex = 0;
let gameStarted = false;
let gameEnded = false;
let currentPlayer;
let kingHasPeeked = false;
let bigBrotherHasSwapped = false;
let turnActive = false;
let consecutivePasses = 0;
let actionTaken = false;
let swapInProgress = false;

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

// Initialize game
startBtn.addEventListener("click", startGame);
startTurnBtn.addEventListener("click", startPlayerTurn);
endTurnBtn.addEventListener("click", () => {
  if (!actionTaken) {
    currentPlayer.passed = true;
    currentPlayer.hasTakenAction = true;
    addToLog(currentPlayer.name + " passed", "action");
  }
  endPlayerTurn();
});

instructionsBtn.addEventListener("click", showInstructions);
manualEndGameBtn.addEventListener("click", () => {
  endGame("Game manually ended by user.");
});
restartBtn.addEventListener("click", () => {
  location.reload();
});

function startGame() {
  // Reset game state
  gameStarted = true;
  gameEnded = false;
  kingHasPeeked = false;
  bigBrotherHasSwapped = false;
  consecutivePasses = 0;
  startBtn.disabled = true;
  manualEndGameBtn.disabled = false;
  restartBtn.disabled = false;
  logArea.innerHTML = "";
  startTurnBtn.disabled = false;
  endTurnBtn.disabled = true;
  actionArea.style.display = "none";
  
  // Create and shuffle deck
  deck = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < 4; j++) {
      const isRed = j === 1 || j === 2;
      deck.push({ 
        value: values[i], 
        numericValue: i,
        suit: suits[j],
        isRed: isRed
      });
    }
  }
  deck = deck.concat(deck, deck).slice(0, 52);
  deck = shuffleArray(deck);
  
  // Assign roles
  const roles = [
    { name: "King", team: "good", isKing: true },
    { name: "Guard", team: "good" },
    { name: "Guard", team: "good" },
    { name: "Big Bandit", team: "evil", isBigBandit: true },
    { name: "Small Bandit", team: "evil" }
  ];
  
  players = shuffleArray(roles).map((role, index) => ({
    id: index + 1,
    name: `Player ${index + 1}`,
    role: role.name,
    team: role.team,
    isKing: role.isKing || false,
    isBigBandit: role.isBigBandit || false,
    card: deck.pop(),
    hasSwapped: false,
    hasDrawn: false,
    passed: false,
    isRevealed: false,
    cardVisible: false,
    hasTakenAction: false
  }));
  
  // Reveal King's identity
  const king = players.find(p => p.isKing);
  king.isRevealed = true;
  
  // Start with player after King
  const kingIndex = players.indexOf(king);
  currentPlayerIndex = (kingIndex + 1) % 5;
  
  updateDeckCount();
  addToLog("Game started! The King is " + king.name, "system");
  renderGame();
  updateTurnIndicator();
}

function startPlayerTurn() {
  turnActive = true;
  actionTaken = false;
  swapInProgress = false;
  currentPlayer = players[currentPlayerIndex];
  
  // Reset passed status for new turn
  currentPlayer.passed = false;
  
  // Reveal current player's identity to themselves
  currentPlayer.isRevealed = true;
  currentPlayer.cardVisible = true;
  
  startTurnBtn.disabled = true;
  endTurnBtn.disabled = false;
  
  addToLog(currentPlayer.name + "'s turn", "system");
  renderGame();
  
  showTurnActions();
}

function endPlayerTurn() {
  turnActive = false;
  swapInProgress = false;
  
  // Hide current player's identity and card (except King's identity)
  if (!currentPlayer.isKing) {
    currentPlayer.isRevealed = false;
  }
  currentPlayer.cardVisible = false;
  
  startTurnBtn.disabled = true;
  endTurnBtn.disabled = true;
  actionArea.style.display = "none";
  actionArea.innerHTML = "";
  
  // Track consecutive passes
  if (currentPlayer.passed) {
    consecutivePasses++;
  } else {
    consecutivePasses = 0; // Reset if someone took an action
  }
  
  // Check if King was last to pass/act
  const king = players.find(p => p.isKing);
  const kingIndex = players.indexOf(king);
  const lastPlayerIndex = (currentPlayerIndex - 1 + 5) % 5;
  
  // Second win condition: All passed consecutively ending with King
  if (consecutivePasses >= 5 && lastPlayerIndex === kingIndex) {
    endGame("Game ended - all players passed consecutively ending with King");
    return;
  }
  
  // Check if all players have acted this round
  const allDone = players.every(p => p.passed || p.hasTakenAction);
  
  if (allDone) {
    // Reset for new round
    players.forEach(p => {
      p.passed = false;
      p.hasTakenAction = false;
    });
    consecutivePasses = 0;
  }
  
  // Check if all actions are used
  if (checkGameEnd()) {
    return;
  }
  
  // Move to next player
  currentPlayerIndex = (currentPlayerIndex + 1) % 5;
  
  renderGame();
  updateTurnIndicator();
  
  // Enable Start Turn for next player
  startTurnBtn.disabled = false;
}

function checkGameEnd() {
  const allActionsUsed = players.every(p => 
    (p.hasSwapped && p.hasDrawn) && 
    (!p.isKing || kingHasPeeked) &&
    (!p.isBigBandit || bigBrotherHasSwapped)
  );
  
  if (allActionsUsed) {
    endGame("Game ended - all actions have been used");
    return true;
  }
  
  return false;
}

function showTurnActions() {
  actionArea.style.display = "block";
  actionArea.innerHTML = "<p style='color:white; text-align:center; margin-bottom:8px;'>Choose an action:</p>";
  
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "action-buttons";
  
  // Pass button
  const passBtn = document.createElement("button");
  passBtn.textContent = "Pass";
  passBtn.addEventListener("click", () => {
    if (!actionTaken) {
      actionTaken = true;
      currentPlayer.passed = true;
      currentPlayer.hasTakenAction = true;
      addToLog(currentPlayer.name + " passed", "action");
      disableAllActions();
      endPlayerTurn();
    }
  });
  buttonsContainer.appendChild(passBtn);
  
  // Swap button if not used this game
  if (!currentPlayer.hasSwapped) {
    const swapBtn = document.createElement("button");
    swapBtn.textContent = "Swap with player";
    swapBtn.addEventListener("click", () => {
      if (!actionTaken) {
        actionTaken = true;
        currentPlayer.hasTakenAction = true;
        showPlayerSelection("swap");
      }
    });
    buttonsContainer.appendChild(swapBtn);
  }
  
  // Draw button if not used this game
  if (!currentPlayer.hasDrawn) {
    const drawBtn = document.createElement("button");
    drawBtn.textContent = "Draw new card";
    drawBtn.addEventListener("click", () => {
      if (!actionTaken) {
        actionTaken = true;
        currentPlayer.hasTakenAction = true;
        currentPlayer.card = deck.pop();
        currentPlayer.hasDrawn = true;
        updateDeckCount();
        addToLog(currentPlayer.name + " drew a new card", "action");
        renderGame();
        disableAllActions();
      }
    });
    buttonsContainer.appendChild(drawBtn);
  }
  
  // King's peek ability
  if (currentPlayer.isKing && !kingHasPeeked) {
    const peekBtn = document.createElement("button");
    peekBtn.textContent = "Peek at player";
    peekBtn.addEventListener("click", () => {
      if (!actionTaken) {
        actionTaken = true;
        currentPlayer.hasTakenAction = true;
        kingHasPeeked = true;
        showPlayerSelection("peek");
      }
    });
    buttonsContainer.appendChild(peekBtn);
  }
  
  // Big Bandit's swap ability
  if (currentPlayer.isBigBandit && !bigBrotherHasSwapped) {
    const swapBtn = document.createElement("button");
    swapBtn.textContent = "Swap two players";
    swapBtn.addEventListener("click", () => {
      if (!actionTaken) {
        actionTaken = true;
        currentPlayer.hasTakenAction = true;
        bigBrotherHasSwapped = true;
        showDoublePlayerSelection();
      }
    });
    buttonsContainer.appendChild(swapBtn);
  }
  
  actionArea.appendChild(buttonsContainer);
}

function disableAllActions() {
  const buttons = actionArea.querySelectorAll("button");
  buttons.forEach(btn => {
    btn.disabled = true;
  });
}

function updateTurnIndicator() {
  const playerElements = playersArea.querySelectorAll(".player");
  
  playerElements.forEach((el, index) => {
    el.classList.remove("current");
    if (index === currentPlayerIndex) {
      el.classList.add("current");
    }
  });
}

function showPlayerSelection(action) {
  actionArea.innerHTML = "<p style='color:white; text-align:center; margin-bottom:8px;'>Select a player:</p>";
  
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "action-buttons";
  
  players.forEach(player => {
    if (player.id !== currentPlayer.id) {
      const btn = document.createElement("button");
      btn.textContent = player.name;
      btn.className = "player-btn";
      btn.addEventListener("click", () => {
        if (action === "swap") {
          // Swap cards
          const temp = currentPlayer.card;
          currentPlayer.card = player.card;
          player.card = temp;
          currentPlayer.hasSwapped = true;
          addToLog(`${currentPlayer.name} swapped cards with ${player.name}`, "action");
        } else if (action === "peek") {
          // Peek at card (only show to King, not in log)
          showPeekNotification(player);
          return;
        }
        renderGame();
        disableAllActions();
      });
      buttonsContainer.appendChild(btn);
    }
  });
  
  actionArea.appendChild(buttonsContainer);
}

function showPeekNotification(player) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  
  const notification = document.createElement("div");
  notification.className = "peek-notification";
  notification.innerHTML = `
    <h3>Peek Result</h3>
    <div class="card-container" style="transform: rotateY(180deg); margin:15px auto;">
      <div class="card-face card-front ${player.card.isRed ? 'red' : ''}">
        <div class="card-corner top-left">${player.card.value}${player.card.suit}</div>
        <div class="card-value">${player.card.value}</div>
        <div class="card-suit">${player.card.suit}</div>
        <div class="card-corner bottom-right">${player.card.value}${player.card.suit}</div>
      </div>
    </div>
    <p>${player.name}'s card is: <strong>${player.card.value}</strong></p>
    <button id="closePeek">OK</button>
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(notification);
  
  document.getElementById("closePeek").addEventListener("click", () => {
    document.body.removeChild(overlay);
    document.body.removeChild(notification);
    addToLog(`${currentPlayer.name} peeked at ${player.name}'s card`, "special");
    renderGame();
    disableAllActions();
  });
}

function showDoublePlayerSelection() {
  actionArea.innerHTML = "<p style='color:white; text-align:center; margin-bottom:8px;'>Select two players to swap:</p>";
  
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "action-buttons";
  
  const selectedPlayers = [];
  const playerButtons = [];
  
  // Big Bandit can swap any two players (including King)
  players.forEach(player => {
    const btn = document.createElement("button");
    btn.textContent = player.name;
    btn.className = "player-btn";
    btn.addEventListener("click", () => {
      if (selectedPlayers.includes(player.id)) {
        // Deselect
        const index = selectedPlayers.indexOf(player.id);
        selectedPlayers.splice(index, 1);
        btn.style.backgroundColor = "";
      } else if (selectedPlayers.length < 2) {
        // Select
        selectedPlayers.push(player.id);
        btn.style.backgroundColor = "#3498db";
      }
      
      if (selectedPlayers.length === 2) {
        // Perform swap
        const player1 = players.find(p => p.id === selectedPlayers[0]);
        const player2 = players.find(p => p.id === selectedPlayers[1]);
        
        const temp = player1.card;
        player1.card = player2.card;
        player2.card = temp;
        
        addToLog(`${currentPlayer.name} swapped ${player1.name}'s and ${player2.name}'s cards`, "action");
        renderGame();
        disableAllActions();
      }
    });
    buttonsContainer.appendChild(btn);
    playerButtons.push(btn);
  });
  
  actionArea.appendChild(buttonsContainer);
}

function renderGame() {
  playersArea.innerHTML = "";
  
  players.forEach(player => {
    const playerEl = document.createElement("div");
    playerEl.className = `player ${player.isKing ? "king" : ""}`;
    if (player.id === currentPlayer?.id) {
      playerEl.classList.add("current");
    }
    
    const nameEl = document.createElement("div");
    nameEl.className = "player-name";
    nameEl.textContent = player.name;
    playerEl.appendChild(nameEl);
    
    const roleEl = document.createElement("div");
    roleEl.className = "player-role";
    roleEl.textContent = player.isRevealed ? player.role : "?";
    playerEl.appendChild(roleEl);
    
    const cardContainer = document.createElement("div");
    cardContainer.className = "card-container";
    cardContainer.style.transform = player.cardVisible ? "rotateY(180deg)" : "";
    
    const cardFront = document.createElement("div");
    cardFront.className = `card-face card-front ${player.card.isRed ? 'red' : ''}`;
    
    const cardCornerTL = document.createElement("div");
    cardCornerTL.className = "card-corner top-left";
    cardCornerTL.textContent = `${player.card.value}${player.card.suit}`;
    cardFront.appendChild(cardCornerTL);
    
    const cardValue = document.createElement("div");
    cardValue.className = "card-value";
    cardValue.textContent = player.card.value;
    cardFront.appendChild(cardValue);
    
    const cardSuit = document.createElement("div");
    cardSuit.className = "card-suit";
    cardSuit.textContent = player.card.suit;
    cardFront.appendChild(cardSuit);
    
    const cardCornerBR = document.createElement("div");
    cardCornerBR.className = "card-corner bottom-right";
    cardCornerBR.textContent = `${player.card.value}${player.card.suit}`;
    cardFront.appendChild(cardCornerBR);
    
    const cardBack = document.createElement("div");
    cardBack.className = "card-face card-back";
    
    cardContainer.appendChild(cardFront);
    cardContainer.appendChild(cardBack);
    playerEl.appendChild(cardContainer);
    
    playersArea.appendChild(playerEl);
  });
}

function addToLog(message, type = "system") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.textContent = message;
  logArea.appendChild(entry);
  logArea.scrollTop = logArea.scrollHeight;
}

function updateDeckCount() {
  deckCount.textContent = `Deck: ${deck.length}`;
}

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function endGame(message) {
  gameEnded = true;
  addToLog(message, "system");
  
  // Reveal all players and cards at game end
  players.forEach(player => {
    player.isRevealed = true;
    player.cardVisible = true;
  });
  renderGame();
  
  // Determine winner by comparing only King vs Bandits
  const king = players.find(p => p.isKing);
  const bandits = players.filter(p => p.team === "evil");
  
  let kingWins = true;
  for (const bandit of bandits) {
    if (bandit.card.numericValue >= king.card.numericValue) {
      kingWins = false;
      break;
    }
  }
  
  if (kingWins) {
    addToLog(`The King has ${king.card.value} and all Bandits have lower cards! Good team wins!`, "special");
  } else {
    addToLog(`At least one Bandit has a card equal or higher than the King's ${king.card.value}! Evil team wins!`, "special");
  }
  
  startBtn.disabled = false;
  startTurnBtn.disabled = true;
  endTurnBtn.disabled = true;
}

function showInstructions() {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  
  const panel = document.createElement("div");
  panel.className = "instructions-panel";
  panel.innerHTML = `
    <h3>How to Play King vs Bandits</h3>
    <p><strong>Objective:</strong> The King and Guards (good team) try to end with the King having a higher card than all Bandits (K is highest, A is lowest). Bandits (evil team) try to prevent this.</p>
    <p><strong>Gameplay:</strong> Players take turns performing actions. The King is revealed at the start.</p>
    <p><strong>Actions:</strong>
    <ul style="margin-left:20px; margin-top:5px;">
      <li><strong>Pass:</strong> End your turn without acting</li>
      <li><strong>Swap:</strong> Trade cards with another player</li>
      <li><strong>Draw:</strong> Replace your card with a new one</li>
    </ul>
    </p>
    <p><strong>Special Abilities:</strong>
    <ul style="margin-left:20px; margin-top:5px;">
      <li><strong>King:</strong> Can peek at another player's card</li>
      <li><strong>Big Bandit:</strong> Can swap any two players' cards</li>
    </ul>
    </p>
    <p><strong>Winning:</strong> At game end, only the King's card is compared against Bandits' cards. Guards' cards don't matter.</p>
    <button id="closeInstructions">Got It!</button>
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  
  document.getElementById("closeInstructions").addEventListener("click", () => {
    document.body.removeChild(overlay);
    document.body.removeChild(panel);
  });
}
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
