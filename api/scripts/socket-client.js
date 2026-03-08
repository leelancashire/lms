/* eslint-disable no-console */
const { io } = require("socket.io-client");

const token = process.env.ACCESS_TOKEN;
const leagueId = process.env.LEAGUE_ID;
const gameweek = Number(process.env.GAMEWEEK || "1");
const url = process.env.SOCKET_URL || "http://localhost:3001";

if (!token) {
  console.error("Missing ACCESS_TOKEN env var");
  process.exit(1);
}

const socket = io(url, {
  auth: { token },
});

socket.on("connect", () => {
  console.log("Connected", socket.id);
  if (leagueId) socket.emit("joinLeague", leagueId);
  socket.emit("followGameweek", gameweek);
});

socket.on("connect_error", (err) => {
  console.error("Connect error:", err.message);
});

socket.on("scoreUpdate", (payload) => {
  console.log("scoreUpdate", payload);
});

socket.on("matchEvent", (payload) => {
  console.log("matchEvent", payload);
});

process.on("SIGINT", () => {
  socket.disconnect();
  process.exit(0);
});
