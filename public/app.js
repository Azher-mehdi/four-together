const $ = id => document.getElementById(id);
const socket = io();
let session = null, state = null, pending = false;
const requested = new URLSearchParams(location.search).get('room');
if (requested) $('code').value = requested.slice(0, 6);
function message(text) { $('message').textContent = text || ''; }
function stored(code) { try { return localStorage.getItem('four-' + code); } catch { return null; } }
function enter(create, code) {
  if (!socket.connected) return message('Connecting to the server. Please try again shortly.');
  socket.timeout(8000).emit('enter', { create, code, token: stored(code) }, (err, result) => {
    if (err) return message('Connection timed out. Please try again.');
    if (result.error) return message(result.error);
    session = result;
    try { localStorage.setItem('four-' + result.code, result.token); } catch {}
    history.replaceState(null, '', '?room=' + result.code);
    $('lobby').hidden = true; $('game').hidden = false;
    $('room').textContent = result.code;
    $('identity').textContent = 'You are ' + (result.player === 1 ? 'Red ●' : 'Yellow ●');
    message('');
  });
}
$('create').onclick = () => enter(true, '');
$('join').onsubmit = e => { e.preventDefault(); enter(false, $('code').value.trim().toUpperCase()); };
$('share').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); message('Invitation copied. Send it to your friend!'); }
  catch { message('Share this link: ' + location.href); }
};
$('rematch').onclick = () => socket.emit('rematch');
function render() {
  if (!state || !session) return;
  const both = state.connected.length === 2 && state.connected.every(Boolean);
  const ended = state.winner || state.draw;
  $('status').textContent = !socket.connected ? 'Connection lost — reconnecting…' : !both ? (state.connected.length < 2 ? 'Waiting for your friend…' : 'Opponent disconnected — waiting…') : state.winner ? (state.winner === session.player ? 'You won! Four together.' : 'Your friend wins!') : state.draw ? 'It’s a draw!' : state.turn === session.player ? 'Your turn — choose a column' : 'Your friend’s turn…';
  $('board').replaceChildren();
  for (let c = 0; c < 7; c++) {
    const button = document.createElement('button'); button.className = 'column';
    button.setAttribute('aria-label', 'Drop in column ' + (c + 1) + '. ' + state.board.map(r => r[c] === 1 ? 'red' : r[c] === 2 ? 'yellow' : 'empty').join(', '));
    button.disabled = pending || !socket.connected || !both || !!ended || state.turn !== session.player || state.board[0][c] !== null;
    button.onclick = () => {
      pending = true; render();
      socket.timeout(8000).emit('move', c, (err, result) => { pending = false; message(err ? 'Move not confirmed. Check the board before trying again.' : result.error); render(); });
    };
    for (let r = 0; r < 6; r++) {
      const cell = document.createElement('span'); cell.className = 'cell' + (state.board[r][c] === 1 ? ' red' : state.board[r][c] === 2 ? ' yellow' : ''); cell.setAttribute('aria-hidden', 'true'); button.append(cell);
    }
    $('board').append(button);
  }
  $('rematch').hidden = !ended;
  $('rematch').disabled = !both || !socket.connected || state.rematch.includes(session.player);
  $('rematch').textContent = state.rematch.includes(session.player) ? 'Waiting for friend’s rematch approval…' : state.rematch.length ? 'Accept rematch' : 'Request rematch';
}
socket.on('state', next => { state = next; render(); });
socket.on('disconnect', () => { pending = false; render(); message('Connection lost. We’ll try to rejoin automatically.'); });
socket.on('connect', () => {
  if (session) enter(false, session.code);
  else if (requested && stored(requested.toUpperCase())) enter(false, requested.toUpperCase());
});
