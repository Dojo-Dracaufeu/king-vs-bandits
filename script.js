
let socket;

document.addEventListener("DOMContentLoaded", () => {
  const joinBtn = document.getElementById("joinBtn");
  const startBtn = document.getElementById("startBtn");
  const startTurnBtn = document.getElementById("startTurnBtn");
  const endTurnBtn = document.getElementById("endTurnBtn");
  const instructionsBtn = document.getElementById("instructionsBtn");
  const manualEndGameBtn = document.getElementById("manualEndGameBtn");
  const restartBtn = document.getElementById("restartBtn");

  function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6);
  }

  function generateRandomId() {
    return Math.random().toString(36).substring(2, 10);
  }

  function joinGame() {
    const name = prompt("Enter your name:");
    const roomCode = window.location.hash.substring(1) || generateRoomCode();
    const playerId = generateRandomId();

    if (!window.location.hash) window.location.hash = roomCode;

    socket = new WebSocket(\`wss://multiplayer-websockets-example.glitch.me?room=\${roomCode}&player=\${playerId}&name=\${encodeURIComponent(name)}\`);

    socket.onopen = () => {
      console.log("Connected to room:", roomCode);
      alert("Connected to room: " + roomCode);
    };

    socket.onerror = (e) => {
      console.error("Socket error:", e);
      alert("WebSocket error. Check your connection or server.");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Message received:", data);
      // Future multiplayer logic here
    };
  }

  joinBtn?.addEventListener("click", joinGame);
  startBtn?.addEventListener("click", () => alert("Start Game clicked"));
  startTurnBtn?.addEventListener("click", () => alert("Start Turn clicked"));
  endTurnBtn?.addEventListener("click", () => alert("End Turn clicked"));
  instructionsBtn?.addEventListener("click", () => {
    alert("Objective: The King and Guards try to keep the King’s card higher than both Bandits.\n\nTake actions each turn:\n- Pass\n- Draw a card\n- Swap with another player\n\nThe King can peek. The Big Bandit can swap two others.\n\nGame ends when all abilities are used or everyone passes in a round ending with the King.");
  });
  manualEndGameBtn?.addEventListener("click", () => alert("Game manually ended"));
  restartBtn?.addEventListener("click", () => location.reload());
});
