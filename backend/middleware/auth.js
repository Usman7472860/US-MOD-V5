const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'usbot_secret';

// Verify from HTTP header
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

// Verify raw (for socket.io)
function verifyTokenRaw(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Sign a new token
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { verifyToken, verifyTokenRaw, signToken };
