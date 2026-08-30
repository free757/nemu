const http = require('http');
const net = require('net');
const WebSocket = require('ws');
const url = require('url');

const PORT = process.env.PORT || 10000;
const USER_ID = "d342d11e-d424-4583-b36e-524ab1f0ade3";

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Nemu High-Speed Unlimited Bridge Running ✅');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const parsedUrl = url.parse(req.url, true);
  const targetIp = parsedUrl.query.ph;
  const targetPort = parseInt(parsedUrl.query.pp, 10);
  const targetUser = parsedUrl.query.pu;
  const targetPass = parsedUrl.query.pw;

  if (!targetIp || !targetPort) {
    ws.close(1008, 'Missing Target Proxy Params');
    return;
  }

  // Fast TCP Stream Connection directly to target residential proxy
  const socket = net.connect(targetPort, targetIp, () => {
    // If HTTP Basic auth parameters are present, pass traffic smoothly
  });

  socket.on('data', (chunk) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(chunk);
    }
  });

  ws.on('message', (message) => {
    let data = message;
    if (Buffer.isBuffer(message) || message instanceof Uint8Array) {
      data = Buffer.from(message);
    }
    socket.write(data);
  });

  socket.on('error', () => {
    try { ws.close(); } catch (_) {}
  });

  ws.on('error', () => {
    try { socket.destroy(); } catch (_) {}
  });

  socket.on('close', () => {
    try { ws.close(); } catch (_) {}
  });

  ws.on('close', () => {
    try { socket.destroy(); } catch (_) {}
  });
});

server.listen(PORT, () => {
  console.log(`Render Unlimited Bridge active on port ${PORT}`);
});
