const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('crypto').webcrypto ? 
  { v4: () => require('crypto').randomUUID() } : 
  { v4: () => require('crypto').randomUUID() };
const { findUser, createUser, findUserById } = require('../utils/userStore');
const { signToken, verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, password, ownerCode } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Optional: protect registration with an owner code
    const REGISTER_CODE = process.env.REGISTER_CODE;
    if (REGISTER_CODE && ownerCode !== REGISTER_CODE) {
      return res.status(403).json({ error: 'Invalid registration code' });
    }

    const existing = await findUser(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await createUser({
      id: require('crypto').randomUUID(),
      username,
      password: hashed,
      createdAt: new Date().toISOString(),
      sessions: []
    });

    const token = signToken({ id: user.id, username: user.username });
    res.status(201).json({
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await findUser(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ id: user.id, username: user.username });
    res.json({
      token,
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, username: user.username, createdAt: user.createdAt });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
