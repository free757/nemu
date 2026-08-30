import { connect } from "cloudflare:sockets";

const USER_ID = "d342d11e-d424-4583-b36e-524ab1f0ade3";

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

class BufferedReader {
  constructor(reader) { this.r = reader; this.buf = new Uint8Array(0); }
  async readExact(n) {
    while (this.buf.length < n) {
      const { value, done } = await this.r.read();
      if (done) throw new Error("EOF during handshake");
      const chunk = toUint8(value);
      const next = new Uint8Array(this.buf.length + chunk.length);
      next.set(this.buf); next.set(chunk, this.buf.length);
      this.buf = next;
    }
    const out = this.buf.slice(0, n);
    this.buf = this.buf.slice(n);
    return out;
  }
  remainder() { return this.buf; }
}

function toUint8(v) {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (v && v.buffer) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  return new Uint8Array(v);
}
async function toAB(v) {
  if (v instanceof ArrayBuffer) return v;
  if (v && v.buffer) return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength);
  return new Blob([v]).arrayBuffer();
}

function safeClose(ws) {
  try { if (ws.readyState < 2) ws.close(); } catch (_) {}
}

export default {
  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade") || "";
    if (upgradeHeader.toLowerCase() === "websocket") {
      return handleWS(request);
    }
    return new Response("Nemu Proxy ✅ Zero-CPU Native Direct Stream Running", { status: 200 });
  },
};

async function handleWS(request) {
  const url = new URL(request.url);
  const socks5 = url.searchParams.get("ph")
    ? {
        host: url.searchParams.get("ph"),
        port: parseInt(url.searchParams.get("pp") || "1080"),
        user: url.searchParams.get("pu") || "",
        pass: url.searchParams.get("pw") || "",
      }
    : null;

  const [client, server] = Object.values(new WebSocketPair());
  server.accept();

  // Create stream from incoming WebSocket messages
  const readable = new ReadableStream({
    start(ctrl) {
      server.addEventListener("message", (e) => ctrl.enqueue(e.data));
      server.addEventListener("close", () => {
        try { ctrl.close(); } catch (_) {}
      });
      server.addEventListener("error", (e) => {
        try { ctrl.error(e); } catch (_) {}
      });
    },
  });

  handleVless(server, readable, socks5).catch(() => safeClose(server));
  return new Response(null, { status: 101, webSocket: client });
}

async function handleVless(ws, readable, socks5) {
  const reader = readable.getReader();
  const { value: first, done } = await reader.read();
  if (done || !first) return;

  const firstBuf = await toAB(first);
  const buf = new Uint8Array(firstBuf);
  if (buf.length < 24) throw new Error("too short");

  const parsedUUID = uuidStringify(buf, 1);
  if (parsedUUID !== USER_ID) throw new Error("invalid user: " + parsedUUID);

  const optLen = buf[17];
  const cmd    = buf[18 + optLen];
  const pIdx   = 19 + optLen;
  const port   = (buf[pIdx] << 8) | buf[pIdx + 1];
  const aType  = buf[pIdx + 2];
  let aIdx = pIdx + 3, addr = "";

  if (aType === 1) {
    addr = `${buf[aIdx]}.${buf[aIdx+1]}.${buf[aIdx+2]}.${buf[aIdx+3]}`;
    aIdx += 4;
  } else if (aType === 2) {
    const len = buf[aIdx++];
    addr = new TextDecoder().decode(buf.slice(aIdx, aIdx + len));
    aIdx += len;
  } else if (aType === 3) {
    const p = [];
    for (let i = 0; i < 8; i++) p.push(((buf[aIdx+i*2] << 8) | buf[aIdx+i*2+1]).toString(16));
    addr = p.join(":"); aIdx += 16;
  } else throw new Error("unknown aType " + aType);

  const vlessResp = new Uint8Array([buf[0], 0]);
  const payload   = firstBuf.slice(aIdx);

  // Release lock on reader so stream can be piped natively!
  reader.releaseLock();

  if (cmd === 2 && port === 53) {
    await handleDNS(ws, vlessResp, payload, readable, socks5);
    return;
  }
  if (cmd !== 1) throw new Error("unsupported cmd " + cmd);
  await handleTCP(ws, vlessResp, payload, readable, addr, port, socks5);
}

async function handleTCP(ws, vlessResp, payload, readable, addr, port, socks5) {
  const remote = socks5
    ? await connectViaSocks5(socks5, addr, port)
    : connect({ hostname: addr, port });

  // 1. Send initial handshake payload if present
  if (payload.byteLength > 0) {
    const w0 = remote.writable.getWriter();
    await w0.write(payload);
    w0.releaseLock();
  }

  let headerSent = false;
  
  // ⚡ 2. Remote -> WebSocket (Download Pipeline - 0 CPU)
  remote.readable.pipeTo(new WritableStream({
    write(chunk) {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!headerSent) {
        const chunkAB = chunk instanceof ArrayBuffer ? chunk : chunk.buffer;
        const m = new Uint8Array(vlessResp.length + chunk.byteLength);
        m.set(vlessResp);
        m.set(new Uint8Array(chunkAB, chunk.byteOffset || 0, chunk.byteLength), vlessResp.length);
        ws.send(m.buffer);
        headerSent = true;
      } else {
        ws.send(chunk);
      }
    },
    close() { safeClose(ws); },
    abort() { safeClose(ws); }
  })).catch(() => safeClose(ws));

  // ⚡ 3. WebSocket -> Remote (Upload Pipeline - Direct C++ Kernel Pipe)
  readable.pipeTo(new WritableStream({
    async write(chunk) {
      const w = remote.writable.getWriter();
      try {
        const ab = await toAB(chunk);
        await w.write(ab);
      } finally {
        w.releaseLock();
      }
    },
    close() {
      try { remote.writable.close(); } catch (_) {}
    },
    abort() {
      try { remote.writable.abort(); } catch (_) {}
    }
  })).catch(() => safeClose(ws));
}

async function connectViaSocks5(proxy, targetHost, targetPort) {
  const sock = connect({ hostname: proxy.host, port: proxy.port });
  const writer = sock.writable.getWriter();
  const br = new BufferedReader(sock.readable.getReader());

  await writer.write(new Uint8Array([0x05, 0x01, 0x02]));
  const g = await br.readExact(2);
  if (g[0] !== 0x05) throw new Error("Not SOCKS5");
  if (g[1] === 0xFF) throw new Error("No acceptable auth method");

  if (g[1] === 0x02) {
    const ub = new TextEncoder().encode(proxy.user);
    const pb = new TextEncoder().encode(proxy.pass);
    await writer.write(new Uint8Array([0x01, ub.length, ...ub, pb.length, ...pb]));
    const ar = await br.readExact(2);
    if (ar[1] !== 0x00) throw new Error("SOCKS5 auth failed: " + ar[1]);
  }

  const hb = new TextEncoder().encode(targetHost);
  await writer.write(new Uint8Array([
    0x05, 0x01, 0x00, 0x03, hb.length, ...hb,
    (targetPort >> 8) & 0xFF, targetPort & 0xFF,
  ]));

  const rep = await br.readExact(4);
  if (rep[1] !== 0x00) throw new Error("SOCKS5 CONNECT failed: " + rep[1]);
  if (rep[3] === 0x01) await br.readExact(6);
  else if (rep[3] === 0x03) { const l = (await br.readExact(1))[0]; await br.readExact(l + 2); }
  else if (rep[3] === 0x04) await br.readExact(18);

  writer.releaseLock();
  br.r.releaseLock();

  const leftover = br.remainder();
  if (leftover.length > 0) {
    const { readable, writable } = new TransformStream();
    const tw = writable.getWriter();
    await tw.write(leftover); tw.releaseLock();
    sock.readable.pipeTo(writable).catch(() => {});
    return { readable, writable: sock.writable };
  }
  return sock;
}

async function handleDNS(ws, vlessResp, firstPayload, readable, socks5) {
  let headerSent = false;

  async function sendDNS(pkt) {
    const dnsSock = socks5
      ? await connectViaSocks5(socks5, "8.8.8.8", 53)
      : connect({ hostname: "8.8.8.8", port: 53 });
    const msg = new Uint8Array(pkt.byteLength + 2);
    msg[0] = (pkt.byteLength >> 8) & 0xff; msg[1] = pkt.byteLength & 0xff;
    msg.set(new Uint8Array(pkt), 2);
    const dw = dnsSock.writable.getWriter();
    await dw.write(msg); dw.releaseLock();
    dnsSock.readable.pipeTo(new WritableStream({
      write(chunk) {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (!headerSent) {
          const chunkAB = chunk instanceof ArrayBuffer ? chunk : chunk.buffer;
          const m = new Uint8Array(vlessResp.length + chunk.byteLength);
          m.set(vlessResp);
          m.set(new Uint8Array(chunkAB, chunk.byteOffset || 0, chunk.byteLength), vlessResp.length);
          ws.send(m.buffer); headerSent = true;
        } else ws.send(chunk);
      },
    })).catch(() => {});
  }

  async function processChunks(ab) {
    const ua = new Uint8Array(ab);
    let off = 0;
    while (off + 2 <= ua.length) {
      const l = (ua[off] << 8) | ua[off + 1];
      if (off + 2 + l > ua.length) break;
      await sendDNS(ua.slice(off + 2, off + 2 + l).buffer);
      off += 2 + l;
    }
  }

  await processChunks(await toAB(firstPayload));
  
  const reader = readable.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    await processChunks(await toAB(value));
  }
}
