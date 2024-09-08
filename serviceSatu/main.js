import express from "express";
import amqp from 'amqp-connection-manager';
import axios from 'axios';
import 'dotenv/config.js'

const app = express();
const PORT = process.env.PORT;

// url untuk check ketersediaan servcie dua
const service2Url = process.env.RABBIT_PORT; 

app.use(express.json());

// function untuk mengirim pesan ke RabbitMQ
const sendPDF = (message) => {
    const connection = amqp.connect ([process.env.RABBIT_PORT]);
    const queue = 'pdf_download_queue';

    const channelWrapper = connection.createChannel({
        setup: (channel) => {
            return channel.assertQueue(queue, {durable: true })
        }
    })

    channelWrapper
    .sendToQueue(queue, Buffer.from(message), {
        persistent: true
    })
    .then(() => {
        return console.log('Success send message')
    })
    .catch((r) => {
        return console.log(r)
    });
}

// Endpoint untuk menerima array link PDF
app.post('/send-pdf-links', async (req, res) => {
    const pdfLinks = req.body.pdfLinks;

    if (!Array.isArray(pdfLinks)) {
        return res.status(400).json({ error: 'Format must be array of PDF links.' });
    }

    try {
        // Check ketersediaan service dua
        const healthCheck = await axios.get(service2Url);

        if (healthCheck.status === 200) {
            pdfLinks.forEach(link => {
                sendPDF(link);
            });

            res.json({ message: 'Links sent to queue for processing', totalLinks: pdfLinks.length });
        } else {
            res.status(503).json({ error: 'Service 2 is unavailable. Please try again later.' });
        }
    } catch (error) {
        // Kirim response jika service 2 tidak tersedia
        res.status(503).json({ error: 'Service 2 is unavailable. Please try again later.' });
    }
});

app.listen(PORT, () => {
    console.log(`Service 1 up and running on port:${PORT}`);
});
