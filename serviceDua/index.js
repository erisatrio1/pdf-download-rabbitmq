import express from 'express';
import amqp from 'amqplib/callback_api.js';
import path from 'path';
import axios from 'axios';
import * as Minio from 'minio'
import stream from 'stream';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';


const app = express();
const PORT = 5001;

// Koneksi ke MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/pdflogs');

const logSchema = new mongoose.Schema({
    name: String,
    size: Number,
    speed: Number,
    downloadSpeed: Number,
    message: String,
});

const Log = mongoose.model('Log', logSchema);

let processedFiles = 0; // Counter untuk file yang berhasil di-download
const failedLinks = []; // Array untuk menyimpan link yang gagal
const retryLimit = 5; // Batas maksimal retry

// Konfigurasi MinIO Client
const minioClient = new Minio.Client({
    endPoint: 'localhost', // Ubah sesuai dengan endpoint MinIO Anda
    port: 9000, // Port MinIO
    useSSL: false, // Ubah ke true jika menggunakan SSL
    accessKey: 'minioadmin',
    secretKey: 'minioadmin'
});

const bucketName = 'pdf-bucket'; // Nama bucket di MinIO

// Check dan create bucket pada MinIO
(async() => {
    const bucketExist = await minioClient.bucketExists(bucketName);
    try {
        if (!bucketExist) {
            await minioClient.makeBucket(bucketName)
            console.log(`Bucket '${bucketName}' created.`);
        } else {
            console.log(`Bucket '${bucketName}' already exists.`);
          }
    } catch (error) {
        console.error(`Error initializing bucket: ${error}`);
    }
})();

app.use(morgan('combined'));

function generateFilename() {
        // Dapatkan waktu saat ini dan formatnya
        const now = new Date();
        const yy = String(now.getFullYear()).slice(2);
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
    
        // Generate NanoID dengan 5 karakter
        const nanoid = customAlphabet('1234567890abcdef', 5)();
    
        // Format nama file
        const filename = `${yy}${MM}${dd}_${HH}${mm}${ss}_${nanoid}.pdf`;

        return filename;
};

// Fungsi untuk mendownload file PDF dan menyimpannya di MinIO
async function downloadPDF(url) {

    const startTime = Date.now();

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    const contentLength = response.headers['content-length'];
    const fileSizeInBytes = parseInt(contentLength, 10);

    const pass = new stream.PassThrough();
    response.data.pipe(pass);

    const filename = generateFilename();

    try {
        await minioClient.putObject(bucketName, filename, pass )
        const endTime = Date.now(); 
        const downloadTimeInSeconds = (endTime - startTime) / 1000;

        const downloadTimeInSecondsRounded = Math.round(downloadTimeInSeconds);

        const downloadSpeed = fileSizeInBytes / downloadTimeInSeconds;

        const downloadSpeedRounded = Math.round(downloadSpeed / 1024);

        console.log(` [#] Downloaded ${filename} (${fileSizeInBytes} bytes) in ${downloadTimeInSecondsRounded} seconds`);
        console.log(` [#] Download speed: ${downloadSpeedRounded} KB/s`);

        const log = new Log({
            name: filename,
            size: fileSizeInBytes,
            speed: downloadTimeInSecondsRounded,
            downloadSpeed: downloadSpeedRounded,
            message:`Downloaded ${filename} (${fileSizeInBytes} bytes) in ${downloadTimeInSecondsRounded} seconds`
        });

        await log.save();
        console.log(` [#] Log saved for ${filename}`);

    } catch (error) {
        console.error(` [#] Error saving log for ${filename}:`, error.message);
    }
}

// Fungsi untuk memproses ulang link yang gagal
async function retryFailedLinks(channel) {
    for (let i = 0; i < failedLinks.length; i++) {
        const { link, retries } = failedLinks[i];

        if (retries >= retryLimit) {
            console.error(` [#] Download for ${link} failed after ${retryLimit} retries. Giving up.`);
            continue; // Skip to the next link if retry limit is reached
        }

        try {
            await downloadPDF(link);
            processedFiles += 1;
            console.log(` [#] Retried and downloaded ${link}`);

            // Remove link from failedLinks after successful download
            failedLinks.splice(i, 1);
            i--; // Adjust index after removal
        } catch (error) {
            console.error(` [#] Error retrying ${link}:`, error.message);

            // Increment the retry count
            failedLinks[i].retries += 1;

            // If retry limit is reached, log and skip this link
            if (failedLinks[i].retries >= retryLimit) {
                console.error(` [#] Reached retry limit for ${link}. Will not retry further.`);
            }
        }
    }
}

// Koneksi ke RabbitMQ dan mulai mendengarkan antrian
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

        console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", queue);

        channel.consume(queue, async (msg) => {
            const pdfLink = msg.content.toString();
            console.log(" [#] Received '%s'", pdfLink);

            try {
                await downloadPDF(pdfLink);
                processedFiles += 1; // Increment counter setelah berhasil download
                channel.ack(msg); // Acknowledge pesan setelah berhasil diproses
            } catch (error) {
                console.error(` [#] Error downloading ${pdfLink}:`, error.message);

                // Cek apakah link sudah ada di failedLinks
                const existingFailedLink = failedLinks.find(item => item.link === pdfLink);

                if (existingFailedLink) {
                    existingFailedLink.retries += 1;
                    if (existingFailedLink.retries >= retryLimit) {
                        console.error(` [#] Reached retry limit for ${pdfLink}. Will not retry further.`);
                    }
                } else {
                    // Jika belum ada, tambahkan dengan retries = 1
                    failedLinks.push({ link: pdfLink, retries: 1 });
                }

                channel.ack(msg); // Acknowledge pesan meskipun gagal
            }

            // Jika tidak ada lagi pesan di antrian, coba retry failedLinks
            if (channel.checkQueue(queue).messageCount === 0 && failedLinks.length > 0) {
                await retryFailedLinks(channel);
            }
        }, {
            noAck: false
        });
    });
});

// Endpoint untuk menampilkan jumlah file yang sudah diproses
app.get('/processed-files', (req, res) => {
    res.json({ processedFiles, failedLinks });
});

// Endpoint check ketersediaan service dua
app.get('/check', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

app.listen(PORT, () => {
    console.log(`Consumer service running on http://localhost:${PORT}`);
});
