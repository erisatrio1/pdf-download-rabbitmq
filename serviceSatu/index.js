import express from "express";
import amqp from "amqplib/callback_api.js";
import axios from 'axios';

const app = express();
const PORT = 5000;

// url untuk check ketersediaan servcie dua
const service2Url = 'http://localhost:5001/check'; 

app.use(express.json());

// function untuk mengirim pesan ke RabbitMQ
function sendToQueue(message) {
    amqp.connect('amqp://localhost', (error0, connection) => {
        if (error0) {
            throw error0;
        }
        connection.createChannel((error1, channel) => {
            if (error1) {
                throw error1;
            }

            const queue = 'pdf_download_queue';

            channel.assertQueue(queue, {
                durable: true
            });

            // Kirim pesan ke antrian
            channel.sendToQueue(queue, Buffer.from(message), {
                persistent: true
            });

            console.log(" [] Sent '%s'", message);
        });

        // Tutup koneksi RabbitMQ
        setTimeout(() => {
            connection.close();
        }, 500);
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
                sendToQueue(link);
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
