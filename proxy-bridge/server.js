const http = require('http');
const net = require('net');
const url = require('url');
const { WebSocketServer } = require('ws');

const USER_ID = "d342d11e-d424-4583-b36e-524ab1f0ade3";
const PORT = process.env.PORT || 10000;

const B2H = Array.from({ length: 256 }, (_, i) => (i + 256).toString(16).slice(1));
function uuidStringify(a, o = 0) {
  return [
    B2H[a[o]],B2H[a[o+1]],B2H[a[o+2]],B2H[a[o+3]],"-",
    B2H[a[o+4]],B2H[a[o+5]],"-",
    B2H[a[o+6]],B2H[a[o+7]],"-",
    B2H[a[o+8]],B2H[a[o+9]],"-",
    B2H[a[o+10]],B2H[a[o+11]],B2H[a[o+12]],B2H[a[o+13]],B2H[a[o+14]],B2H[a[o+15]],
  ].join("").toLowerCase();
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Nemu Proxy Bridge 🚀 Node.js Dedicated High-Speed Stream Server Online');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const parsedUrl = url.parse(req.url, true);
  const socks5 = parsedUrl.query.ph ? {
    host: parsedUrl.query.ph,
    port: parseInt(parsedUrl.query.pp || '1080'),
    user: parsedUrl.query.pu || '',
    pass: parsedUrl.query.pw || '',
  } : null;

  let isFirst = true;
  let socket = null;
  let vlessResp = null;

  ws.on('message', (msg) => {
    const chunk = Buffer.isBuffer(msg) ? msg : Buffer.from(msg);

    if (isFirst) {
      isFirst = false;
      if (chunk.length < 24) {
        ws.close();
        return;
      }

      const uuid = uuidStringify(chunk, 1);
      if (uuid !== USER_ID) {
        console.error('Invalid UUID:', uuid);
        ws.close();
        return;
      }

      const optLen = chunk[17];
      const cmd = chunk[18 + optLen];
      const pIdx = 19 + optLen;
      const port = chunk.readUInt16BE(pIdx);
      const aType = chunk[pIdx + 2];
      let aIdx = pIdx + 3;
      let addr = '';

      if (aType === 1) {
        addr = `${chunk[aIdx]}.${chunk[aIdx+1]}.${chunk[aIdx+2]}.${chunk[aIdx+3]}`;
        aIdx += 4;
      } else if (aType === 2) {
        const len = chunk[aIdx++];
        addr = chunk.toString('utf8', aIdx, aIdx + len);
        aIdx += len;
      } else if (aType === 3) {
        const p = [];
        for (let i = 0; i < 8; i++) p.push(chunk.readUInt16BE(aIdx + i * 2).toString(16));
        addr = p.join(':');
        aIdx += 16;
      } else {
        ws.close();
        return;
      }

      vlessResp = Buffer.from([chunk[0], 0]);
      const payload = chunk.slice(aIdx);

      if (socks5) {
        connectViaSocks5(socks5, addr, port, (err, s) => {
          if (err || !s) {
            ws.close();
            return;
          }
          socket = s;
          setupPipes(ws, socket, vlessResp, payload);
        });
      } else {
        socket = net.connect({ host: addr, port: port }, () => {
          setupPipes(ws, socket, vlessResp, payload);
        });
        socket.on('error', () => ws.close());
      }
    } else {
      if (socket && !socket.destroyed) {
        socket.write(chunk);
      }
    }
  });

  ws.on('close', () => {
    if (socket && !socket.destroyed) socket.destroy();
  });
  ws.on('error', () => {
    if (socket && !socket.destroyed) socket.destroy();
  });
});

function setupPipes(ws, socket, vlessResp, payload) {
  let headerSent = false;

  if (payload.length > 0) {
    socket.write(payload);
  }

  socket.on('data', (data) => {
    if (ws.readyState !== 1) return; // 1 = OPEN
    if (!headerSent) {
      headerSent = true;
      ws.send(Buffer.concat([vlessResp, data]));
    } else {
      ws.send(data);
    }
  });

  socket.on('close', () => ws.close());
  socket.on('error', () => ws.close());
}

function connectViaSocks5(proxy, targetHost, targetPort, cb) {
  const sock = net.connect({ host: proxy.host, port: proxy.port }, () => {
    // SOCKS5 Handshake
    sock.write(Buffer.from([0x05, 0x01, 0x02]));
    sock.once('data', (authMethod) => {
      if (authMethod[0] !== 0x05) return cb(new Error('Not SOCKS5'));
      
      const proceedConnect = () => {
        const hostBuf = Buffer.from(targetHost, 'utf8');
        const req = Buffer.alloc(7 + hostBuf.length);
        req[0] = 0x05;
        req[1] = 0x01; // CONNECT
        req[2] = 0x00;
        req[3] = 0x03; // DOMAINNAME
        req[4] = hostBuf.length;
        hostBuf.copy(req, 5);
        req.writeUInt16BE(targetPort, 5 + hostBuf.length);
        
        sock.write(req);
        sock.once('data', (reply) => {
          if (reply[1] !== 0x00) return cb(new Error('SOCKS5 Connect Failed'));
          cb(null, sock);
        });
      };

      if (authMethod[1] === 0x02) {
        const userBuf = Buffer.from(proxy.user, 'utf8');
        const passBuf = Buffer.from(proxy.pass, 'utf8');
        const auth = Buffer.alloc(3 + userBuf.length + passBuf.length);
        auth[0] = 0x01;
        auth[1] = userBuf.length;
        userBuf.copy(auth, 2);
        auth[2 + userBuf.length] = passBuf.length;
        passBuf.copy(auth, 3 + userBuf.length);
        
        sock.write(auth);
        sock.once('data', (authRes) => {
          if (authRes[1] !== 0x00) return cb(new Error('Auth failed'));
          proceedConnect();
        });
      } else if (authMethod[1] === 0x00) {
        proceedConnect();
      } else {
        cb(new Error('No acceptable auth method'));
      }
    });
  });

  sock.on('error', (e) => cb(e));
}

server.listen(PORT, () => {
  console.log(`Nemu Proxy Bridge running on port ${PORT}`);
});
