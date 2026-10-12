const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Server } = require('socket.io');
const { fresh, move } = require('./game');
function createGameServer() {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
    if (pathname === '/health') { res.writeHead(200); return res.end('ok'); }
    const file = files[pathname];
    if (!file) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': file[1], 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(path.join(__dirname, 'public', file[0])).pipe(res);
  });
  const io = new Server(server, { maxHttpBufferSize: 10000 });
  const rooms = new Map();
  const emit = room => io.to(room.code).emit('state', { code: room.code, board: room.board, turn: room.turn, winner: room.winner, draw: room.draw, connected: room.players.map(p => p.connected), rematch: room.votes });
  function leave(socket) {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) player.connected = false;
    room.updated = Date.now(); emit(room);
  }
  io.on('connection', socket => {
    socket.on('enter', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (socket.data.code) return ack({ error: 'You already joined a room.' });
      const code = typeof payload?.code === 'string' ? payload.code.trim().toUpperCase() : '';
      let room;
      if (payload?.create === true) {
        if (rooms.size >= 1000) return ack({ error: 'Server is busy. Try again later.' });
        let generated;
        do { generated = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(generated));
        room = { code: generated, board: fresh(), turn: 1, winner: null, draw: false, players: [], votes: [], updated: Date.now() };
        rooms.set(generated, room);
      } else {
        room = rooms.get(code);
        if (!room) return ack({ error: 'Room not found. Check the code or create a new room.' });
      }
      let index = room.players.findIndex(p => p.token === payload?.token);
      if (index >= 0 && room.players[index].connected) return ack({ error: 'This player is already connected in another tab.' });
      if (index < 0) {
        if (room.players.length >= 2) return ack({ error: 'This room already has two players.' });
        index = room.players.length;
        room.players.push({ token: crypto.randomBytes(24).toString('hex') });
      }
      Object.assign(room.players[index], { id: socket.id, connected: true });
      socket.data.code = room.code; socket.data.player = index + 1;
      socket.join(room.code); room.updated = Date.now();
      ack({ code: room.code, player: index + 1, token: room.players[index].token }); emit(room);
    });
    socket.on('move', (column, ack) => {
      const room = rooms.get(socket.data.code);
      let error;
      if (!room) error = 'Join a room first.';
      else if (room.players.length !== 2 || room.players.some(p => !p.connected)) error = 'Wait for both players to connect.';
      else if (room.winner || room.draw) error = 'Game finished. Request a rematch.';
      else if (room.turn !== socket.data.player) error = 'Wait for your turn.';
      if (!error) {
        try {
          Object.assign(room, move(room.board, column, room.turn));
          if (!room.winner && !room.draw) room.turn = 3 - room.turn;
          room.updated = Date.now(); emit(room);
        } catch (e) { error = e.message; }
      }
      if (typeof ack === 'function') ack({ error });
    });
    socket.on('rematch', () => {
      const room = rooms.get(socket.data.code);
      if (!room || (!room.winner && !room.draw)) return;
      if (!room.votes.includes(socket.data.player)) room.votes.push(socket.data.player);
      if (room.votes.length === 2) Object.assign(room, { board: fresh(), turn: 1, winner: null, draw: false, votes: [] });
      room.updated = Date.now(); emit(room);
    });
    socket.on('disconnect', () => leave(socket));
  });
  const cleanup = setInterval(() => {
    for (const [code, room] of rooms) if (room.players.every(p => !p.connected) && Date.now() - room.updated > 3600000) rooms.delete(code);
  }, 60000);
  cleanup.unref(); server.on('close', () => clearInterval(cleanup));
  return { server, io };
}
if (require.main === module) createGameServer().server.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Connect Four is running.'));
module.exports = { createGameServer };
