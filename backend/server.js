const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const botRoutes = require('./routes/bot');
const { verifyToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

// Socket.IO for real-time session status updates
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Make io available to routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', verifyToken, sessionRoutes);
app.use('/api/bot', verifyToken, botRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', bot: process.env.BOT_NAME || 'US BOT MD' });
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
