import { io } from 'socket.io-client';

const args = process.argv.slice(2);

let token = undefined;
let message = '';
let sendInvalid = false;

if (args.includes('--invalid')) {
  sendInvalid = true;
}

const nonFlagArgs = args.filter((a) => !a.startsWith('--'));

if (nonFlagArgs.length === 1) {
  message = nonFlagArgs[0];
} else if (nonFlagArgs.length >= 2) {
  token = nonFlagArgs[0];
  message = nonFlagArgs[1];
}

const socket = io('http://localhost:3000', {
  auth: token ? { token } : {},
  transports: ['websocket', 'polling'],
  reconnection: false, // Don't loop on failure during test
});

socket.on('connect', () => {
  console.log('[connect] Connected to server');
});

socket.on('connect_error', (err) => {
  console.error('[connect_error] Error:', err.message);
  process.exit(1);
});

socket.on('ready', ({ user }) => {
  console.log('[ready] user:', user);

  if (sendInvalid) {
    // Send invalid payload (missing content)
    socket.emit('chat', {});
  } else {
    socket.emit('chat', { content: message });
  }
});

socket.on('token', ({ text }) => {
  console.log('[token]', text);
});

socket.on('tool', (data) => {
  console.log('[tool]', data);
});

socket.on('done', () => {
  console.log('[done] Stream finished');
  socket.disconnect();
  process.exit(0);
});

socket.on('error', ({ message: errMsg }) => {
  console.error('[error]', errMsg);
  socket.disconnect();
  process.exit(1);
});

