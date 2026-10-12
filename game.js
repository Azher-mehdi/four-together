const fresh = () => Array.from({ length: 6 }, () => Array(7).fill(null));
function move(board, column, player) {
  if (!Number.isInteger(column) || column < 0 || column > 6) throw Error('Choose a valid column.');
  let row = 5;
  while (row >= 0 && board[row][column] !== null) row--;
  if (row < 0) throw Error('That column is full.');
  board[row][column] = player;
  let winner = null;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let count = 1;
    for (const sign of [-1, 1]) {
      let r = row + dr * sign, c = column + dc * sign;
      while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
        count++; r += dr * sign; c += dc * sign;
      }
    }
    if (count >= 4) winner = player;
  }
  return { winner, draw: !winner && board.every(r => r.every(cell => cell !== null)) };
}
module.exports = { fresh, move };
