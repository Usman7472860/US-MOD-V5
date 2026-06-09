const os = require('os');
const settings = require('../settings');

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    seconds %= 86400;
    const h = Math.floor(seconds / 3600);
    seconds %= 3600;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    let t = '';
    if (d > 0) t += `${d}d `;
    if (h > 0) t += `${h}h `;
    if (m > 0) t += `${m}m `;
    t += `${s}s`;
    return t.trim();
}

async function pingCommand(sock, chatId, message) {
    try {
        const start = Date.now();
        await sock.sendMessage(chatId, { text: '🏓 Pong!' }, { quoted: message });
        const ping = Math.round((Date.now() - start) / 2);
        const uptime = formatUptime(process.uptime());
        const ram = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

        const text = `
┏━━〔 🤖 *${settings.botName}* 〕━━┓
┃ 🚀 *Ping*    : ${ping} ms
┃ ⏱️ *Uptime*  : ${uptime}
┃ 💾 *RAM*     : ${ram} MB
┃ 📦 *Version* : v${settings.version}
┗━━━━━━━━━━━━━━━━━━━┛`.trim();

        await sock.sendMessage(chatId, { text }, { quoted: message });
    } catch (err) {
        console.error('pingCommand error:', err);
        await sock.sendMessage(chatId, { text: '❌ Ping failed.' });
    }
}

module.exports = pingCommand;
