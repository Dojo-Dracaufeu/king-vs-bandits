const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const rooms = {};

wss.on('connection', (ws, req) => {
  const params = new URLSearchParams(req.url.split('?')[1]);
  const roomCode = params.get('room');
  const playerId = params.get('player');
  const playerName = decodeURIComponent(params.get('name'));
  
  if (!rooms[roomCode]) {
    rooms[roomCode] = {
      players: [],
      gameState: null,
      roles: ["King", "Guard", "Guard", "Big Bandit", "Small Bandit"]
    };
  }
  
  const room = rooms[roomCode];
  const player = { id: playerId, name: playerName, ws, role: null };
  room.players.push(player);
  
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    handleMessage(room, player, data);
  });
  
  ws.on('close', () => {
    room.players = room.players.filter(p => p.id !== playerId);
  });
  
  // Assign role if game hasn't started
  if (room.players.length <= 5 && !room.gameState) {
    player.role = room.roles[room.players.length - 1];
    ws.send(JSON.stringify({
      type: "roleAssignment",
      role: player.role
    }));
  }
});

function handleMessage(room, player, data) {
  switch (data.type) {
    case "startGame":
      startGame(room);
      break;
      
    case "playerAction":
      handlePlayerAction(room, player, data);
      break;
      
    case "endTurn":
      endTurn(room);
      break;
  }
}

function startGame(room) {
  if (room.players.length !== 5) return;
  
  // Initialize game state
  room.gameState = {
    deck: createDeck(),
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      card: null,
      hasSwapped: false,
      hasDrawn: false
    })),
    currentPlayerIndex: 1, // Start after King
    gameStarted: true,
    gameEnded: false
  };
  
  // Deal cards
  dealCards(room.gameState);
  
  // Notify all players
  broadcast(room, {
    type: "gameState",
    state: room.gameState
  });
}

function handlePlayerAction(room, player, data) {
  // Validate action
  // Update game state
  // Broadcast new state
}

function endTurn(room) {
  // Move to next player
  // Check win conditions
  // Broadcast new state
}

// Helper functions
function createDeck() {
  // Your existing deck creation logic
}

function dealCards(gameState) {
  // Your existing card dealing logic
}

function broadcast(room, message) {
  room.players.forEach(player => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  });
}
