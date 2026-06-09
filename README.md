# US MOD MD - Fresh Bot

Clean fresh bot with only 2 commands.

## Setup

```bash
npm install
npm start
```

## Commands

| Command | Description |
|---------|-------------|
| `.ping` | Bot speed & uptime check |
| `.menu` or `.help` | Show command list |

## Config

Edit `settings.js`:
- `botName` — Bot ka naam
- `ownerNumber` — Aapka number (country code ke sath, e.g. `923001234567`)
- `version` — Bot version
- `prefix` — Command prefix (default `.`)

## Deployment

- **Pairing:** `ownerNumber` set karo `settings.js` mein, bot automatically pairing code generate karega
- **Panel:** `npm run start:panel` use karo

## Adding Commands Later

1. `commands/` mein naya `.js` file banao
2. `main.js` mein import karo aur switch-case mein add karo
