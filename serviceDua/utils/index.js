import amqp from 'amqp-connection-manager';
import { config } from '../config/index.js';
import ElasticConnect from "../database/index.js";
import Service from '../service/index.js';

const winstonLog = new ElasticConnect();
const logger = winstonLog.elasticConnect()

export const CreateChannel = async() => {
    try {
        const connection = amqp.connect ([config.RABBIT_PORT]);
        logger.info("Connected to Rabbit");
        return connection;
    } catch (error) {
        logger.error('Connection Failed to Rabbit', {error: error.message});
        return new Error('Failed connect to Rabbit');
    }
}

export const ConsumeLink = (connection, failedLinks, retryLimit) => {
    const queue = 'pdf_download_queue';
    let processedFiles = 0; 
    const service = new Service()

    const channelWrapper = connection.createChannel({
        setup: async(channel) => {
            await channel.assertQueue(queue, {durable: true });
            channel.prefetch(1);
            channel.consume(queue, async(msg) => {
                const pdfLink = msg.content.toString();
                logger.info(`Received: ${pdfLink}`);
                try {
                    await service.downloadPDF(pdfLink);
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

                    if (channel.checkQueue(queue).messageCount === 0 && failedLinks.length > 0) {
                        await service.retryFailedLinks(channel, failedLinks, retryLimit);
                    }
                }
            }, {
                noAck: false
            })
        }
    })
}

export const Result = (message, data, error) => ({
    message: message,
    data: data,
    error: error
})