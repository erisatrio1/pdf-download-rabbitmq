import express from 'express';
// import amqp from 'amqplib/callback_api.js';
import amqp from 'amqplib';
import * as Minio from 'minio'
import puppeteer from 'puppeteer';
import mongoose from 'mongoose';
import { executablePath } from 'puppeteer'
import { customAlphabet } from 'nanoid';
import winston from 'winston';
import { Client } from '@elastic/elasticsearch'
import { ElasticsearchTransport } from 'winston-elasticsearch'
import { Log } from './model/Log.js'
import 'dotenv/config.js'
 
const { combine, timestamp, printf, json, colorize } = winston.format;

const app = express();
const PORT = process.env.PORT;

const esClient = new Client({ node: process.env.ELASTIC_PORT });

const esTransportOpts = {
    level: "info",
    client: esClient,
    indexPrefix: "logstash",
    transformer: (logData) => {
        return {
            "@timestamp": logData.timestamp || new Date().toISOString(),
            message: logData.message,
            severity: logData.level,
            meta: logData.meta || {},
        };
    },
};

const esTransport = new ElasticsearchTransport(esTransportOpts);

// Custom format for console logs
const consoleFormat = combine(
    colorize(),
    timestamp(),
    printf(({ timestamp, level, message, ...meta }) => {
        let metaString = Object.keys(meta).length
        ? JSON.stringify(meta, null, 2)
        : "";
        return `${timestamp} [${level}]: ${message} ${metaString}`;
    })
);
  
// Custom format for file logs
const fileFormat = combine(
    timestamp(),
    printf(({ timestamp, level, message, ...meta }) => {
        let metaString = Object.keys(meta).length
        ? JSON.stringify(meta, null, 2)
        : "";
        return `${timestamp} [${level}]: ${message} ${metaString}`;
    })
);

const logger = winston.createLogger({
    level: "info",
    format: json(),
    transports: [
        new winston.transports.File({
        filename: "logs/combined.log",
        format: fileFormat,
    }),
    new winston.transports.Console({ format: consoleFormat }),
    esTransport, 
],
});

let processedFiles = 0; 
const failedLinks = []; 
const retryLimit = 5; 

// Konfigurasi MinIO Client
const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT, 
    // port: process.env.MINIO_PORT, 
    port: 9000, 
    useSSL: false, 
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
});

// Check dan create bucket pada MinIO
const initialize = async() => {
    const bucketName = 'pdf-bucket'; 
    const bucketExist = await minioClient.bucketExists(bucketName);
    try {
        // Koneksi ke MongoDB
        mongoose
            .connect(process.env.MONGODB_PORT)
            .then(() => logger.info('Connected to MongoDB'))
            .catch(r => logger.error('Connection Failed to MongoDB', {error: r.message}));

        // check dan create bucket jika tidak ada
        if (!bucketExist) {
            await minioClient.makeBucket(bucketName)
            logger.info(`Bucket '${bucketName}' created.`);
        } else {
            logger.info(`Bucket '${bucketName}' already exists.`);
        }
    } catch (error) {
        logger.error('Error initializing bucket', { error: error.message});
    }
}

const generateFilename = () => {
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
const downloadPDF = async(url) => {
    const createdAt = new Date();

    // Mulai pengukuran untuk render HTML
    const renderStartTime = Date.now();

    const browser = await puppeteer.launch({
        executablePath: executablePath(),
    });

    const page = await browser.newPage();

    await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 0
    });

    const pdfUint8Array = await page.pdf({
        format: 'A4',
        landscape: true 
    });

    // Akhir pengukuran render HTML
    const renderEndTime = Date.now(); 
    const renderTimeInMillisecond = renderEndTime - renderStartTime;

    // Menghitung waktu download PDF
    let pdfBuffer = Buffer.from(pdfUint8Array);
    const fileSizeInBytes = pdfBuffer.length;
    const filename = generateFilename();

    // Akhir pengukuran download PDF
    const downloadEndTime = Date.now(); 
    let downloadTimeInMillisecond = downloadEndTime - renderEndTime;

    if (downloadTimeInMillisecond === 0) {
        downloadTimeInMillisecond = 1; // Set default kecil jika waktu terlalu cepat untuk dihitung
    }

    try {
        const uploadStartTime = Date.now(); // Mulai pengukuran upload PDF ke MinIO
        const bucketName = 'pdf-bucket'; 

        await minioClient.putObject(bucketName, filename, pdfBuffer )

        const uploadEndTime = Date.now(); // Akhir pengukuran upload PDF ke MinIO
        const uploadTimeInMillisecond = uploadEndTime - uploadStartTime;

        // Menghitung kecepatan download dan upload
        const downloadSpeedKBPerMs = fileSizeInBytes / downloadTimeInMillisecond  / 1024;
        const uploadSpeedKBPerMs = fileSizeInBytes / uploadTimeInMillisecond / 1024;

        // Konversi ke KB/s
        const downloadSpeedRounded = Math.round(downloadSpeedKBPerMs * 1000); 
        const uploadSpeedRounded = Math.round(uploadSpeedKBPerMs * 1000); 

        logger.info(`Downloaded ${filename} (${fileSizeInBytes} bytes)`)

        // Menyimpan log ke MongoDB
        const log = new Log({
            name: filename,
            createdAt: String(createdAt),
            size: fileSizeInBytes,
            renderTimeInMs: renderTimeInMillisecond,
            downloadDurationInMs: downloadTimeInMillisecond,
            uploadDurationInMs:uploadTimeInMillisecond,
            downloadSpeedInSecond: downloadSpeedRounded,
            uploadSpeedinSecond: uploadSpeedRounded,
            downloadSuccess: true,
            message:`Downloaded ${filename} (${fileSizeInBytes} bytes)`
        });

        await log.save();
        logger.info(`Log saved for ${filename}`);

    } catch (error) {
        logger.error(`Error saving log for ${filename}:`, { error:error.message });
    }
}

// Fungsi untuk memproses ulang link yang gagal
async function retryFailedLinks(channel) {
    for (let i = 0; i < failedLinks.length; i++) {
        const { link, retries } = failedLinks[i];

        if (retries >= retryLimit) {
            logger.error(`Download for ${link} failed after ${retryLimit} retries. Giving up.`);
            const createdAt = new Date();
            const log = new Log({
                name: link,
                createdAt: String(createdAt),
                size: 0,
                renderTimeInMs: 0,
                downloadDurationInMs: 0,
                uploadDurationInMs:0,
                downloadSpeedInSecond: 0,
                uploadSpeedinSecond: 0,
                downloadSuccess: false,
                message:`Download for ${link} failed after ${retryLimit} retries. Giving up.`
            });
            await log.save();
            continue; 
        }

        try {
            await downloadPDF(link);
            processedFiles += 1;
            logger.info(`Retried and downloaded ${link}`);

            failedLinks.splice(i, 1);
            i--; // 
        } catch (error) {
            logger.error(`Error retrying ${link}:`, { error: error.message});

            failedLinks[i].retries += 1;

            if (failedLinks[i].retries >= retryLimit) {
                logger.error(`Reached retry limit for ${link}. Will not retry further.`);
            }
        }
    }
}

const connectToRabbit = async() => {
    try {
        const connection = amqp.connect(process.env.RABBIT_PORT);
        logger.info("Connected to Rabbit");
        return connection;
    } catch (error) {
        logger.error('Connection Failed to Rabbit', {error: error.message});
        return new Error('Failed connect to Rabbit');
    }
}

const consumeMessage = async() => {
    const connection = await connectToRabbit();
    const channel = await connection.createChannel();
    const queue = 'pdf_download_queue';

    await channel.assertQueue(queue);
    channel.prefetch(1);

    channel.consume(queue, async (msg) => {
        const pdfLink = msg.content.toString();
        logger.info(`Received: ${pdfLink}`);

        try {
            await downloadPDF(pdfLink);
            processedFiles += 1; 
            channel.ack(msg); 
        } catch (error) {
            logger.error(` Error downloading ${pdfLink}:`, { error:error.message });

            const existingFailedLink = failedLinks.find(item => item.link === pdfLink);

            if (existingFailedLink) {
                existingFailedLink.retries += 1;
                if (existingFailedLink.retries >= retryLimit) {
                    logger.error(`Reached retry limit for ${pdfLink}. Will not retry further.`);
                }
            } else {
                failedLinks.push({ link: pdfLink, retries: 1 });
            }

            channel.ack(msg); 
        }

        if (channel.checkQueue(queue).messageCount === 0 && failedLinks.length > 0) {
            await retryFailedLinks(channel);
        }
    }, {
        noAck: false
    })
}

initialize()
    .then(() => consumeMessage().catch(logger.error))
    .catch(logger.error)

// Endpoint check ketersediaan service dua
app.get('/check', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

app.listen(PORT, () => {
    console.log(`Consumer service running on http://localhost:${PORT}`);
});
