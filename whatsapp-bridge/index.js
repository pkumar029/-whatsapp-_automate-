const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

function removeSessionLockfile() {
    const lockfilePath = path.join(__dirname, '.wwebjs_auth', 'session', 'lockfile');
    try {
        if (fs.existsSync(lockfilePath)) {
            fs.unlinkSync(lockfilePath);
            console.log('Deleted session lockfile successfully.');
        }
    } catch (err) {
        console.warn('Failed to delete session lockfile:', err.message);
    }
}

function clearSessionFiles() {
    const sessionDir = path.join(__dirname, '.wwebjs_auth');
    try {
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
            console.log('Cleared WhatsApp session files — next connect will require fresh QR/pairing.');
        }
    } catch (err) {
        console.warn('Failed to clear session files:', err.message);
    }
}

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception caught:', err.message);
    if (err.message && err.message.includes('EBUSY')) {
        console.log('Ignoring EBUSY lock error during session cleanup.');
    } else {
        console.error(err);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 7002;

app.use(cors());
app.use(express.json());

let client = null;
let clientStatus = 'disconnected'; // disconnected, connecting, connected, error
let qrCodeBase64 = null;
let connectedPhone = null;
let pairingCode = null;
let lastError = null;
let currentLinkMethod = 'qr';

// ─── SSE broadcasting ─────────────────────────────────────────
let sseClients = [];

function pushEvent(type, extra = {}) {
    const payload = JSON.stringify({ type, ...extra });
    sseClients = sseClients.filter(res => {
        try { res.write(`data: ${payload}\n\n`); return true; }
        catch (_) { return false; }
    });
}

// True only when the WhatsApp client AND its Puppeteer browser page are alive.
// client.pupPage can be null even when clientStatus === 'connected' if the
// browser process crashed — guard every API handler with this.
function isClientReady() {
    return clientStatus === 'connected' && client != null && client.pupPage != null;
}

// Called from catch blocks when an "evaluate" / pupPage error is detected.
// Marks the client as disconnected so the next guard check returns false.
function handleClientCrash(err) {
    if (err && err.message && (
        err.message.includes('evaluate') ||
        err.message.includes('pupPage') ||
        err.message.includes('Target closed') ||
        err.message.includes('Session closed')
    )) {
        console.warn('[bridge] Puppeteer page crash detected — resetting client status to disconnected');
        clientStatus = 'disconnected';
        client = null;
    }
}

// Initialize WhatsApp client
async function initClient(phoneForPairingCode = null, linkMethod = 'qr') {
    currentLinkMethod = linkMethod;
    const expectedPhone = phoneForPairingCode ? phoneForPairingCode.replace(/\D/g, '') : null;

    if (client) {
        try {
            console.log('Destroying existing client browser session...');
            await client.destroy();
            console.log('Existing client destroyed.');
        } catch (e) {
            console.error('Error destroying client:', e);
        }
    }

    // Clean lock file before restarting to prevent EBUSY/locked session folder errors
    removeSessionLockfile();

    clientStatus = 'connecting';
    qrCodeBase64 = null;
    connectedPhone = null;
    pairingCode = null;
    lastError = null;

    console.log('Initializing whatsapp-web.js client...');
    if (phoneForPairingCode) {
        console.log(`Client will request Pairing Code / verify login for: ${phoneForPairingCode} using method: ${linkMethod}`);
    }
    
    // Detect system Chrome/Chromium across Windows, Linux (Pi), macOS
    const chromiumPaths = [
        // Windows — Chrome
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
        // Windows — Edge (fallback)
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        // Linux / Raspberry Pi
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome',
        '/snap/bin/chromium',
        // macOS
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];
    const fs2 = require('fs');
    const executablePath = chromiumPaths.find(p => p && fs2.existsSync(p)) || undefined;
    if (executablePath) console.log(`Using system browser: ${executablePath}`);
    else console.log('Using Puppeteer bundled Chromium');

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
            headless: true,
            executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        }
    });

    client.on('qr', async (qr) => {
        console.log('QR Code received, converting to base64...');
        try {
            // Convert QR code to base64 image URL (PNG)
            const qrDataUrl = await QRCode.toDataURL(qr);
            // Extract the base64 part of the data URL (remove "data:image/png;base64,")
            qrCodeBase64 = qrDataUrl.split(',')[1];
            clientStatus = 'connecting';

            // Generate pairing code if phone number and otp method are specified (regenerate on QR refreshes)
            if (linkMethod === 'otp' && phoneForPairingCode) {
                console.log(`Requesting pairing code for ${phoneForPairingCode}...`);
                try {
                    const cleanPhone = phoneForPairingCode.replace(/\D/g, '');
                    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
                        throw new Error('Phone number must be between 8 and 15 digits (including country code)');
                    }
                    const code = await client.requestPairingCode(cleanPhone);
                    // Format pairing code beautifully (e.g. ABCD-EFGH)
                    pairingCode = code ? (code.substring(0, 4) + '-' + code.substring(4)) : code;
                    console.log(`Pairing code received: ${pairingCode}`);
                    lastError = null;
                } catch (codeErr) {
                    console.error('Error generating pairing code:', codeErr);
                    lastError = `Failed to generate pairing code: ${codeErr.message}`;
                }
            }

            // Push QR to all SSE listeners instantly
            pushEvent('qr_ready', { qr: qrCodeBase64, pairing_code: pairingCode });
        } catch (err) {
            console.error('Failed to generate QR base64:', err);
        }
    });

    client.on('ready', async () => {
        console.log('WhatsApp Client is ready!');
        const actualPhone = (client.info && client.info.wid) ? client.info.wid.user : (client.info ? client.info.phone : expectedPhone);

        // Security Verification: Ensure actual connected phone number matches expected phone number
        const shouldVerify = expectedPhone &&
                             actualPhone &&
                             currentLinkMethod !== 'qr' &&
                             expectedPhone.length >= 8;
        if (shouldVerify) {
            const cleanActual = actualPhone.replace(/\D/g, '');
            const isMatch = cleanActual === expectedPhone ||
                            cleanActual.endsWith(expectedPhone) ||
                            expectedPhone.endsWith(cleanActual);
            if (!isMatch) {
                console.error(`Security alert: Connected phone number (${cleanActual}) does not match expected phone number (${expectedPhone}). Logging out...`);
                clientStatus = 'disconnected';
                qrCodeBase64 = null;
                pairingCode = null;
                connectedPhone = null;
                lastError = `Security Verification Failed: Connected account (${cleanActual}) does not match the requested phone number (${expectedPhone}).`;
                pushEvent('error', { message: lastError });
                try {
                    await client.logout();
                    await client.destroy();
                } catch (logoutErr) {
                    console.error('Error logging out after security failure:', logoutErr);
                    try {
                        await client.destroy();
                    } catch (dErr) {}
                }
                client = null;
                return;
            }
        }

        clientStatus = 'connected';
        qrCodeBase64 = null;
        pairingCode = null;
        connectedPhone = actualPhone;
        pushEvent('connected', { phone: connectedPhone });
    });

    client.on('authenticated', () => {
        console.log('WhatsApp Client authenticated.');
        pushEvent('authenticated');
    });

    client.on('auth_failure', (msg) => {
        console.error('Authentication failure:', msg);
        clientStatus = 'disconnected';
        lastError = `Auth failure: ${msg}`;
        qrCodeBase64 = null;
        pairingCode = null;
        pushEvent('error', { message: lastError });
    });

    client.on('disconnected', (reason) => {
        console.log('Client was logged out or disconnected:', reason);
        clientStatus = 'disconnected';
        connectedPhone = null;
        qrCodeBase64 = null;
        pairingCode = null;
        pushEvent('disconnected', { reason });
    });

    client.on('message', async (msg) => {
        try {
            let phone = msg.from;
            let name = '';
            let tags = [];

            const isGroup = msg.from.endsWith('@g.us');
            if (isGroup) {
                phone = msg.from; // Keep group JID as phone
                tags = ['Group'];
                try {
                    const chat = await msg.getChat();
                    name = chat.name || ('Group ' + msg.from.split('@')[0]);
                } catch (chatErr) {
                    console.warn('Failed to get chat details for group message:', chatErr.message);
                    name = 'Group ' + msg.from.split('@')[0];
                }
            } else {
                const num = msg.from.split('@')[0];
                phone = '+' + num;
                try {
                    const contact = await msg.getContact();
                    name = contact.name || contact.pushname || phone;
                } catch (contactErr) {
                    console.warn('Failed to get contact details for user message:', contactErr.message);
                    name = phone;
                }
            }

            console.log(`Inbound message from ${name} (${phone}): ${msg.body}`);
            const content = msg.body;
            const messageId = msg.id._serialized;
            
            await fetch('http://localhost:7003/api/v1/whatsapp/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, content, name, tags, messageId })
            });
        } catch (err) {
            console.error('Failed to forward inbound message to webhook:', err.message);
        }
    });

    client.initialize().catch(err => {
        console.error('Initialization error:', err);
        clientStatus = 'disconnected';
        lastError = err.message;
        pairingCode = null;
    });
}

// REST Endpoints
app.get('/status', (req, res) => {
    res.json({
        status: clientStatus,
        qr: qrCodeBase64,
        phone: connectedPhone,
        pairing_code: pairingCode,
        error: lastError
    });
});

// SSE stream — pushes real-time events to listeners (frontend login flow)
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send current state immediately so the client knows where things stand
    const snapshot = JSON.stringify({
        type: 'status',
        bridge_status: clientStatus,
        qr: qrCodeBase64,
        phone: connectedPhone,
        pairing_code: pairingCode,
    });
    res.write(`data: ${snapshot}\n\n`);

    sseClients.push(res);
    req.on('close', () => {
        sseClients = sseClients.filter(c => c !== res);
    });
});

app.post('/connect', async (req, res) => {
    if (clientStatus === 'connected') {
        return res.json({ success: true, message: 'Already connected', phone: connectedPhone });
    }
    const { phone, linkMethod } = req.body;
    await initClient(phone, linkMethod);
    res.json({ success: true, message: 'Initialization started' });
});

app.post('/disconnect', async (req, res) => {
    if (!client) {
        clientStatus = 'disconnected';
        return res.json({ success: true, message: 'No client session to disconnect' });
    }

    try {
        console.log('Disconnecting/Logging out client...');
        if (clientStatus === 'connected') {
            await client.logout();
        }
        await client.destroy();
    } catch (e) {
        console.warn('Error during logout/destroy:', e);
        try {
            await client.destroy();
        } catch (ee) {}
    }

    client = null;
    clientStatus = 'disconnected';
    qrCodeBase64 = null;
    connectedPhone = null;
    // Session files are intentionally kept so the same account can reconnect without a new QR.
    // Call POST /clear-session explicitly when switching to a different WhatsApp number.
    res.json({ success: true, message: 'Client disconnected successfully' });
});

// Explicitly wipe saved session so next connect requires a fresh QR / pairing code.
// Use this when the user wants to switch to a different WhatsApp number.
app.post('/clear-session', (req, res) => {
    clearSessionFiles();
    res.json({ success: true, message: 'Session cleared — next connect will require QR or pairing code' });
});

// Resolve a phone number or stored JID to a sendable WhatsApp JID.
// Handles @c.us stored in DB, raw numbers, @g.us groups, and @lid multi-device contacts.
async function resolveJid(phone) {
    // Groups / broadcast / status — pass through unchanged
    if (phone.includes('@g.us') || phone.includes('@broadcast') || phone.includes('@newsletter')) {
        return phone;
    }

    // Strip any @c.us or @lid suffix stored in the DB so we get just the number
    let raw = phone.replace(/@\S+$/, '').replace(/[+\s\-()]/g, '');
    
    // Automatically prepend Indian country code '91' for 10-digit numbers
    if (raw.length === 10) {
        raw = '91' + raw;
    }

    try {
        const numberId = await client.getNumberId(raw);
        if (numberId && numberId._serialized) {
            return numberId._serialized;
        }
    } catch (_) { /* fall through to @c.us default */ }

    return `${raw}@c.us`;
}

app.post('/send', async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) {
        return res.status(400).json({ success: false, error: 'Phone and message are required' });
    }

    if (!isClientReady()) {
        return res.status(400).json({ success: false, error: 'WhatsApp client is not connected' });
    }

    try {
        const jid = await resolveJid(phone);
        console.log(`Sending to ${jid}: "${message.substring(0, 40)}..."`);

        let msg;
        try {
            msg = await client.sendMessage(jid, message);
        } catch (sendErr) {
            // "No LID for user" means WhatsApp needs the @lid JID, not @c.us.
            // Re-resolve without filtering and retry once.
            if (sendErr.message && sendErr.message.includes('No LID')) {
                const raw = jid.replace(/@\S+$/, '');
                const numberId = await client.getNumberId(raw);
                if (numberId && numberId._serialized && numberId._serialized !== jid) {
                    console.log(`LID retry: ${jid} → ${numberId._serialized}`);
                    msg = await client.sendMessage(numberId._serialized, message);
                } else {
                    throw sendErr;
                }
            } else {
                throw sendErr;
            }
        }

        res.json({ success: true, message_id: msg.id.id, status: 'sent' });
    } catch (err) {
        handleClientCrash(err);
        console.error('Failed to send message:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/contacts', async (req, res) => {
    if (!isClientReady()) {
        return res.status(400).json({ success: false, error: 'WhatsApp client is not connected' });
    }

    try {
        console.log('Fetching contacts and chats from whatsapp-web.js client...');
        const contacts = await client.getContacts();
        let chats = [];
        try {
            chats = await client.getChats();
        } catch (chatErr) {
            console.warn('Failed to fetch active chats:', chatErr.message);
        }
        
        const contactMap = new Map();

        // 1. Process contacts
        for (const c of contacts) {
            if (c.id && c.id._serialized) {
                contactMap.set(c.id._serialized, c);
            }
        }

        // 2. Merge active chats — mark them so we know they have real conversations
        for (const chat of chats) {
            if (chat.id && chat.id._serialized) {
                if (!contactMap.has(chat.id._serialized)) {
                    contactMap.set(chat.id._serialized, {
                        id: chat.id,
                        name: chat.name,
                        isGroup: chat.isGroup,
                        isUser: chat.id.server === 'c.us',
                        number: chat.id.user,
                        fromActiveChat: true   // came from an actual conversation
                    });
                } else {
                    // Tag the existing contact entry as active chat too
                    const existing = contactMap.get(chat.id._serialized);
                    existing.fromActiveChat = true;
                    contactMap.set(chat.id._serialized, existing);
                }
            }
        }

        // 3. Map to clean format and classify type
        const cleanContacts = Array.from(contactMap.values())
            .filter(c => {
                if (!c.id || !c.id._serialized) return false;
                const server = c.id.server || '';
                const jid = c.id._serialized;

                // Exclude WhatsApp-internal non-contact servers
                if (server === 'lid') return false;        // device-linked IDs (fake phone numbers)
                if (server === 'newsletter') return false; // WhatsApp Channels
                if (server === 'broadcast') return false;  // broadcast lists

                const isGroup = c.isGroup || jid.endsWith('@g.us');
                if (isGroup) return true;

                // Include ALL valid WhatsApp contacts — address-book AND chat-only.
                // is_my_contact flag in the response lets the backend decide how to classify.
                return true;
            })
            .map(c => {
                const jid = c.id._serialized;
                const isGroup = c.isGroup || jid.endsWith('@g.us');
                let type = 'User';
                if (isGroup) {
                    type = 'Group';
                }

                let phone = jid;
                if (type === 'User') {
                    const num = c.number || (c.id && c.id.user);
                    phone = num ? '+' + num : jid;
                }

                let name = c.name || c.pushname || c.shortName || c.verifiedName;
                if (!name) {
                    if (type === 'Group') {
                        name = 'Unnamed Group (' + jid.split('@')[0] + ')';
                    } else {
                        name = c.number || (c.id && c.id.user) || 'Unnamed Contact';
                    }
                }

                return {
                    name,
                    phone,
                    type,
                    is_my_contact: c.isMyContact === true,  // true = saved in phone address book
                };
            })
            .filter(c => {
                if (!c.phone || !c.name) return false;
                if (c.type === 'Group') return true;
                // User contacts: must be E.164 format with 7–13 digits
                // Numbers longer than 13 digits are WhatsApp-internal pseudo-IDs
                return /^\+\d{7,13}$/.test(c.phone);
            });
        
        console.log(`Fetched ${cleanContacts.length} total contacts (including groups and broadcasts)`);
        res.json({
            success: true,
            contacts: cleanContacts
        });
    } catch (err) {
        handleClientCrash(err);
        console.error('Failed to fetch contacts:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /chats — returns real WhatsApp chat list with last message + unread count
app.get('/chats', async (req, res) => {
    if (!isClientReady()) {
        return res.status(400).json({ success: false, error: 'WhatsApp client is not connected' });
    }
    try {
        console.log('Fetching WhatsApp chat list...');
        const chats = await client.getChats();
        const result = chats.slice(0, 150).map(chat => {
            const isGroup = chat.isGroup;
            const phone = isGroup ? chat.id._serialized : ('+' + chat.id.user);
            const lm = chat.lastMessage;
            let lastMsgType = 'chat';
            let lastMsgAuthor = null;
            if (lm) {
                lastMsgType = lm.type || 'chat';
                if (isGroup) {
                    if (lm.fromMe) {
                        lastMsgAuthor = 'You';
                    } else if (lm.author) {
                        lastMsgAuthor = lm.author.split('@')[0];
                    }
                }
            }
            return {
                id: chat.id._serialized,
                name: chat.name || phone,
                phone,
                isGroup,
                type: isGroup ? 'Group' : 'User',
                lastMessage: lm?.body || '',
                lastMessageTime: lm?.timestamp ? lm.timestamp * 1000 : null,
                lastMessageFromMe: lm?.fromMe || false,
                lastMessageType: lastMsgType,
                lastMessageAuthor: lastMsgAuthor,
                unreadCount: chat.unreadCount || 0,
                pinned: chat.pinned || false,
                archived: chat.archived || false,
                participantCount: isGroup ? (chat.participants?.length || 0) : 0
            };
        });
        res.json({ success: true, chats: result });
    } catch (e) {
        handleClientCrash(e);
        console.error('Failed to fetch chats:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /group-members?groupId=... — returns participants of a WhatsApp group
app.get('/group-members', async (req, res) => {
    if (!isClientReady()) {
        return res.status(400).json({ success: false, error: 'WhatsApp client is not connected' });
    }
    const { groupId } = req.query;
    if (!groupId) return res.status(400).json({ success: false, error: 'groupId required' });
    try {
        const chat = await client.getChatById(groupId);
        if (!chat.isGroup) return res.status(400).json({ success: false, error: 'Not a group chat' });
        const members = (chat.participants || []).map(p => ({
            id: p.id._serialized,
            phone: '+' + p.id.user,
            isAdmin: p.isAdmin || false,
            isSuperAdmin: p.isSuperAdmin || false
        }));
        res.json({ success: true, groupId, name: chat.name, memberCount: members.length, members });
    } catch (e) {
        console.error('Failed to fetch group members:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ─── Phase 12: Group Management ──────────────────────────────────

app.post('/group/create', async (req, res) => {
    if (!isClientReady()) return res.status(400).json({ success: false, error: 'Not connected' });
    const { name, participants } = req.body;
    if (!name || !participants?.length) return res.status(400).json({ success: false, error: 'name and participants required' });
    try {
        const ids = participants.map(p => p.replace(/[+\s\-()]/g, '') + '@c.us');
        const result = await client.createGroup(name, ids);
        res.json({ success: true, groupId: result.gid._serialized, name });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/group/add-members', async (req, res) => {
    if (!isClientReady()) return res.status(400).json({ success: false, error: 'Not connected' });
    const { groupId, participants } = req.body;
    try {
        const chat = await client.getChatById(groupId);
        const ids = participants.map(p => p.replace(/[+\s\-()]/g, '') + '@c.us');
        await chat.addParticipants(ids);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/group/remove-member', async (req, res) => {
    if (!isClientReady()) return res.status(400).json({ success: false, error: 'Not connected' });
    const { groupId, participantId } = req.body;
    try {
        const chat = await client.getChatById(groupId);
        await chat.removeParticipants([participantId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/group/promote', async (req, res) => {
    if (!isClientReady()) return res.status(400).json({ success: false, error: 'Not connected' });
    const { groupId, participantId } = req.body;
    try {
        const chat = await client.getChatById(groupId);
        await chat.promoteParticipants([participantId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/group/demote', async (req, res) => {
    if (!isClientReady()) return res.status(400).json({ success: false, error: 'Not connected' });
    const { groupId, participantId } = req.body;
    try {
        const chat = await client.getChatById(groupId);
        await chat.demoteParticipants([participantId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/group/rename', async (req, res) => {
    if (!isClientReady()) return res.status(400).json({ success: false, error: 'Not connected' });
    const { groupId, name } = req.body;
    try {
        const chat = await client.getChatById(groupId);
        await chat.setSubject(name);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/group/set-description', async (req, res) => {
    if (!isClientReady()) return res.status(400).json({ success: false, error: 'Not connected' });
    const { groupId, description } = req.body;
    try {
        const chat = await client.getChatById(groupId);
        await chat.setDescription(description);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/group/invite-link', async (req, res) => {
    if (!isClientReady()) return res.status(400).json({ success: false, error: 'Not connected' });
    const { groupId } = req.query;
    try {
        const chat = await client.getChatById(groupId);
        const code = await chat.getInviteCode();
        res.json({ success: true, link: `https://chat.whatsapp.com/${code}` });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/group/leave', async (req, res) => {
    if (!isClientReady()) return res.status(400).json({ success: false, error: 'Not connected' });
    const { groupId } = req.body;
    try {
        const chat = await client.getChatById(groupId);
        await chat.leave();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ─── Phase 13: Status ──────────────────────────────────────────────

app.get('/status/list', async (req, res) => {
    if (!isClientReady()) return res.status(400).json({ success: false, error: 'Not connected' });
    try {
        const contacts = await client.getContacts();
        const myContacts = contacts.filter(c => c.isMyContact && c.id && c.id.server === 'c.us').slice(0, 40);
        const statuses = [];
        for (const contact of myContacts) {
            try {
                const about = await contact.getAbout();
                statuses.push({
                    id: contact.id._serialized,
                    name: contact.name || contact.pushname || ('+' + contact.number),
                    phone: '+' + contact.number,
                    about: about || null,
                });
            } catch {
                statuses.push({
                    id: contact.id._serialized,
                    name: contact.name || contact.pushname || ('+' + contact.number),
                    phone: '+' + contact.number,
                    about: null,
                });
            }
        }
        res.json({ success: true, statuses });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/status/post', async (req, res) => {
    if (!isClientReady()) return res.status(400).json({ success: false, error: 'Not connected' });
    const { text, mediaBase64, mediaType, caption } = req.body;
    try {
        if (mediaBase64 && mediaType) {
            // Image / video status
            const { MessageMedia } = await import('whatsapp-web.js');
            const media = new MessageMedia(mediaType, mediaBase64);
            const opts = caption ? { caption } : {};
            await client.sendMessage('status@broadcast', media, opts);
        } else {
            if (!text) return res.status(400).json({ success: false, error: 'text or mediaBase64 required' });
            await client.sendMessage('status@broadcast', text);
        }
        res.json({ success: true, message: 'Status posted' });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /profile-pic?phone=+91xxxxx — returns WhatsApp profile picture URL
app.get('/profile-pic', async (req, res) => {
    const { phone } = req.query;
    if (!phone || !isClientReady()) {
        return res.json({ success: false, url: null });
    }
    try {
        let jid;
        if (phone.includes('@')) {
            jid = phone;
        } else {
            const clean = phone.replace(/[+\s\-()]/g, '');
            jid = `${clean}@c.us`;
        }
        const url = await client.getProfilePicUrl(jid);
        res.json({ success: true, url: url || null });
    } catch (e) {
        // Contact has no profile pic or privacy settings block it
        res.json({ success: false, url: null });
    }
});

// GET /my-profile — returns the connected account's own WhatsApp profile
app.get('/my-profile', async (req, res) => {
    if (!isClientReady()) {
        return res.status(400).json({ success: false, error: 'Not connected' });
    }
    try {
        const info = client.info;
        const wid = info && info.wid ? info.wid : null;
        const phone = wid ? ('+' + wid.user) : connectedPhone;
        const name = (info && info.pushname) || phone;

        let profilePic = null;
        try {
            const jid = wid ? wid._serialized : (phone.replace('+', '') + '@c.us');
            profilePic = await client.getProfilePicUrl(jid);
        } catch (_) { /* no pic or private */ }

        res.json({
            success: true,
            name,
            phone,
            profile_pic: profilePic || null,
            wid: wid ? wid._serialized : null,
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /sync-messages — full chat history for all chats (used on login to backfill DB)
app.get('/contacts/count', async (req, res) => {
    if (!isClientReady()) {
        return res.status(400).json({ success: false, count: 0, error: 'Not connected' });
    }
    try {
        const contacts = await client.getContacts();
        const chats = await client.getChats();
        const total = new Set([
            ...contacts.filter(c => c.id && c.id._serialized && c.id.server !== 'lid' && c.id.server !== 'newsletter' && c.id.server !== 'broadcast').map(c => c.id._serialized),
            ...chats.filter(c => c.id && c.id._serialized).map(c => c.id._serialized),
        ]).size;
        res.json({ success: true, count: total });
    } catch (e) {
        res.json({ success: false, count: 0, error: e.message });
    }
});

// GET /contacts/sync-stream — SSE endpoint that streams sync progress while returning contacts in batches
app.get('/contacts/sync-stream', async (req, res) => {
    if (!isClientReady()) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'WhatsApp client is not connected' })}\n\n`);
        res.end();
        return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (data) => {
        try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (_) {}
    };

    try {
        send({ type: 'progress', phase: 'fetching', message: 'Fetching contacts from WhatsApp...' });

        const contacts = await client.getContacts();
        let chats = [];
        try { chats = await client.getChats(); } catch (_) {}

        send({ type: 'progress', phase: 'fetching', message: `Got ${contacts.length} address-book entries + ${chats.length} chats` });

        // Build unified contact map (same logic as /contacts endpoint)
        const contactMap = new Map();
        for (const c of contacts) {
            if (c.id && c.id._serialized) contactMap.set(c.id._serialized, c);
        }
        for (const chat of chats) {
            if (chat.id && chat.id._serialized) {
                if (!contactMap.has(chat.id._serialized)) {
                    contactMap.set(chat.id._serialized, { id: chat.id, name: chat.name, isGroup: chat.isGroup, isUser: chat.id.server === 'c.us', number: chat.id.user, fromActiveChat: true });
                } else {
                    const ex = contactMap.get(chat.id._serialized);
                    ex.fromActiveChat = true;
                    contactMap.set(chat.id._serialized, ex);
                }
            }
        }

        const allEntries = Array.from(contactMap.values()).filter(c => {
            if (!c.id || !c.id._serialized) return false;
            const server = c.id.server || '';
            if (server === 'lid' || server === 'newsletter' || server === 'broadcast') return false;
            return true;
        });

        const total = allEntries.length;
        send({ type: 'progress', phase: 'processing', message: `Processing ${total} contacts...`, total, current: 0 });

        const BATCH_SIZE = 50;
        const VALID_PHONE_RE = /^\+\d{7,13}$/;
        let processed = 0;

        for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
            const batch = allEntries.slice(i, i + BATCH_SIZE).map(c => {
                const jid = c.id._serialized;
                const isGroup = c.isGroup || jid.endsWith('@g.us');
                const type = isGroup ? 'Group' : 'User';
                const num = c.number || (c.id && c.id.user);
                let phone = type === 'User' ? (num ? '+' + num : jid) : jid;
                let name = c.name || c.pushname || c.shortName || c.verifiedName;
                if (!name) name = isGroup ? 'Unnamed Group (' + jid.split('@')[0] + ')' : (num || 'Unnamed Contact');
                return { name, phone, type, is_my_contact: c.isMyContact === true };
            }).filter(c => {
                if (!c.phone || !c.name) return false;
                if (c.type === 'Group') return true;
                return VALID_PHONE_RE.test(c.phone);
            });

            processed += BATCH_SIZE;
            if (processed > total) processed = total;

            send({ type: 'batch', contacts: batch, current: processed, total, phase: 'syncing' });

            // Small delay to avoid flooding
            await new Promise(r => setTimeout(r, 50));
        }

        send({ type: 'complete', message: `Sync complete: ${total} contacts processed`, total });
    } catch (err) {
        send({ type: 'error', message: err.message });
    } finally {
        res.end();
    }
});

app.get('/sync-messages', async (req, res) => {
    if (!isClientReady()) {
        return res.json({ success: false, chats: [], error: 'Not connected' });
    }
    const msgLimit = parseInt(req.query.msgLimit) || 100;   // messages per chat
    const chatLimit = parseInt(req.query.chatLimit) || 500; // all chats by default
    try {
        const VALID_PHONE_RE = /^\+\d{7,13}$/;
        const chats = await client.getChats();
        const result = [];
        for (const chat of chats.slice(0, chatLimit)) {
            let phone, name;
            if (chat.isGroup) {
                phone = chat.id._serialized;
                name = chat.name;
            } else {
                // Skip system / device JIDs
                const server = chat.id.server;
                if (server === 'lid' || server === 'newsletter' || server === 'broadcast') continue;
                phone = '+' + chat.id.user;
                // Skip numbers with wrong digit count (pseudo-IDs, test numbers, etc.)
                if (!VALID_PHONE_RE.test(phone)) continue;
                try {
                    const contact = await chat.getContact();
                    name = contact.name || contact.pushname || phone;
                } catch {
                    name = phone;
                }
            }

            let msgs = [];
            try {
                msgs = await chat.fetchMessages({ limit: msgLimit });
            } catch (fetchErr) {
                console.warn(`Could not fetch messages for ${phone}: ${fetchErr.message}`);
            }

            const messages = msgs
                .filter(m => m.body)
                .map(m => ({
                    id: m.id.id,
                    body: m.body,
                    fromMe: m.fromMe,
                    timestamp: m.timestamp * 1000,
                    type: m.type,
                }));

            if (messages.length > 0) {
                result.push({ phone, name, isGroup: chat.isGroup, messages });
            }
        }
        res.json({ success: true, chats: result });
    } catch (e) {
        handleClientCrash(e);
        console.error('sync-messages error:', e.message);
        res.json({ success: false, chats: [], error: e.message });
    }
});

// GET /recent-messages — returns recent inbound messages across all chats
app.get('/recent-messages', async (req, res) => {
    if (!isClientReady()) {
        return res.json({ success: false, messages: [] });
    }
    try {
        const chats = await client.getChats();
        const recent = [];
        // Collect last message from each chat
        for (const chat of chats.slice(0, 30)) {
            const msgs = await chat.fetchMessages({ limit: 1 });
            if (msgs.length > 0) {
                const m = msgs[0];
                if (!m.fromMe) {
                    const num = chat.id.user;
                    const phone = chat.isGroup ? chat.id._serialized : '+' + num;
                    recent.push({
                        id: m.id.id,
                        phone,
                        name: chat.name || phone,
                        body: m.body,
                        timestamp: m.timestamp * 1000
                    });
                }
            }
        }
        res.json({ success: true, messages: recent });
    } catch (e) {
        res.json({ success: false, messages: [] });
    }
});

app.post('/send-media', async (req, res) => {
    const { phone, mediaUrl, caption } = req.body;
    if (!phone || !mediaUrl) {
        return res.status(400).json({ success: false, error: 'Phone and mediaUrl are required' });
    }
    if (!isClientReady()) {
        return res.status(400).json({ success: false, error: 'WhatsApp client is not connected' });
    }
    try {
        const jid = await resolveJid(phone);
        console.log(`Sending media ${mediaUrl} to ${jid}...`);
        
        const { MessageMedia } = await import('whatsapp-web.js');
        
        let media;
        if (mediaUrl.startsWith('data:')) {
            const matches = mediaUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                media = new MessageMedia(matches[1], matches[2]);
            } else {
                throw new Error('Invalid base64 mediaUrl format');
            }
        } else {
            media = await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true });
        }
        
        const opts = caption ? { caption } : {};
        const msg = await client.sendMessage(jid, media, opts);
        res.json({ success: true, message_id: msg.id.id, status: 'sent' });
    } catch (err) {
        console.error('Failed to send media:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/react', async (req, res) => {
    const { messageId, emoji } = req.body;
    if (!messageId || !emoji) {
        return res.status(400).json({ success: false, error: 'messageId and emoji are required' });
    }
    if (!isClientReady()) {
        return res.status(400).json({ success: false, error: 'WhatsApp client is not connected' });
    }
    try {
        console.log(`Reacting to message ${messageId} with ${emoji}...`);
        let msg;
        try {
            msg = await client.getMessageById(messageId);
        } catch (_) {}
        if (msg) {
            await msg.react(emoji);
            res.json({ success: true, message: 'Reaction sent successfully' });
        } else {
            res.status(404).json({ success: false, error: 'Message not found' });
        }
    } catch (err) {
        console.error('Failed to send reaction:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', bridge: 'running', whatsapp: clientStatus, port: PORT });
});

app.listen(PORT, () => {
    console.log(`WhatsApp Web JS Bridge running on port ${PORT}`);
});
