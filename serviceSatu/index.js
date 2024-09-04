import express from "express";
import amqp from "amqplib/callback_api.js";
import axios from 'axios';
import morgan from 'morgan';
import { Client } from "@elastic/elasticsearch"
import { ecsFormat } from "@elastic/ecs-morgan-format"

const app = express();
const PORT = 5000;

// url untuk check ketersediaan servcie dua
const service2Url = 'http://localhost:5001/check'; 

// connect elasticsearch
const client =  new Client({
    node: 'http://localhost:9200'
});

(async() => {
    const indexExists = await client.indices.exists({
        index: "pdf-downloader"
    });
    try {
        if (!indexExists) {
            await client.indices.create({ index: 'pdf-downloader' });
            console.log('Index created');
        } else {
            console.log('Index alredy exist');
          }
    } catch (error) {
        console.error(`Error initializing index: ${error}`);
    }
})();

const logToElasticsearch = async (log) => {
    try {
      await client.index({
        index: 'pdf-downloader',
        body: log,
      });
    } catch (error) {
      console.error('Error saving log to Elasticsearch', error);
    }
  };

app.use(express.json());
app.use(morgan(ecsFormat(), {
    stream: {
      write: (message) => {
        const log = JSON.parse(message); // Log sudah dalam format JSON ECS
        logToElasticsearch(log);
      },
    },
}));
// amqp connection manager
// env 
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

            // console.log(" [#] Sent '%s'", message);
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
