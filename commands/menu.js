const settings = require('../settings');
const fs = require('fs');
const path = require('path');

async function menuCommand(sock, chatId, message) {
    const prefix = settings.prefix || '.';

    const text = `
╔══════════════════╗
      🤖 *${settings.botName}*
      Version: *v${settings.version}*
      By: *${settings.botOwner}*
╚══════════════════╝

╔══════════════════╗
📋 *Commands*
║ ➤ ${prefix}menu / ${prefix}help
║ ➤ ${prefix}ping
╚══════════════════╝

> Prefix: \`${prefix}\`
`.trim();

    try {
        const imgPath = path.join(__dirname, '../assets/bot_image.jpg');
        if (fs.existsSync(imgPath)) {
            const img = fs.readFileSync(imgPath);
            await sock.sendMessage(chatId, {
                image: img,
                caption: text,
                contextInfo: {
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363161513685998@newsletter',
                        newsletterName: settings.botName,
                        serverMessageId: -1
                    }
                }
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text }, { quoted: message });
        }
    } catch (err) {
        console.error('menuCommand error:', err);
        await sock.sendMessage(chatId, { text }, { quoted: message });
    }
}

module.exports = menuCommand;
