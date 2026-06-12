# 🤖 US BOT MD — Multi-Session WhatsApp Bot Platform

Premium dark-themed WhatsApp bot platform with multi-session support, pairing code system, and web dashboard.

---

## 📁 Structure

```
usbot-platform/
├── backend/
│   ├── server.js              ← Main Express + Socket.IO server
│   ├── middleware/auth.js     ← JWT auth middleware
│   ├── routes/
│   │   ├── auth.js            ← Login / Register
│   │   ├── sessions.js        ← Session CRUD + pairing
│   │   └── bot.js             ← Bot settings per session
│   └── utils/
│       ├── sessionManager.js  ← Core multi-session Baileys manager
│       └── userStore.js       ← File-based user DB
├── frontend/
│   └── index.html             ← Full dashboard (React, single file)
└── railway.toml               ← Railway deployment config
```

---

## ⚡ Local Setup

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your settings
npm run dev
```

### Frontend
Just open `frontend/index.html` in browser.
Or serve it:
```bash
npx serve frontend -p 3000
```

---

## 🚀 Railway Deployment

1. Push to GitHub
2. Create Railway project → Deploy from GitHub
3. Add environment variables:
   - `JWT_SECRET` = any long random string
   - `FRONTEND_URL` = your frontend URL
   - `PORT` = 3001
   - `SESSIONS_DIR` = /app/sessions
4. Add Railway Volume → mount at `/app/sessions`
5. Frontend: deploy `frontend/index.html` via Railway static or Vercel/Netlify

---

## 🌐 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login |
| GET  | /api/sessions | List all sessions |
| POST | /api/sessions/create | Create + start session |
| POST | /api/sessions/:id/pair | Get pairing code |
| POST | /api/sessions/:id/stop | Stop session |
| POST | /api/sessions/:id/restart | Restart session |
| DELETE | /api/sessions/:id | Delete session |
| GET  | /api/bot/:id/settings | Get settings |
| PUT  | /api/bot/:id/settings | Update settings |

---

## 📡 Real-time Events (Socket.IO)

Connect with JWT token:
```js
const socket = io('http://localhost:3001', {
  auth: { token: 'your_jwt_token' }
});

socket.on('session:status', ({ sessionId, status, pairingCode, number }) => {
  console.log(`Session ${sessionId} is now ${status}`);
  if (pairingCode) console.log(`Code: ${pairingCode}`);
});
```

---

## ✨ Features

- **Multi-session** — run unlimited bots simultaneously
- **Pairing code** — no QR scan, enter code in WhatsApp
- **Auto-reconnect** — sessions restart automatically on disconnect
- **Per-session settings** — toggle features per bot
- **Socket.IO** — real-time status updates in dashboard
- **Session persistence** — sessions survive server restarts
- **JWT auth** — secure login system
- **Islamic features** — Namaz alerts, Jumma Mubarak
- **Anti-delete, ViewOnce reveal, SIM detection** built-in
