const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config(); // fallback to local .env

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const botRoutes = require('./routes/bot');
const { verifyToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

// Frontend folder path (served from same Railway service)
const FRONTEND_DIR = path.join(__dirname, '../frontend');

// Socket.IO — allow Vercel frontend domain
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io available to routes
app.set('io', io);

// Middleware — CORS allow karo Vercel frontend ke liye
const allowedOrigins = [
  process.env.FRONTEND_URL,       // Vercel URL (env se)
  'http://localhost:3000',        // local dev
  'http://localhost:5500',        // VS Code live server
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return cb(null, true);
    }
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(FRONTEND_DIR));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', verifyToken, sessionRoutes);
app.use('/api/bot', verifyToken, botRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', bot: process.env.BOT_NAME || 'US BOT MD' });
});

// All non-API routes → serve index.html (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// Socket.IO auth + events
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));
  try {
    const { verifyTokenRaw } = require('./middleware/auth');
    const decoded = verifyTokenRaw(token);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.userId}`);
  socket.join(`user:${socket.userId}`);

  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.userId}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🤖 US BOT MD Backend running on port ${PORT}`);
  console.log(`📡 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📁 Sessions Dir: ${process.env.SESSIONS_DIR || './sessions'}\n`);
});

module.exports = { io };
