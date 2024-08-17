import express from 'express';
import amqp from 'amqplib/callback_api.js';
import path from 'path';
import puppeteer from 'puppeteer'
import { executablePath } from 'puppeteer'

const app = express();
const PORT = 5001;

// Menghitung file yang berhasil di-download
let processedFiles = 0; 


// Function untuk mendownload file PDF
async function downloadPDF(url, filename) {
    const browser = await puppeteer.launch({
        executablePath: executablePath(),
    });

    // Buka halaman web
    const page = await browser.newPage();
    await page.goto(url, {
      waitUntil: 'networkidle2',
    });

    // Simpan pdf
    await page.pdf({
      path: `${filename}.pdf`,
    });
    
    await browser.close();
}


// Koneksi ke RabbitMQ
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

        console.log(" [*] Waiting for messages in %s.", queue);

        channel.consume(queue, async (msg) => {
            const pdfLink = msg.content.toString();
            console.log(" [] Received '%s'", pdfLink);

            try {
                // Mendapatkan nama file dari url
                const filename = path.basename(pdfLink); 

                // Run fungsi download pdf
                await downloadPDF(pdfLink, filename);

                processedFiles += 1;
                console.log(` [] Downloaded and saved ${filename}`);

                // Acknowledge pesan setelah berhasil diproses
                channel.ack(msg); 
            } catch (error) {
                console.error(` [] Error downloading ${pdfLink}:`, error.message);
            }
        }, {
            noAck: false
        });
    });
});

// Endpoint untuk menampilkan jumlah file yang sudah diproses
app.get('/processed-files', (req, res) => {
    res.json({ processedFiles });
});

// Endpoint check ketersediaan service dua
app.get('/check', (req, res) => {
    res.status(200).json({ status: 'UP' });
});


app.listen(PORT, () => {
    console.log(`Service 2 up and running on port${PORT}`);
});
