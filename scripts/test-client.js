import { io } from 'socket.io-client';

const args = process.argv.slice(2);
let token = undefined;
let message = '';

if (args.length === 1) {
  message = args[0];
} else if (args.length >= 2) {
  token = args[0];
  message = args[1];
}

const socket = io('http://localhost:3000', {
  auth: token ? { token } : {},
  transports: ['websocket', 'polling'],
  reconnection: false,
});

socket.on('connect_error', (err) => {
  console.log('[connect_error]', err.message);
  process.exit(1);
});

socket.on('connect', () => {
  socket.emit('message', { text: message });
});

socket.on('reply', ({ text }) => {
  console.log('[reply]', text);
  socket.disconnect();
  process.exit(0);
});

socket.on('error', ({ message: errMsg }) => {
  console.log('[error]', errMsg);
  socket.disconnect();
  process.exit(1);
});
