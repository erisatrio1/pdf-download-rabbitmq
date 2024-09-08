import { config } from "../config/index.js";
import mongoose from 'mongoose';
import { Client } from '@elastic/elasticsearch'
import { ElasticsearchTransport } from 'winston-elasticsearch'
import winston from 'winston';
const { combine, timestamp, printf, json, colorize } = winston.format;
import * as Minio from 'minio'

class ElasticConnect {
    async elasticConnect() {
        try {
            const esClient = new Client({ node: config.ELASTIC_PORT });
    
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
            
        } catch (error) {
            console.log('Error Elascit connect', error.message);
            // logger.error('Error Elastic connect', { error: error.message});
        }
    }

    logger() {
        this.elasticConnect();
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

        return logger;
    }
}
// export const elasticConnect = async() => {

// }


export const MinioClient = async() => {
    const minioClient = new Minio.Client({
        endPoint: config.MINIO_ENDPOINT, 
        port: 9000, 
        useSSL: false, 
        accessKey: config.MINIO_ACCESS_KEY,
        secretKey: config.MINIO_SECRET_KEY
    });   
    
    return minioClient;
}

export const connection = async(bucketName) => {
    // const logger = elasticConnect();
    const winstonLog = new ElasticConnect();
    const logger = winstonLog.elasticConnect();
    try {     
        const minioClient = MinioClient();
        // check dan create bucket jika tidak ada
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

export default ElasticConnect;