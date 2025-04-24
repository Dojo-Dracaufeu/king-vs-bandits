document.addEventListener('DOMContentLoaded', () => {
  const gameContainer = document.getElementById('game-container');
  const playersArea = document.getElementById('players-area');
  const logArea = document.getElementById('log-area');
  const startBtn = document.getElementById('startBtn');
  const actionArea = document.getElementById('action-area');

  const infoButton = document.createElement('button');
  infoButton.id = 'rulesBtn';
  infoButton.className = 'rules-button';
  infoButton.textContent = '?';
  gameContainer.appendChild(infoButton);
  
  // Add fullscreen button
  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.id = 'fullscreenBtn';
  fullscreenBtn.textContent = '⛶';
  fullscreenBtn.title = 'Toggle Fullscreen';
  gameContainer.appendChild(fullscreenBtn);

  // Fullscreen toggle functionality
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      fullscreenBtn.textContent = '⛶';
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        fullscreenBtn.textContent = '⛶';
      }
    }
  });
  
  let playerId = null;
  let playerName = '';
  let roomId = null;
  let ws = null;
  let currentPlayers = [];
  let lastDialogType = null;

  document.getElementById('newGameBtn').addEventListener('click', () => {
    document.getElementById('gameEndModal').style.display = 'none';
  });

  const rulesModal = document.createElement('div');
  rulesModal.className = 'rules-modal';
  rulesModal.innerHTML = `
    <button class="close-rules">×</button>
    <h2>King vs Bandits</h2>
    <h3>👑 Goal:</h3>
    <p>King needs highest card. Bandits try to stop him.</p>
    <h3>🃏 Roles:</h3>
    <ul>
      <li><strong>Team King:</strong> The King and his two Guards</li>
      <li><strong>Team Bandits:</strong> The Big and Small Bandits</li>
    </ul>
    <h3>🔄 Play:</h3>
    <ul>
      <li>Get random role & card</li>
      <li>On turn: Swap/Draw/Peek/Pass</li>
      <li>Game ends when all pass for a full cycle or use all actions</li>
    </ul>
    <h3>🏆 Win:</h3>
    <ul>
      <li><strong>King wins:</strong> If his card > all Bandits</li>
      <li><strong>Bandits win:</strong> If any Bandit ≥ King</li>
      <li><strong>Tie:</strong> 2nd Bandit vs Top Guard decides</li>
    </ul>
  `;
  document.body.appendChild(rulesModal);

  infoButton.addEventListener('click', () => {
    rulesModal.style.display = 'block';
  });

  rulesModal.querySelector('.close-rules').addEventListener('click', () => {
    rulesModal.style.display = 'none';
  });

  rulesModal.addEventListener('click', (e) => {
    if (e.target === rulesModal) {
      rulesModal.style.display = 'none';
    }
  });

  function showRoomSelection() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Join or Create a Room</h3>
        <input type="text" id="roomIdInput" placeholder="Room ID (leave blank for random)">
        <input type="text" id="playerNameInput" placeholder="Your Name">
        <button id="joinRoomBtn">Join Room</button>
      </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('joinRoomBtn').addEventListener('click', () => {
      roomId = document.getElementById('roomIdInput').value || 
               `room-${Math.random().toString(36).substr(2, 6)}`;
      playerName = document.getElementById('playerNameInput').value || 
                  `Player${Math.floor(Math.random() * 100)}`;
      
      initConnection(roomId, playerName);
      modal.remove();
    });
  }

  function initConnection(roomId, name) {
    ws = new WebSocket('wss://shore-gaudy-brace.glitch.me');

    ws.onopen = () => {
      ws.send(JSON.stringify({
        action: 'CREATE_OR_JOIN_ROOM',
        roomId,
        playerName: name
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      setTimeout(() => showRoomSelection(), 2000);
    };
  }

  function handleServerMessage(data) {
    switch (data.type) {
      case 'CONNECTION_ESTABLISHED':
        handleConnectionEstablished(data);
        break;
      case 'ROOM_JOINED':
        handleRoomJoined(data);
        break;
      case 'GAME_STATE':
        handleGameState(data);
        break;
      case 'PLAYER_LIST':
        handlePlayerList(data);
        break;
      case 'LOG_ENTRY':
        addLogEntry(data.message);
        break;
      case 'PEEK_RESULT':
        showPeekResult(data);
        break;
      case 'GAME_END':
        showGameEnd(data);
        actionArea.style.display = 'none';
        break;
      case 'ERROR':
        handleError(data);
        break;
    }
  }

  function handleConnectionEstablished(data) {
    playerId = data.playerId;
    document.getElementById('player-info').textContent = `You: ${playerName} | Room: ${roomId}`;
  }

  function handleGameState(data) {
    currentPlayers = JSON.parse(JSON.stringify(data.players));
    renderGameState(data);
    
    if (data.gameStarted) {
      startBtn.disabled = true;
      startBtn.textContent = 'Game in Progress';
      if (data.gameStartedBy === playerId) {
        startBtn.disabled = false;
        startBtn.textContent = 'Restart Game';
      }
    } else {
      startBtn.disabled = false;
      startBtn.textContent = 'Start Game';
    }
    
    showPlayerActions();
  }

  function handlePlayerList(data) {
    currentPlayers = JSON.parse(JSON.stringify(data.players));
    if (document.getElementById('playerSelectModal').style.display === 'flex') {
      if (lastDialogType === 'swap') showSwapDialog();
      if (lastDialogType === 'peek') showPeekDialog();
    }
  }

  function handleError(data) {
    console.error('Server error:', data.message);
    alert(`Error: ${data.message}`);
  }

  function renderGameState(state) {
    playersArea.innerHTML = '';
    
    state.players.forEach(player => {
      const playerEl = document.createElement('div');
      playerEl.className = `player ${player.role === 'King' ? 'king' : ''} ${player.isCurrent ? 'current' : ''}`;
      
      const nameEl = document.createElement('div');
      nameEl.className = 'player-name';
      nameEl.textContent = player.name;
      playerEl.appendChild(nameEl);
      
      const roleEl = document.createElement('div');
      roleEl.className = 'player-role';
      roleEl.textContent = player.role || '?';
      playerEl.appendChild(roleEl);
      
      const cardContainer = document.createElement('div');
      cardContainer.className = 'card-container';

      const cardBack = document.createElement('div');
      cardBack.className = 'card-face card-back';
      cardContainer.appendChild(cardBack);

      if (player.card) {
        const cardFront = document.createElement('div');
        cardFront.className = `card-face card-front ${player.card.isRed ? 'red' : ''}`;
        cardFront.innerHTML = `
          <div class="card-corner top-left">${player.card.value}${player.card.suit}</div>
          <div class="card-value">${player.card.value}</div>
          <div class="card-suit">${player.card.suit}</div>
          <div class="card-corner bottom-right">${player.card.value}${player.card.suit}</div>
        `;
        cardContainer.appendChild(cardFront);
        
        if (player.id === playerId) {
          cardContainer.classList.add('flipped');
        }
      }
      
      playerEl.appendChild(cardContainer);
      playersArea.appendChild(playerEl);
    });
    
    const isMyTurn = currentPlayers.some(p => p.id === playerId && p.isCurrent);
    if (!isMyTurn) {
      actionArea.style.display = 'none';
    }
  }

  function showPlayerActions() {
    actionArea.style.display = 'block';
    const currentPlayer = currentPlayers.find(p => p.id === playerId);
    const isBigBandit = currentPlayer?.role === 'Big Bandit';
    const isMyTurn = currentPlayers.some(p => p.id === playerId && p.isCurrent);
    
    actionArea.innerHTML = `
      <div class="action-buttons">
        <button id="passBtn" ${!isMyTurn ? 'disabled' : ''}>Pass</button>
        ${isBigBandit ? `
          <button id="swapBtn" ${!isMyTurn ? 'disabled' : ''}>Swap</button>
          <button id="specialSwapBtn" ${!isMyTurn ? 'disabled' : ''}>Special Swap</button>
        ` : `<button id="swapBtn" ${!isMyTurn ? 'disabled' : ''}>Swap</button>`}
        <button id="drawBtn" ${!isMyTurn ? 'disabled' : ''}>Draw</button>
        ${currentPlayer?.role === 'King' ? `<button id="peekBtn" ${!isMyTurn ? 'disabled' : ''}>Peek</button>` : ''}
      </div>
      ${!isMyTurn ? `<div class="turn-notice">Waiting for ${currentPlayers.find(p => p.isCurrent)?.name || 'other player'}...</div>` : ''}
    `;

    if (isMyTurn) {
      document.getElementById('passBtn').addEventListener('click', () => {
        ws.send(JSON.stringify({
          action: 'PLAYER_ACTION',
          playerId,
          roomId,
          type: 'PASS'
        }));
      });

      document.getElementById('drawBtn').addEventListener('click', () => {
        ws.send(JSON.stringify({
          action: 'PLAYER_ACTION',
          playerId,
          roomId,
          type: 'DRAW'
        }));
      });

      document.getElementById('swapBtn').addEventListener('click', () => {
        showSwapDialog();
      });

      if (isBigBandit) {
        document.getElementById('specialSwapBtn').addEventListener('click', () => {
          showSpecialSwapDialog();
        });
      }
      
      if (currentPlayer?.role === 'King') {
        document.getElementById('peekBtn').addEventListener('click', () => {
          showPeekDialog();
        });
      }
    }
  }

  function showSwapDialog() {
    lastDialogType = 'swap';
    const modal = document.getElementById('playerSelectModal');
    const list = document.getElementById('playerSelectList');
    const cancelBtn = document.getElementById('cancelSelectBtn');
    
    list.innerHTML = '';
    
    currentPlayers
      .filter(p => p.id !== playerId)
      .forEach(player => {
        const btn = document.createElement('button');
        btn.textContent = player.name;
        btn.style.margin = '5px';
        btn.style.width = '100%';
        btn.style.padding = '8px';
        
        btn.onclick = () => {
          modal.style.display = 'none';
          ws.send(JSON.stringify({
            action: 'PLAYER_ACTION',
            playerId: playerId,
            roomId: roomId,
            type: 'SWAP',
            targetPlayerId: player.id
          }));
        };
        
        list.appendChild(btn);
      });
    
    cancelBtn.onclick = () => modal.style.display = 'none';
    modal.style.display = 'flex';
  }

  function showSpecialSwapDialog() {
    const modal = document.getElementById('playerSelectModal');
    const list = document.getElementById('playerSelectList');
    const cancelBtn = document.getElementById('cancelSelectBtn');
    
    list.innerHTML = '<p>Select first player to swap:</p>';
    let firstTargetId = null;

    currentPlayers.forEach(player => {
      const btn = document.createElement('button');
      btn.textContent = player.name + (player.id === playerId ? ' (You)' : '');
      btn.style.margin = '5px';
      btn.style.width = '100%';
      btn.style.padding = '8px';
      
      btn.onclick = () => {
        if (!firstTargetId) {
          firstTargetId = player.id;
          list.innerHTML = `<p>Swapping ${player.name}'s card with:</p>`;
          
          currentPlayers.forEach(p => {
            const secondBtn = document.createElement('button');
            secondBtn.textContent = p.name + (p.id === playerId ? ' (You)' : '');
            secondBtn.style.margin = '5px';
            secondBtn.style.width = '100%';
            secondBtn.style.padding = '8px';
            
            secondBtn.onclick = () => {
              modal.style.display = 'none';
              ws.send(JSON.stringify({
                action: 'PLAYER_ACTION',
                playerId: playerId,
                roomId: roomId,
                type: 'SPECIAL_SWAP',
                target1Id: firstTargetId,
                target2Id: p.id
              }));
            };
            
            list.appendChild(secondBtn);
          });
        }
      };
      
      list.appendChild(btn);
    });
    
    cancelBtn.onclick = () => {
      modal.style.display = 'none';
    };
    modal.style.display = 'flex';
  }

  function showPeekDialog() {
    const currentPlayer = currentPlayers.find(p => p.id === playerId);
    if (currentPlayer?.role !== 'King') return;
    lastDialogType = 'peek';
    ws.send(JSON.stringify({ 
      action: 'GET_PLAYERS',
      roomId: roomId
    }));
    const modal = document.getElementById('playerSelectModal');
    const list = document.getElementById('playerSelectList');
    const cancelBtn = document.getElementById('cancelSelectBtn');
    
    list.innerHTML = '';
    currentPlayers
      .filter(p => p.id !== playerId)
      .forEach(player => {
        const btn = document.createElement('button');
        btn.textContent = player.name;
        btn.onclick = () => {
          ws.send(JSON.stringify({
            action: 'PLAYER_ACTION',
            playerId,
            roomId,
            type: 'PEEK',
            targetPlayerId: player.id
          }));
          modal.style.display = 'none';
        };
        list.appendChild(btn);
      });
    
    cancelBtn.onclick = () => modal.style.display = 'none';
    modal.style.display = 'flex';
  }

  function addLogEntry(message) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
  }

  function showPeekResult(data) {
    const modal = document.getElementById('peekResultModal');
    const content = document.getElementById('peekResultContent');
    
    content.innerHTML = `
      <p>${data.playerName}'s card:</p>
      <div class="card-container" style="transform: rotateY(180deg)">
        <div class="card-face card-back"></div>
        <div class="card-face card-front ${data.card.isRed ? 'red' : ''}">
          <div class="card-corner top-left">${data.card.value}${data.card.suit}</div>
          <div class="card-value">${data.card.value}</div>
          <div class="card-suit">${data.card.suit}</div>
          <div class="card-corner bottom-right">${data.card.value}${data.card.suit}</div>
        </div>
      </div>
    `;
    
    document.getElementById('closePeekBtn').onclick = () => modal.style.display = 'none';
    modal.style.display = 'flex';
  }

  function showGameEnd(data) {
    const modal = document.getElementById('gameEndModal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.style.zIndex = '9999';

    const title = document.getElementById('gameEndTitle');
    const content = document.getElementById('gameEndContent');
    
    content.innerHTML = '';
    title.textContent = `${data.winner} Wins! ${data.winner === 'King' ? '👑' : '🎭'}`;
    
    const winnerSection = document.createElement('div');
    winnerSection.className = 'winner-section';
    winnerSection.innerHTML = `
        <h3>${data.winner} Team Wins!</h3>
        <p>King's card: ${data.kingCard.value}${data.kingCard.suit} (Value: ${data.kingCard.numericValue})</p>
    `;
    content.appendChild(winnerSection);

    if (data.tiebreakerUsed) {
        const tiebreakerNotice = document.createElement('div');
        tiebreakerNotice.className = 'tiebreaker-notice';
        tiebreakerNotice.innerHTML = `
            <div class="tiebreaker-icon">⚔️</div>
            <p>Tiebreaker was activated!</p>
            <small>The second-highest card determined the winner</small>
        `;
        content.appendChild(tiebreakerNotice);
    }

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'end-game-cards';
    content.appendChild(cardsContainer);
    
    data.allPlayers.forEach(player => {
        const playerCard = document.createElement('div');
        playerCard.className = `player-card ${player.role === 'King' ? 'king' : ''} ${player.id === playerId ? 'you' : ''}`;
        
        const isTiebreakerCard = data.tiebreakerUsed && 
                               player.card?.numericValue === data.kingCard.numericValue;
        const isSecondHighest = data.tiebreakerUsed && 
                              player.card?.numericValue !== data.kingCard.numericValue &&
                              player.card?.numericValue === Math.max(
                                  ...data.allPlayers
                                      .filter(p => p.card?.numericValue !== data.kingCard.numericValue)
                                      .map(p => p.card?.numericValue || 0)
                              );

        playerCard.innerHTML = `
            <h4>${player.name} ${player.id === playerId ? '(You)' : ''}</h4>
            <p class="player-role" data-role="${player.role}">${player.role || 'Unknown'}</p>
            <div class="modal-card card-container flipped ${isTiebreakerCard ? 'tie-card' : ''} ${isSecondHighest ? 'second-highest' : ''}">
                <div class="card-face card-back"></div>
                ${player.card ? `
                    <div class="card-face card-front ${player.card.isRed ? 'red' : ''}">
                        <div class="card-corner top-left">${player.card.value}${player.card.suit}</div>
                        <div class="card-value">${player.card.value}</div>
                        <div class="card-suit">${player.card.suit}</div>
                        <div class="card-corner bottom-right">${player.card.value}${player.card.suit}</div>
                    </div>
                    <p class="card-points">Value: ${player.card.numericValue}</p>
                ` : '<div class="card-face card-front"><div class="card-value">No Card</div></div>'}
            </div>
        `;
        
        cardsContainer.appendChild(playerCard);
    });
  }

  startBtn.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ 
        action: 'START_GAME',
        roomId: roomId
      }));
    }
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  });

  showRoomSelection();
});
