import { config } from "../config/index.js";
import mongoose from 'mongoose';
import { Client } from '@elastic/elasticsearch'
import { ElasticsearchTransport } from 'winston-elasticsearch'
import winston from 'winston';
const { combine, timestamp, printf, json, colorize } = winston.format;
import * as Minio from 'minio'


export const esClient = new Client({ node: config.ELASTIC_PORT });
    
export const esTransportOpts = {
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

export const esTransport = new ElasticsearchTransport(esTransportOpts);
    
export const consoleFormat = combine(
    colorize(),
    timestamp(),
    printf(({ timestamp, level, message, ...meta }) => {
        let metaString = Object.keys(meta).length
        ? JSON.stringify(meta, null, 2)
        : "";
        return `${timestamp} [${level}]: ${message} ${metaString}`;
    })
);
  
export const fileFormat = combine(
    timestamp(),
    printf(({ timestamp, level, message, ...meta }) => {
        let metaString = Object.keys(meta).length
        ? JSON.stringify(meta, null, 2)
        : "";
        return `${timestamp} [${level}]: ${message} ${metaString}`;
    })
);

export const logger = winston.createLogger({
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

export const minioClient = new Minio.Client({
    endPoint: config.MINIO_ENDPOINT, 
    port: 9000, 
    useSSL: false, 
    accessKey: config.MINIO_ACCESS_KEY,
    secretKey: config.MINIO_SECRET_KEY
});   

export const connection = async(bucketName) => {
    try {     
        const bucketExist = await minioClient.bucketExists(bucketName);
        if (!bucketExist) {
            await minioClient.makeBucket(bucketName)
            logger.info(`Bucket '${bucketName}' created.`);
        } else {
            logger.info(`Bucket '${bucketName}' already exists.`);
        }
        // Koneksi ke MongoDB
        await mongoose
                .connect(config.MONGODB_PORT)
                .then(() => logger.info('Connected to MongoDB'))
                .catch(r => logger.error('Connection Failed to MongoDB', {error: r.message}));

    } catch (error) {
        logger.error('Error Initializing DB', { error: error.message});
    }
}
