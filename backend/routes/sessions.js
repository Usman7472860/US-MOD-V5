const express = require('express');
const router = express.Router();
const {
  startSession,
  stopSession,
  deleteSession,
  listUserSessions,
  requestPairingCode,
  getSessionInfo,
  setStatusCallback
} = require('../utils/sessionManager');

// Wire up socket.io status broadcasts
function setupSocketCallback(io) {
  setStatusCallback((userId, sessionId, status, extra) => {
    io.to(`user:${userId}`).emit('session:status', { sessionId, status, ...extra });
  });
}

// GET /api/sessions — list all sessions for logged-in user
router.get('/', async (req, res) => {
  try {
    const sessions = await listUserSessions(req.user.id);
    res.json({ sessions });
  } catch (err) {
    console.error('[Sessions] List error:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// POST /api/sessions/create — create and start a new session
router.post('/create', async (req, res) => {
  try {
    const { sessionName } = req.body;
    if (!sessionName) return res.status(400).json({ error: 'sessionName required' });

    // Generate a unique session ID
    const sessionId = `sess_${Date.now()}`;
    const io = req.app.get('io');

    // Setup socket callback once
    setupSocketCallback(io);

    const result = await startSession(req.user.id, sessionId, sessionName, io);
    if (!result.success) return res.status(400).json({ error: result.error });

    res.status(201).json({ sessionId, sessionName, status: 'connecting' });
  } catch (err) {
    console.error('[Sessions] Create error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// POST /api/sessions/:sessionId/pair — request pairing code
router.post('/:sessionId/pair', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber required' });

    const result = await requestPairingCode(req.user.id, req.params.sessionId, phoneNumber);
    if (!result.success) return res.status(400).json({ error: result.error });

    res.json({ code: result.code });
  } catch (err) {
    console.error('[Sessions] Pairing error:', err);
    res.status(500).json({ error: 'Failed to get pairing code' });
  }
});

// GET /api/sessions/:sessionId — get single session status
router.get('/:sessionId', async (req, res) => {
  try {
    const info = getSessionInfo(req.user.id, req.params.sessionId);
    if (!info) return res.status(404).json({ error: 'Session not found or offline' });
    res.json({
      sessionId: req.params.sessionId,
      status: info.status,
      number: info.number,
      msgCount: info.msgCount,
      uptime: Date.now() - info.startTime
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get session info' });
  }
});

// POST /api/sessions/:sessionId/stop — disconnect (keep session files)
router.post('/:sessionId/stop', async (req, res) => {
  try {
    await stopSession(req.user.id, req.params.sessionId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop session' });
  }
});

// POST /api/sessions/:sessionId/restart — restart a stopped session
router.post('/:sessionId/restart', async (req, res) => {
  try {
    const { sessionName } = req.body;
    const io = req.app.get('io');
    setupSocketCallback(io);
    const result = await startSession(req.user.id, req.params.sessionId, sessionName || req.params.sessionId, io);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to restart session' });
  }
});

// DELETE /api/sessions/:sessionId — stop + delete session files
router.delete('/:sessionId', async (req, res) => {
  try {
    await deleteSession(req.user.id, req.params.sessionId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

module.exports = router;
module.exports.setupSocketCallback = setupSocketCallback;
