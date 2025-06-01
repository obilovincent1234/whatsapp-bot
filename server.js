const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');
const bodyParser = require('body-parser');
const axios = require('axios');
const mime = require('mime-types');

const app = express();
const port = process.env.PORT || 3000;

let clientReady = false; // Track readiness

// WhatsApp Client with persistent session using LocalAuth
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Show QR code in terminal on first login
client.on('qr', (qr) => {
    console.log('Scan this QR code in WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    clientReady = true;
    console.log('✅ WhatsApp client is ready!');
});

client.on('auth_failure', () => {
    console.error('❌ Auth failure. Try deleting the .wwebjs_auth folder.');
});

client.on('disconnected', (reason) => {
    clientReady = false;
    console.log('❌ WhatsApp disconnected:', reason);
});

// Start WhatsApp client
client.initialize();

// Express middleware
app.use(bodyParser.json());

// Send message to WhatsApp group or contact
app.post('/send-message', async (req, res) => {
    if (!clientReady) {
        return res.status(503).json({ success: false, message: 'WhatsApp client not ready. Try again shortly.' });
    }

    const { groupName, caption, imageUrl } = req.body;

    try {
        const chats = await client.getChats();
        const group = chats.find(chat => chat.isGroup && chat.name.toLowerCase() === groupName.toLowerCase());

        if (!group) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        if (imageUrl) {
            // Manually fetch image and create MessageMedia
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const mimeType = response.headers['content-type'];
            const extension = mime.extension(mimeType);
            const base64Image = Buffer.from(response.data, 'binary').toString('base64');

            const media = new MessageMedia(mimeType, base64Image, `image.${extension}`);
            await client.sendMessage(group.id._serialized, media, { caption });
        } else {
            await client.sendMessage(group.id._serialized, caption);
        }

        return res.json({ success: true, message: 'Message sent!' });
    } catch (err) {
        console.error('❌ Error:', err);
        return res.status(500).json({ success: false, message: 'Error sending message', error: err.message });
    }
});

// Health check
app.get('/', (req, res) => {
    res.send('WhatsApp Bot is running!');
});

// Start Express server
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
