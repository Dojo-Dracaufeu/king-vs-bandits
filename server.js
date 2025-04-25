const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 1988;

// Add CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Updated WebSocket server configuration with path
const wss = new WebSocket.Server({ 
  server,
  path: "/ws" // Add specific WebSocket path
});

const rooms = {};
const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits = ["♠", "♥", "♦", "♣"];

function initializeDeck() {
  const deck = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < 4; j++) {
      deck.push({
        value: values[i],
        numericValue: i+1,
        suit: suits[j],
        isRed: j === 1 || j === 2
      });
    }
  }
  return [...deck, ...deck, ...deck].slice(0, 52);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createRoom(roomId) {
  rooms[roomId] = {
    id: roomId,
    players: [],
    deck: [],
    currentPlayerIndex: 0,
    gameStarted: false,
    roles: ['King', 'Guard', 'Guard', 'Big Bandit', 'Small Bandit'],
    currentCycle: [],
    cycleComplete: false,
    passesThisCycle: 0,
    gameStartedBy: null
  };
  return rooms[roomId];
}

// Modified WebSocket connection handler with origin validation
wss.on('connection', (ws, req) => {
  const origin = req.headers.origin;
  
  // Allow connections from your Glitch domain and local development
  if (origin && !origin.includes("glitch.me") && !origin.includes("localhost")) {
    console.log(`Rejected connection from origin: ${origin}`);
    return ws.close();
  }

  const playerId = Math.random().toString(36).substr(2, 9);
  
  ws.send(JSON.stringify({
    type: 'CONNECTION_ESTABLISHED',
    playerId
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.action) {
        case 'CREATE_OR_JOIN_ROOM':
          handleRoomJoin(ws, playerId, data);
          break;
        case 'START_GAME':
          handleStartGame(ws, data.roomId);
          break;
        case 'PLAYER_ACTION':
          handlePlayerAction(data);
          break;
        case 'GET_PLAYERS':
          handleGetPlayers(ws, data.roomId);
          break;
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        broadcastRoomState(roomId);
        
        if (room.players.length === 0) {
          delete rooms[roomId];
        }
        break;
      }
    }
  });
});

// ... [Keep all your existing functions exactly as they are below this point]
// This includes:
// - handleRoomJoin()
// - handleStartGame()
// - handlePlayerAction()
// - allActionsUsed()
// - handleSpecialSwapAction()
// - handleSwapAction()
// - handleDrawAction()
// - handlePeekAction()
// - handlePassAction()
// - advanceTurn()
// - endGame()
// - resetGameState()
// - broadcastRoomState()
// - broadcastToRoom()
// - broadcastLog()
// - handleGetPlayers()

// Make sure to keep all these functions exactly as you have them in your current file
// The only changes we made were at the top of the file for WebSocket and CORS configuration

function handleRoomJoin(ws, playerId, data) {
  const { roomId, playerName } = data;
  
  if (!rooms[roomId]) {
    createRoom(roomId);
  }
  
  const room = rooms[roomId];
  
  if (room.players.length >= 5) {
    ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'Room is full (max 5 players)'
    }));
    return;
  }
  
  room.players.push({
    id: playerId,
    name: playerName || `Player ${room.players.length + 1}`,
    ws,
    ready: false,
    role: null,
    card: null,
    hasSwapped: false,
    hasSpecialSwapped: false,
    hasDrawn: false,
    hasPeeked: false,
    passed: false,
    actionsTaken: 0,
    passedDuringCycle: false,
    isCurrent: false
  });
  
  ws.send(JSON.stringify({
    type: 'ROOM_JOINED',
    playerId,
    roomId,
    players: room.players.map(p => ({ id: p.id, name: p.name }))
  }));
  
  broadcastRoomState(roomId);
}

function handleStartGame(ws, roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const player = room.players.find(p => p.ws === ws);
  if (!player) return;

  if (room.players.length < 5) {
    broadcastToRoom(roomId, {
      type: 'ERROR',
      message: 'Need at least 5 players to start'
    });
    return;
  }

  room.gameStarted = true;
  room.gameStartedBy = player.id;
  room.deck = shuffleArray(initializeDeck());
  room.turnCycleStarted = false;
  room.cycleComplete = false;
  room.passesThisCycle = 0;
  
  const shuffledRoles = shuffleArray([...room.roles]);
  room.players.forEach((player, index) => {
    player.role = shuffledRoles[index];
    player.card = room.deck.pop();
    player.hasSwapped = false;
    player.hasSpecialSwapped = false;
    player.hasDrawn = false;
    player.hasPeeked = false;
    player.passed = false;
    player.actionsTaken = 0;
    player.passedDuringCycle = false;
    player.isCurrent = false;
  });

  const kingIndex = room.players.findIndex(p => p.role === 'King');
  room.currentPlayerIndex = (kingIndex + 1) % room.players.length;
  room.players[room.currentPlayerIndex].isCurrent = true;

  broadcastRoomState(roomId);
  broadcastLog(roomId, 'Game started! Roles and cards have been dealt.');
}

function handlePlayerAction(data) {
  if (!data.roomId || !data.playerId || !data.type) {
    console.error('Invalid action data:', data);
    return;
  }

  const { roomId, playerId } = data;
  const room = rooms[roomId];
  
  if (!room) {
    console.error(`Room ${roomId} not found`);
    return;
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) {
    console.error(`Player ${playerId} not found in room ${roomId}`);
    return;
  }

  const currentPlayer = room.players[room.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    player.ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'Not your turn'
    }));
    return;
  }

  if (!player.isCurrent) {
    player.ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'Turn state mismatch - please refresh'
    }));
    return;
  }

  if (player.actionsTaken > 0) {
    player.ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'You can only perform one action per turn'
    }));
    return;
  }

  try {
    let shouldCheckEndGame = false;
    
    switch (data.type) {
      case 'SWAP':
        handleSwapAction(room, player, data.targetPlayerId, roomId);
        shouldCheckEndGame = true;
        break;
      case 'SPECIAL_SWAP':
        handleSpecialSwapAction(room, player, data.target1Id, data.target2Id, roomId);
        shouldCheckEndGame = true;
        break;
      case 'DRAW':
        handleDrawAction(room, player, roomId);
        shouldCheckEndGame = true;
        break;
      case 'PEEK':
        handlePeekAction(room, player, data.targetPlayerId, roomId);
        shouldCheckEndGame = true;
        break;
      case 'PASS':
        handlePassAction(room, player, roomId);
        break;
    }

    if (shouldCheckEndGame && allActionsUsed(room)) {
      endGame(roomId);
    }
  } catch (error) {
    console.error('Error handling player action:', error);
    player.ws.send(JSON.stringify({
      type: 'ERROR',
      message: error.message || 'Action failed'
    }));
  }
}

function allActionsUsed(room) {
  return room.players.every(player => {
    const availableActions = [
      player.role === 'King' && !player.hasPeeked,
      !player.hasSwapped,
      !player.hasDrawn,
      player.role === 'Big Bandit' && !player.hasSpecialSwapped
    ].filter(Boolean).length;

    return availableActions === 0;
  });
}

function handleSpecialSwapAction(room, player, target1Id, target2Id, roomId) {
  if (player.role !== 'Big Bandit' || player.hasSpecialSwapped) {
    player.ws.send(JSON.stringify({
      type: 'ERROR',
      message: player.hasSpecialSwapped 
        ? 'You already used your Special Swap this game!' 
        : 'Only Big Bandit can perform special swaps'
    }));
    return;
  }

  const target1 = room.players.find(p => p.id === target1Id);
  const target2 = room.players.find(p => p.id === target2Id);
  
  if (!target1 || !target2 || !target1.card || !target2.card) {
    player.ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'Invalid swap targets'
    }));
    return;
  }

  [target1.card, target2.card] = [target2.card, target1.card];
  player.hasSpecialSwapped = true;
  
  broadcastLog(roomId, `${player.name} (Big Bandit) swapped ${target1.name}'s and ${target2.name}'s cards`);
  broadcastRoomState(roomId);
  player.actionsTaken++;
  advanceTurn(roomId);
}

function handleSwapAction(room, player, targetPlayerId, roomId) {
  const targetPlayer = room.players.find(p => p.id === targetPlayerId);
  
  if (!targetPlayer || !player.card || !targetPlayer.card) {
    player.ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'Invalid swap target'
    }));
    return;
  }

  if (!player.hasSwapped) {
    [player.card, targetPlayer.card] = [targetPlayer.card, player.card];
    player.hasSwapped = true;
    broadcastLog(roomId, `${player.name} swapped cards with ${targetPlayer.name}`);
  } else {
    player.ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'You can only swap once per game!'
    }));
    return;
  }

  broadcastRoomState(roomId);
  player.actionsTaken++;
  advanceTurn(roomId);
}

function handleDrawAction(room, player, roomId) {
  if (player.hasDrawn) {
    player.ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'You can only draw once per game!'
    }));
    return;
  }

  if (room.deck.length === 0) {
    player.ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'No cards left in the deck!'
    }));
    return;
  }

  player.card = room.deck.pop();
  player.hasDrawn = true;
  player.actionsTaken++;
  advanceTurn(roomId);
  broadcastLog(roomId, `${player.name} drew a new card`);
}

function handlePeekAction(room, player, targetPlayerId, roomId) {
  if (player.role !== 'King') {
    player.ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'Only the King can peek at cards!'
    }));
    return;
  }

  if (player.hasPeeked) {
    player.ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'You can only peek once per game!'
    }));
    return;
  }

  const targetPlayer = room.players.find(p => p.id === targetPlayerId);
  if (!targetPlayer) {
    player.ws.send(JSON.stringify({
      type: 'ERROR',
      message: 'Player not found!'
    }));
    return;
  }

  player.ws.send(JSON.stringify({
    type: 'PEEK_RESULT',
    card: targetPlayer.card,
    playerName: targetPlayer.name
  }));

  player.hasPeeked = true;
  broadcastLog(roomId, `${player.name} peeked at ${targetPlayer.name}'s card`);
  player.actionsTaken++;
  advanceTurn(roomId);
}

function handlePassAction(room, player, roomId) {
  if (player.actionsTaken > 0) {
    player.ws.send(JSON.stringify({
      type: 'ERROR', 
      message: 'You have already taken an action this turn'
    }));
    return;
  }

  player.passed = true;
  player.actionsTaken++;
  player.passedDuringCycle = true;
  room.passesThisCycle++;
  
  broadcastLog(roomId, `${player.name} passed`);
  
  if (player.role === 'King' && room.cycleComplete) {
    const allNonKingsPassed = room.players.filter(p => p.role !== 'King')
      .every(p => p.passedDuringCycle);
    
    if (allNonKingsPassed) {
      endGame(roomId);
      return;
    }
  }
  
  advanceTurn(roomId);
}

function advanceTurn(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const currentPlayer = room.players[room.currentPlayerIndex];
  currentPlayer.isCurrent = false;
  
  const kingIndex = room.players.findIndex(p => p.role === 'King');
  
  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
  
  if (!room.turnCycleStarted && room.currentPlayerIndex === (kingIndex + 1) % room.players.length) {
    room.turnCycleStarted = true;
    room.passesThisCycle = 0;
    room.players.forEach(p => p.passedDuringCycle = false);
  }

  if (room.turnCycleStarted && room.currentPlayerIndex === kingIndex) {
    room.turnCycleStarted = false;
    room.cycleComplete = true;
  }

  const newCurrentPlayer = room.players[room.currentPlayerIndex];
  newCurrentPlayer.actionsTaken = 0;
  newCurrentPlayer.passed = false;
  newCurrentPlayer.isCurrent = true;

  broadcastRoomState(roomId);
}

function endGame(roomId) {
    const room = rooms[roomId];
    if (!room) {
        console.error(`Room ${roomId} not found for game end`);
        return;
    }

    const determineWinner = () => {
        const king = room.players.find(p => p.role === 'King');
        const bandits = room.players.filter(p => p.role.includes('Bandit'));
        const guards = room.players.filter(p => p.role === 'Guard');

        const kingValue = king.card?.numericValue || 0;
        const banditValues = bandits.map(b => b.card?.numericValue || 0).sort((a,b) => b-a);
        const highestBanditValue = banditValues[0] || 0;
        const secondBanditValue = banditValues[1] || 0;
        const highestGuardValue = Math.max(...guards.map(g => g.card?.numericValue || 0), 0);

        if (kingValue > highestBanditValue) {
            return { winner: 'King', tiebreaker: false };
        }

        if (highestBanditValue > kingValue) {
            return { winner: 'Bandits', tiebreaker: false };
        }

        if (secondBanditValue > highestGuardValue) {
            return { winner: 'Bandits', tiebreaker: true };
        } else {
            return { winner: 'King', tiebreaker: true };
        }
    };

    const { winner, tiebreaker } = determineWinner();
    const king = room.players.find(p => p.role === 'King');
    const bandits = room.players.filter(p => p.role.includes('Bandit'));
    const guards = room.players.filter(p => p.role === 'Guard');
    
    const banditValues = bandits.map(b => b.card?.numericValue || 0).sort((a,b) => b-a);
    const highestBanditValue = banditValues[0] || 0;
    const secondBanditValue = banditValues[1] || 0;
    const highestGuardValue = Math.max(...guards.map(g => g.card?.numericValue || 0), 0);

    const gameEndData = {
        type: 'GAME_END',
        winner: winner,
        tiebreakerUsed: tiebreaker,
        kingCard: king.card,
        allPlayers: room.players.map(player => ({
            id: player.id,
            name: player.name,
            role: player.role,
            card: player.card
        })),
        tiebreakerDetails: tiebreaker ? {
            highestBanditValue: highestBanditValue,
            secondBanditValue: secondBanditValue,
            highestGuardValue: highestGuardValue
        } : null
    };

    broadcastToRoom(roomId, gameEndData);
    setTimeout(() => resetGameState(roomId), 3000);
}

function resetGameState(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    room.players.forEach(player => {
        player.ready = false;
        player.card = null;
        player.role = null;
        player.hasSwapped = false;
        player.hasSpecialSwapped = false;
        player.hasDrawn = false;
        player.hasPeeked = false;
        player.passed = false;
        player.actionsTaken = 0;
        player.passedDuringCycle = false;
        player.isCurrent = false;
    });

    room.deck = [];
    room.gameStarted = false;
    room.currentPlayerIndex = 0;
    room.passesThisCycle = 0;
    room.cycleComplete = false;
    room.gameEnded = false;
    delete room.messageDelivery;

    broadcastRoomState(roomId);
    broadcastLog(roomId, "Game has been reset - ready for a new round!");
}

function broadcastRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  
  room.players.forEach(player => {
    if (player.ws.readyState === WebSocket.OPEN) {
      const publicState = {
        type: 'GAME_STATE',
        players: room.players.map(p => ({
          id: p.id,
          name: p.name,
          role: p.id === player.id ? p.role : (p.role === 'King' ? 'King' : null),
          card: p.id === player.id ? p.card : null,
          isCurrent: p.isCurrent
        })),
        currentPlayerIndex: room.currentPlayerIndex,
        deckCount: room.deck.length,
        gameStarted: room.gameStarted,
        gameStartedBy: room.gameStartedBy,
        roomId
      };
      player.ws.send(JSON.stringify(publicState));
    }
  });
}

function broadcastToRoom(roomId, message) {
  const room = rooms[roomId];
  if (!room) return;
  
  room.players.forEach(player => {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  });
}

function broadcastLog(roomId, message) {
  broadcastToRoom(roomId, {
    type: 'LOG_ENTRY',
    message,
    timestamp: new Date().toISOString()
  });
}

function handleGetPlayers(ws, roomId) {
  const room = rooms[roomId];
  if (!room) return;
  
  ws.send(JSON.stringify({
    type: 'PLAYER_LIST',
    players: room.players.map(p => ({
      id: p.id,
      name: p.name
    }))
  }));
}
