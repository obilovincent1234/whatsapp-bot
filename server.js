const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

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
    console.log('✅ WhatsApp client is ready!');
});

client.on('auth_failure', () => {
    console.error('❌ Auth failure. Try deleting the .wwebjs_auth folder.');
});

client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp disconnected:', reason);
});

// Start WhatsApp client
client.initialize();

// Express middleware
app.use(bodyParser.json());

// Send message to WhatsApp group or contact
app.post('/send-message', async (req, res) => {
    const { groupName, caption, imageUrl } = req.body;

    try {
        const chats = await client.getChats();
        const group = chats.find(chat => chat.isGroup && chat.name.toLowerCase() === groupName.toLowerCase());

        if (!group) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }

        if (imageUrl) {
            const media = await MessageMedia.fromUrl(imageUrl);
            await client.sendMessage(group.id._serialized, media, { caption });
        } else {
            await client.sendMessage(group.id._serialized, caption);
        }

        return res.json({ success: true, message: 'Message sent!' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Error sending message' });
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
              
