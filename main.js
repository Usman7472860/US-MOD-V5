const settings = require('./settings');
const pingCommand = require('./commands/ping');
const menuCommand = require('./commands/menu');

const PREFIX = settings.prefix || '.';

async function handleMessages(sock, chatUpdate) {
    try {
        const msg = chatUpdate.messages[0];
        if (!msg?.message) return;

        // Normalize message
        const msgType = Object.keys(msg.message)[0];
        const body =
            msgType === 'conversation' ? msg.message.conversation :
            msgType === 'extendedTextMessage' ? msg.message.extendedTextMessage.text :
            msgType === 'imageMessage' ? msg.message.imageMessage.caption || '' :
            msgType === 'videoMessage' ? msg.message.videoMessage.caption || '' : '';

        if (!body.startsWith(PREFIX)) return;

        const chatId = msg.key.remoteJid;
        const command = body.slice(PREFIX.length).trim().split(/\s+/)[0].toLowerCase();

        switch (command) {
            case 'ping':
                await pingCommand(sock, chatId, msg);
                break;
            case 'menu':
            case 'help':
                await menuCommand(sock, chatId, msg);
                break;
            default:
                // Unknown command — silently ignore
                break;
        }
    } catch (err) {
        console.error('handleMessages error:', err);
    }
}

module.exports = { handleMessages };
