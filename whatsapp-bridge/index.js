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
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let client = null;
let clientStatus = 'disconnected'; // disconnected, connecting, connected, error
let qrCodeBase64 = null;
let connectedPhone = null;
let pairingCode = null;
let lastError = null;

// Initialize WhatsApp client
async function initClient(phoneForPairingCode = null, linkMethod = 'qr') {
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
    
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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
        } catch (err) {
            console.error('Failed to generate QR base64:', err);
        }
    });

    client.on('ready', async () => {
        console.log('WhatsApp Client is ready!');
        const actualPhone = (client.info && client.info.wid) ? client.info.wid.user : (client.info ? client.info.phone : expectedPhone);
        
        // Security Verification: Ensure actual connected phone number matches expected phone number
        if (expectedPhone && actualPhone) {
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
    });

    client.on('authenticated', () => {
        console.log('WhatsApp Client authenticated.');
    });

    client.on('auth_failure', (msg) => {
        console.error('Authentication failure:', msg);
        clientStatus = 'disconnected';
        lastError = `Auth failure: ${msg}`;
        qrCodeBase64 = null;
        pairingCode = null;
    });

    client.on('disconnected', (reason) => {
        console.log('Client was logged out or disconnected:', reason);
        clientStatus = 'disconnected';
        connectedPhone = null;
        qrCodeBase64 = null;
        pairingCode = null;
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
            
            await fetch('http://localhost:8000/api/v1/whatsapp/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, content, name, tags })
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
        await client.logout();
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
    res.json({ success: true, message: 'Client disconnected successfully' });
});

app.post('/send', async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) {
        return res.status(400).json({ success: false, error: 'Phone and message are required' });
    }

    if (clientStatus !== 'connected' || !client) {
        return res.status(400).json({ success: false, error: 'WhatsApp client is not connected' });
    }

    try {
        // Clean phone number (JIDs like @g.us / @broadcast should not be modified)
        let cleanPhone = phone;
        if (phone.includes('@')) {
            cleanPhone = phone;
        } else {
            cleanPhone = phone.replace(/[+\s-()]/g, '');
            if (!cleanPhone.endsWith('@c.us')) {
                cleanPhone = `${cleanPhone}@c.us`;
            }
        }

        console.log(`Sending message to ${cleanPhone}: "${message.substring(0, 30)}..."`);
        const msg = await client.sendMessage(cleanPhone, message);
        
        res.json({
            success: true,
            message_id: msg.id.id,
            status: 'sent'
        });
    } catch (err) {
        console.error('Failed to send message:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/contacts', async (req, res) => {
    if (clientStatus !== 'connected' || !client) {
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

        // 2. Merge active chats to capture groups/broadcasts not in contacts list
        for (const chat of chats) {
            if (chat.id && chat.id._serialized && !contactMap.has(chat.id._serialized)) {
                contactMap.set(chat.id._serialized, {
                    id: chat.id,
                    name: chat.name,
                    isGroup: chat.isGroup,
                    isUser: chat.id.server === 'c.us',
                    number: chat.id.user
                });
            }
        }

        // 3. Map to clean format and classify type
        const cleanContacts = Array.from(contactMap.values())
            .filter(c => {
                if (!c.id || !c.id._serialized) return false;
                const jid = c.id._serialized;
                const isGroup = c.isGroup || jid.endsWith('@g.us');
                const isBroadcast = jid.endsWith('@broadcast') || (c.id && c.id.server === 'broadcast');
                if (isGroup || isBroadcast) return true;
                return c.isMyContact === true;
            })
            .map(c => {
                const jid = c.id._serialized;
                let type = 'User';
                if (c.isGroup || jid.endsWith('@g.us')) {
                    type = 'Group';
                } else if (jid.endsWith('@broadcast') || (c.id && c.id.server === 'broadcast')) {
                    type = 'Broadcast';
                }

                let phone = jid;
                if (type === 'User') {
                    const num = c.number || (c.id && c.id.user);
                    phone = num ? '+' + num : jid;
                }

                let name = c.name || c.pushname;
                if (!name) {
                    if (type === 'User') {
                        name = c.number || (c.id && c.id.user);
                    } else if (type === 'Group') {
                        name = 'Unnamed Group (' + jid.split('@')[0] + ')';
                    } else {
                        name = 'Unnamed Broadcast List';
                    }
                }

                return {
                    name: name,
                    phone: phone,
                    type: type
                };
            })
            .filter(c => c.phone && c.name);
        
        console.log(`Fetched ${cleanContacts.length} total contacts (including groups and broadcasts)`);
        res.json({
            success: true,
            contacts: cleanContacts
        });
    } catch (err) {
        console.error('Failed to fetch contacts:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`WhatsApp Web JS Bridge running on port ${PORT}`);
});
