const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fresh, move } = require('./game');
const { createGameServer } = require('./server');
const { io: client } = require('socket.io-client');
test('detects horizontal, vertical and both diagonal wins', () => {
  for (const cells of [[[5,0],[5,1],[5,2],[5,3]], [[5,0],[4,0],[3,0],[2,0]], [[5,0],[4,1],[3,2],[2,3]], [[2,0],[3,1],[4,2],[5,3]]]) {
    const board = fresh();
    for (const [r,c] of cells.slice(0,3)) board[r][c] = 1;
    const [r,c] = cells[3];
    for(let below=r+1;below<6;below++) if(board[below][c]===null) board[below][c]=2;
    assert.equal(move(board,c,1).winner,1);
  }
});
test('rejects invalid and full columns without changing the board', () => {
  const board=fresh();
  for(let i=0;i<6;i++) move(board,0,1+i%2);
  const before=JSON.stringify(board);
  for(const c of [0,-1,7,1.2,'2',null]) assert.throws(()=>move(board,c,1));
  assert.equal(JSON.stringify(board),before);
});
test('recognizes a full-board draw', () => {
  const board=Array.from({length:6},(_,r)=>Array.from({length:7},(_,c)=>((c+Math.floor(r/2))%2)+1));
  const player=board[0][0]; board[0][0]=null;
  assert.deepEqual(move(board,0,player),{winner:null,draw:true});
});
test('two clients: turns, capacity, win, rematch, disconnect and rejoin', async t => {
  const {server,io}=createGameServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const clients=[];
  t.after(async()=>{clients.forEach(s=>s.disconnect());await new Promise(resolve=>io.close(resolve));});
  async function connect(){const s=client('http://127.0.0.1:'+server.address().port,{transports:['websocket'],forceNew:true});clients.push(s);await new Promise(resolve=>s.once('connect',resolve));return s;}
  const emit=(s,event,payload)=>new Promise((resolve,reject)=>s.timeout(3000).emit(event,payload,(err,result)=>err?reject(err):resolve(result)));
  const waitState=(s,predicate)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{s.off('state',listen);reject(Error('State timeout'));},3000);function listen(state){if(predicate(state)){clearTimeout(timer);s.off('state',listen);resolve(state);}}s.on('state',listen);});
  const a=await connect(),b=await connect(),c=await connect();
  const p1=await emit(a,'enter',{create:true});
  assert.match((await emit(a,'move',0)).error,/both players/);
  const p2=await emit(b,'enter',{code:p1.code});assert.equal(p2.player,2);
  assert.match((await emit(c,'enter',{code:p1.code})).error,/two players/);
  assert.match((await emit(b,'move',0)).error,/turn/);
  for(const [s,col] of [[a,0],[b,1],[a,0],[b,1],[a,0],[b,1]]) assert.equal((await emit(s,'move',col)).error,undefined);
  const won=waitState(b,s=>s.winner===1);await emit(a,'move',0);const state=await won;assert.equal(state.board[2][0],1);
  assert.match((await emit(b,'move',2)).error,/finished/);
  a.emit('rematch');const reset=waitState(a,s=>s.board.every(r=>r.every(v=>v===null)));b.emit('rematch');await reset;
  const offline=waitState(a,s=>s.connected[1]===false);b.disconnect();await offline;
  assert.match((await emit(a,'move',0)).error,/both players/);
  const rejoined=await connect();assert.equal((await emit(rejoined,'enter',{code:p1.code,token:p2.token})).player,2);
  const sync=waitState(rejoined,s=>s.board[5][3]===1);await emit(a,'move',3);await sync;
});
