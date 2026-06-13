const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs-extra');

const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(__dirname, '../sessions');

// In-memory map: sessionId -> { socket, status, info, startTime }
const activeSessions = new Map();

// Callbacks for real-time updates (set by routes)
let onStatusChange = null;

function setStatusCallback(cb) {
  onStatusChange = cb;
}

function emitStatus(userId, sessionId, status, extra = {}) {
  if (onStatusChange) {
    onStatusChange(userId, sessionId, status, extra);
  }
}

// Get session folder path
function getSessionPath(userId, sessionId) {
  return path.join(SESSIONS_DIR, userId, sessionId);
}

// List all session IDs for a user
async function listUserSessions(userId) {
  const userDir = path.join(SESSIONS_DIR, userId);
  await fs.ensureDir(userDir);
  const dirs = await fs.readdir(userDir);
  const sessions = [];

  for (const dir of dirs) {
    const sessionPath = path.join(userDir, dir);
    const stat = await fs.stat(sessionPath);
    if (!stat.isDirectory()) continue;

    const infoFile = path.join(sessionPath, 'info.json');
    let info = { name: dir, number: null, createdAt: stat.birthtime };
    try {
      info = { ...info, ...JSON.parse(await fs.readFile(infoFile, 'utf-8')) };
    } catch {}

    const active = activeSessions.get(`${userId}:${dir}`);
    sessions.push({
      id: dir,
      ...info,
      status: active ? active.status : 'offline',
      uptime: active ? Date.now() - active.startTime : 0,
      msgCount: active ? (active.msgCount || 0) : 0,
    });
  }

  return sessions;
}

// Start a bot session
async function startSession(userId, sessionId, sessionName, io) {
  const key = `${userId}:${sessionId}`;
  const sessionPath = getSessionPath(userId, sessionId);
  await fs.ensureDir(sessionPath);

  // Save session info
  const infoFile = path.join(sessionPath, 'info.json');
  let existingInfo = {};
  try { existingInfo = JSON.parse(await fs.readFile(infoFile, 'utf-8')); } catch {}
  await fs.writeFile(infoFile, JSON.stringify({
    ...existingInfo,
    name: sessionName || existingInfo.name || sessionId,
    createdAt: existingInfo.createdAt || new Date().toISOString()
  }, null, 2));

  // If already running, return
  if (activeSessions.has(key)) {
    return { success: false, error: 'Session already running' };
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    logger,
    printQRInTerminal: false,
    browser: Browsers.baileys('Desktop'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    retryRequestDelayMs: 2000,
  });

  activeSessions.set(key, {
    socket: sock,
    status: 'connecting',
    startTime: Date.now(),
    msgCount: 0,
    sessionName: sessionName || sessionId
  });

  // Creds update
  sock.ev.on('creds.update', saveCreds);

  // Connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr, pairingCode } = update;
    const session = activeSessions.get(key);

    if (qr && session) {
      session.status = 'qr';
      session.qr = qr;
      activeSessions.set(key, session);
      emitStatus(userId, sessionId, 'qr', { qr });
    }

    if (pairingCode && session) {
      session.status = 'pairing';
      session.pairingCode = pairingCode;
      activeSessions.set(key, session);
      emitStatus(userId, sessionId, 'pairing', { pairingCode });
      console.log(`[Session ${sessionId}] Pairing Code: ${pairingCode}`);
    }

    if (connection === 'open') {
      if (session) {
        session.status = 'online';
        session.number = sock.user?.id?.split(':')[0] || null;
        session.qr = null;
        session.pairingCode = null;
        activeSessions.set(key, session);

        // Save number to info
        const infoFile = path.join(sessionPath, 'info.json');
        let info = {};
        try { info = JSON.parse(await fs.readFile(infoFile, 'utf-8')); } catch {}
        await fs.writeFile(infoFile, JSON.stringify({ ...info, number: session.number }, null, 2));

        emitStatus(userId, sessionId, 'online', { number: session.number });
        console.log(`[Session ${sessionId}] Connected as ${session.number}`);
      }
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      // 515 = stream error (temp ban), 401 = logged out, 440 = replaced
      const shouldReconnect = reason !== DisconnectReason.loggedOut
        && reason !== 440  // replaced by another client
        && reason !== 401; // unauthorized

      if (session) {
        session.status = shouldReconnect ? 'reconnecting' : 'offline';
        activeSessions.set(key, session);
        emitStatus(userId, sessionId, session.status, {});
      }

      if (shouldReconnect) {
        console.log(`[Session ${sessionId}] Reconnecting in 5s... reason: ${reason}`);
        setTimeout(() => startSession(userId, sessionId, sessionName, io), 5000);
      } else {
        console.log(`[Session ${sessionId}] Logged out.`);
        activeSessions.delete(key);
        emitStatus(userId, sessionId, 'offline', {});
      }
    }
  });

  // Count messages
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    const session = activeSessions.get(key);
    if (session) {
      session.msgCount = (session.msgCount || 0) + messages.length;
      activeSessions.set(key, session);
    }
  });

  return { success: true, sessionId };
}

// Request pairing code for a session
async function requestPairingCode(userId, sessionId, phoneNumber) {
  const key = `${userId}:${sessionId}`;
  const session = activeSessions.get(key);

  if (!session || !session.socket) {
    return { success: false, error: 'Session not started or not connecting' };
  }

  try {
    const code = await session.socket.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
    return { success: true, code };
  } catch (err) {
    console.error(`[Pairing] Error:`, err.message);
    return { success: false, error: err.message };
  }
}

// Stop a session
async function stopSession(userId, sessionId) {
  const key = `${userId}:${sessionId}`;
  const session = activeSessions.get(key);
  if (session?.socket) {
    try { await session.socket.logout(); } catch {}
    try { session.socket.ev.removeAllListeners(); } catch {}
  }
  activeSessions.delete(key);
  emitStatus(userId, sessionId, 'offline', {});
  return { success: true };
}

// Delete a session (stop + delete files)
async function deleteSession(userId, sessionId) {
  await stopSession(userId, sessionId);
  const sessionPath = getSessionPath(userId, sessionId);
  await fs.remove(sessionPath);
  return { success: true };
}

// Get live session info
function getSessionInfo(userId, sessionId) {
  const key = `${userId}:${sessionId}`;
  return activeSessions.get(key) || null;
}

// Boot all saved sessions on server start
async function bootAllSessions(io) {
  console.log('[SessionManager] Booting saved sessions...');
  const usersDir = SESSIONS_DIR;
  await fs.ensureDir(usersDir);

  let total = 0;
  const userDirs = await fs.readdir(usersDir).catch(() => []);
  for (const userId of userDirs) {
    const userPath = path.join(usersDir, userId);
    const stat = await fs.stat(userPath).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const sessionDirs = await fs.readdir(userPath).catch(() => []);
    for (const sessionId of sessionDirs) {
      const infoFile = path.join(userPath, sessionId, 'info.json');
      let info = { name: sessionId };
      try { info = JSON.parse(await fs.readFile(infoFile, 'utf-8')); } catch {}
      
      await startSession(userId, sessionId, info.name, io);
      total++;
    }
  }
  console.log(`[SessionManager] Booted ${total} sessions.`);
}

module.exports = {
  startSession,
  stopSession,
  deleteSession,
  listUserSessions,
  requestPairingCode,
  getSessionInfo,
  bootAllSessions,
  setStatusCallback,
  activeSessions
};
