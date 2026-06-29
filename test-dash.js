const { io } = require("socket.io-client");

const socket = io("http://localhost:3000/dashboard");

socket.on("connect", () => {
  console.log("Connected to dashboard ns");
  // Assuming there's a game FIRE-TEST
  socket.emit("joinDashboard", "FIRE-TEST");
});

socket.on("publicState", (state) => {
  console.log("Received publicState:", state.roomId, state.phase);
  process.exit(0);
});

socket.on("error", (err) => {
  console.error("Socket error:", err);
  process.exit(1);
});

setTimeout(() => {
  console.log("Timeout waiting for publicState");
  process.exit(1);
}, 3000);
