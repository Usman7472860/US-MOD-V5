/**
 * US MOD MD - Fresh WhatsApp Bot
 * Commands: .menu / .ping only
 */

require('./settings');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const chalk = require('chalk');
const readline = require('readline');
const path = require('path');
const { rmSync } = require('fs');

const settings = require('./settings');
const { handleMessages } = require('./main');
const store = require('./lib/store');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidDecode,
    jidNormalizedUser,
    delay,
    proto
} = require('@whiskeysockets/baileys');
const NodeCache = require('node-cache');
const pino = require('pino');

// Init store
store.readFromFile();
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10_000);

// Memory check
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024;
    if (used > 400) {
        console.log('⚠️ RAM too high, restarting...');
        process.exit(1);
    }
}, 30_000);

const ownerNumber = settings.ownerNumber || '923204822390';
const pairingCode = !!ownerNumber || process.argv.includes('--pairing-code');

const rl = process.stdin.isTTY
    ? readline.createInterface({ input: process.stdin, output: process.stdout })
    : null;

const question = (text) =>
    rl
        ? new Promise((resolve) => rl.question(text, resolve))
        : Promise.resolve(ownerNumber);

async function startBot() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state: authState, saveCreds } = await useMultiFileAuthState('./session');
        const msgRetryCounterCache = new NodeCache();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            auth: {
                creds: authState.creds,
                keys: makeCacheableSignalKeyStore(
                    authState.keys,
                    pino({ level: 'fatal' }).child({ level: 'fatal' })
                ),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                const jid = jidNormalizedUser(key.remoteJid);
                const msg = await store.loadMessage(jid, key.id);
                return msg?.message || '';
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        });

        sock.ev.on('creds.update', saveCreds);
        store.bind(sock.ev);

        // Handle pairing code
        if (pairingCode && !sock.authState.creds.registered) {
            let phoneNum = ownerNumber;
            if (!phoneNum) {
                phoneNum = await question(
                    chalk.bgBlack(chalk.greenBright('Enter your WhatsApp number (e.g. 923001234567): '))
                );
            }
            phoneNum = phoneNum.replace(/[^0-9]/g, '');

            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(phoneNum);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    console.log(chalk.bgGreen(chalk.black('Pairing Code: ')), chalk.white(code));
                } catch (e) {
                    console.error('Pairing code error:', e);
                }
            }, 3000);
        }

        // Connection update
        sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
            if (qr) console.log(chalk.yellow('📱 Scan QR code with WhatsApp.'));
            if (connection === 'connecting') console.log(chalk.yellow('🔄 Connecting...'));

            if (connection === 'open') {
                console.log(chalk.green(`✅ ${settings.botName} Connected!`));
                console.log(chalk.cyan(`> Owner: ${settings.ownerNumber}`));
                console.log(chalk.cyan(`> Version: v${settings.version}`));
                console.log(chalk.cyan(`> Commands: .ping, .menu`));
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

                if (loggedOut) {
                    try { rmSync('./session', { recursive: true, force: true }); } catch {}
                    console.log(chalk.red('Session logged out. Re-authenticate.'));
                    process.exit(0);
                }

                console.log(chalk.yellow('Reconnecting in 5s...'));
                await delay(5000);
                startBot();
            }
        });

        // Messages
        sock.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                if (chatUpdate.type !== 'notify') return;
                const msg = chatUpdate.messages[0];
                if (!msg.message) return;

                // Normalize ephemeral
                if (Object.keys(msg.message)[0] === 'ephemeralMessage') {
                    msg.message = msg.message.ephemeralMessage.message;
                }

                // Skip status broadcast
                if (msg.key?.remoteJid === 'status@broadcast') return;

                await handleMessages(sock, chatUpdate);
            } catch (err) {
                console.error('messages.upsert error:', err);
            }
        });

        return sock;
    } catch (err) {
        console.error('startBot error:', err);
        await delay(5000);
        startBot();
    }
}

startBot().catch(console.error);

process.on('uncaughtException', (err) => console.error('Uncaught:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));
