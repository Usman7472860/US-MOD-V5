/**
 * Lightweight in-memory + file store
 * Keeps only recent messages to avoid memory bloat
 */
const fs = require('fs');
const path = require('path');

const STORE_FILE = path.join(__dirname, '../data/store.json');
const MAX_MESSAGES = 20;

let state = {
    contacts: {},
    messages: {},
    chats: {},
};

function readFromFile() {
    try {
        if (fs.existsSync(STORE_FILE)) {
            const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
            state = { contacts: {}, messages: {}, chats: {}, ...data };
        }
    } catch (e) {
        console.error('Store read error:', e.message);
    }
}

function writeToFile() {
    try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('Store write error:', e.message);
    }
}

function bind(ev) {
    ev.on('chats.set', ({ chats }) => {
        for (const c of chats) state.chats[c.id] = c;
    });
    ev.on('contacts.set', ({ contacts }) => {
        for (const c of contacts) state.contacts[c.id] = c;
    });
    ev.on('messages.upsert', ({ messages }) => {
        for (const msg of messages) {
            const jid = msg.key.remoteJid;
            if (!jid) continue;
            if (!state.messages[jid]) state.messages[jid] = [];
            state.messages[jid].push(msg);
            if (state.messages[jid].length > MAX_MESSAGES) {
                state.messages[jid] = state.messages[jid].slice(-MAX_MESSAGES);
            }
        }
    });
}

async function loadMessage(jid, id) {
    return (state.messages[jid] || []).find(m => m.key.id === id) || null;
}

module.exports = { readFromFile, writeToFile, bind, loadMessage, contacts: state.contacts };
