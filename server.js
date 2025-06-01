const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const bodyParser = require('body-parser');
const axios = require('axios');
const mime = require('mime-types');

const app = express();
const port = process.env.PORT || 3001;

let clientReady = false;
let latestQRCode = null;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    latestQRCode = qr;
    console.log('Scan this QR code in WhatsApp:');
    qrcodeTerminal.generate(qr, { small: true });
});

client.on('ready', () => {
    clientReady = true;
    latestQRCode = null;
    console.log('✅ WhatsApp client is ready!');
});

client.on('auth_failure', () => {
    console.error('❌ Auth failure. Try deleting the .wwebjs_auth folder.');
});

client.on('disconnected', (reason) => {
    clientReady = false;
    console.log('❌ WhatsApp disconnected:', reason);
});

client.initialize();

app.use(bodyParser.json());

// Serve QR code as image
app.get('/qr', async (req, res) => {
    if (!latestQRCode) {
        return res.status(404).send('No QR code available right now. Already authenticated or not generated yet.');
    }
    try {
        const qrImageDataUrl = await QRCode.toDataURL(latestQRCode);
        res.send(`
            <h1>Scan this WhatsApp QR code</h1>
            <img src="${qrImageDataUrl}" />
            <p>If QR code does not appear, try refreshing the page.</p>
        `);
    } catch (error) {
        console.error('Error generating QR code image:', error);
        res.status(500).send('Error generating QR code image');
    }
});

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

app.get('/', (req, res) => {
    res.send('WhatsApp Bot is running!');
});

app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
