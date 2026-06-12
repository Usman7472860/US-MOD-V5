const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');

const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(__dirname, '../sessions');

function getSettingsPath(userId, sessionId) {
  return path.join(SESSIONS_DIR, userId, sessionId, 'settings.json');
}

const DEFAULT_SETTINGS = {
  autoRead: true,
  autoStatusView: true,
  antiDelete: true,
  viewOnceReveal: true,
  namazAlerts: true,
  jummaMubarak: true,
  publicMode: false,
  simAutoDetect: true,
  prefix: '.',
  botName: process.env.BOT_NAME || 'US BOT MD'
};

// GET /api/bot/:sessionId/settings
router.get('/:sessionId/settings', async (req, res) => {
  try {
    const filePath = getSettingsPath(req.user.id, req.params.sessionId);
    let settings = { ...DEFAULT_SETTINGS };
    try {
      const saved = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      settings = { ...settings, ...saved };
    } catch {}
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// PUT /api/bot/:sessionId/settings
router.put('/:sessionId/settings', async (req, res) => {
  try {
    const filePath = getSettingsPath(req.user.id, req.params.sessionId);
    const current = { ...DEFAULT_SETTINGS };
    try {
      const saved = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      Object.assign(current, saved);
    } catch {}

    const updated = { ...current, ...req.body };
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2));

    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
