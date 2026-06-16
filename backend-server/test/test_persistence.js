const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const SERVER = process.env.SERVER || 'http://localhost:3000';
const NAMESPACE = '/game';
const roomId = 'room-test-1';
const playerId = 'player-test-1';

const socket = io(`${SERVER}${NAMESPACE}`);

socket.on('connect', () => {
  console.log('connected', socket.id);
  socket.emit('joinRoom', roomId, playerId, 'Tester');
});

socket.on('roomState', (rid, state) => {
  console.log('roomState received for', rid);
  // if in LOBBY, start game
  if (state.phase === 'LOBBY') {
    console.log('starting game');
    socket.emit('startGame', roomId);
    setTimeout(() => {
      console.log('advancing phase');
      socket.emit('advancePhase', roomId);
      // wait and then check file
      setTimeout(checkFile, 1500);
    }, 500);
  } else {
    console.log('state.phase=', state.phase);
  }
});

socket.on('nightResolved', (payload) => {
  console.log('nightResolved', payload);
});

socket.on('phaseChanged', (roomId, phase) => {
  console.log('phaseChanged', roomId, phase);
});

socket.on('actionAccepted', (id) => console.log('actionAccepted', id));
socket.on('error', (err) => console.error('socket error', err));

function checkFile() {
  const dataFile = path.join(process.cwd(), 'data', 'games', `${roomId}.json`);
  console.log('looking for', dataFile);
  if (fs.existsSync(dataFile)) {
    const raw = fs.readFileSync(dataFile, 'utf8');
    console.log('persisted file content:', raw);
  } else {
    console.log('persisted file not found');
  }
  socket.disconnect();
  process.exit(0);
}
