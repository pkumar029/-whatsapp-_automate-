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
async function initClient(phoneForPairingCode = null) {
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
        console.log(`Client will request Pairing Code for: ${phoneForPairingCode}`);
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

            // Generate pairing code if phone number is specified (regenerate on QR refreshes)
            if (phoneForPairingCode) {
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

    client.on('ready', () => {
        console.log('WhatsApp Client is ready!');
        clientStatus = 'connected';
        qrCodeBase64 = null;
        pairingCode = null;
        connectedPhone = (client.info && client.info.wid) ? client.info.wid.user : (client.info ? client.info.phone : phoneForPairingCode);
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
        console.log(`Inbound message from ${msg.from}: ${msg.body}`);
        try {
            if (msg.from.endsWith('@g.us')) return; // ignore groups
            
            const phone = '+' + msg.from.split('@')[0];
            const content = msg.body;
            
            await fetch('http://localhost:8000/api/v1/whatsapp/webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, content })
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
    const { phone } = req.body;
    await initClient(phone);
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
        // Clean phone number (must end with @c.us for whatsapp-web.js)
        let cleanPhone = phone.replace(/[+\s-()]/g, '');
        if (!cleanPhone.endsWith('@c.us')) {
            cleanPhone = `${cleanPhone}@c.us`;
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
        console.log('Fetching contacts from whatsapp-web.js client...');
        const chats = await client.getContacts();
        
        // Filter contacts to keep only actual users with names and numbers
        const cleanContacts = chats
            .filter(c => c.isUser && (c.name || c.pushname) && c.number)
            .map(c => ({
                name: c.name || c.pushname || c.number,
                phone: '+' + c.number
            }));
        
        console.log(`Fetched ${cleanContacts.length} valid user contacts`);
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
